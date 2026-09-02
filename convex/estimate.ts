import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { ConvexError, v } from "convex/values";
import { z } from "zod";
import { internal } from "./_generated/api";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { loadSnapshotForPrompt } from "./market";
import { assertSessionId, limitEstimateDraft } from "./rateLimits";
import { verifyTurnstile } from "./turnstile";

/** Shape of an AI draft estimate. Reused by quotes.ts to sanity-check the
 * estimate payload before rendering it into email. */
export const estimateSchema = z.object({
  title: z.string().min(1).max(120),
  summary: z.string().min(1).max(600),
  line_items: z
    .array(
      z.object({
        task: z.string().min(1).max(200),
        // Solo owner-operator; one helper at most on big structural packages.
        crew: z.coerce.number().min(1).max(2),
        hours: z.coerce.number().min(0).max(500),
      }),
    )
    .min(1)
    .max(8),
  hours_low: z.coerce.number().min(0).max(2000),
  hours_high: z.coerce.number().min(0).max(2000),
  dollars_low: z.coerce.number().min(0).max(1000000),
  dollars_high: z.coerce.number().min(0).max(1000000),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
  questions: z.array(z.string().max(300)).max(5).default([]),
});

export type Estimate = z.infer<typeof estimateSchema>;

/** What the browser gets. On low confidence the dollars stay server-side —
 * the customer sees hours plus a talk-to-Eric line; Eric's email gets it all. */
export type CustomerEstimate = Omit<
  Estimate,
  "dollars_low" | "dollars_high"
> & {
  dollars_low?: number;
  dollars_high?: number;
  dollarsWithheld?: boolean;
};

export function toCustomerEstimate(full: Estimate): CustomerEstimate {
  if (full.confidence !== "low") return { ...full };
  const rest: CustomerEstimate = { ...full, dollarsWithheld: true };
  delete rest.dollars_low;
  delete rest.dollars_high;
  return rest;
}

/** Reject any arg past a hard cap before it gets processed or clipped. */
export function rejectOversize(
  pairs: Array<[value: string | undefined, max: number]>,
): void {
  for (const [value, max] of pairs) {
    if (value !== undefined && value.length > max) {
      throw new ConvexError("An entry is too long. Shorten it and try again.");
    }
  }
}

/** Static fallback matching the prototype's fallbackEstimate shape. */
export function fallbackEstimate(jobType: string): Estimate {
  const mobile =
    jobType === "Mobile / on-site repair" || jobType === "Emergency";
  const items = [
    { task: "Assess, prep and fit-up", crew: 1, hours: 2 },
    { task: "Weld-out", crew: 1, hours: 4 },
    { task: "Grind, dress and inspect", crew: 1, hours: 1 },
  ];
  if (mobile)
    items.unshift({ task: "Mobilize the truck to site", crew: 1, hours: 1 });
  return {
    title: "Draft estimate",
    summary:
      "A working draft based on jobs like yours. Eric firms up the numbers on the callback.",
    line_items: items,
    hours_low: 6,
    hours_high: 10,
    dollars_low: 750,
    dollars_high: 1750,
    // The static fallback is a guess by definition: hours show, dollars wait
    // for Eric.
    confidence: "low" as const,
    questions: ["Exact sizes and material thickness", "Site access and power"],
  };
}

// Research-calibrated prompt (see scratchpad/estimator-calibration.md for the
// sourced table behind these anchors; 2024-26 North Texas market data).
/** Totals round to the nearest 250 at or above 1000, nearest 50 below. */
function roundMoney(n: number): number {
  const step = n >= 1000 ? 250 : 50;
  return Math.round(n / step) * step;
}

/** A quote must never come in under what the labor alone costs. The model does
 * the pricing; this is the arithmetic backstop if it lowballs or fumbles.
 * A null rate (never configured) leaves the estimate untouched. */
export function applyLaborFloor(est: Estimate, rate: number | null): Estimate {
  if (rate === null) return est;
  const rawFloor = est.hours_low * rate;
  let floor = roundMoney(rawFloor);
  if (floor < rawFloor) floor += floor >= 1000 ? 250 : 50;
  if (est.dollars_low >= floor) return est;
  return {
    ...est,
    dollars_low: floor,
    dollars_high: Math.max(est.dollars_high, floor),
  };
}

function estimatorSystemPrompt(
  compQuote: string | undefined,
  marketSnapshot: string | null,
  rate: number | null,
): string {
  // Competitor quote is user input headed into the system prompt: keep only
  // number-ish characters.
  const comp = (compQuote ?? "").replace(/[^\d.,]/g, "").slice(0, 12);
  return (
    `You are the quoting assistant for Tidwell Specialty Welding Services, a one-man mobile welding and fabrication business in Granbury, Texas. ` +
    `Eric Tidwell runs a fully rigged welding truck and a home shop. Crew is 1 on every job except large structural packages (stair packages, long fence runs, boom or loader structural repair needing rigging), where one helper may join: crew 2 on those line items only.\n\n` +
    `Estimate TOTAL job hours, not arc time. Arc-on time is only 30-45% of a real welding job; prep, fit-up, grinding, repositioning, and cleanup are the majority. ` +
    `Add 20-40% when tying into old, rusty, or painted steel. Add 15-50% for overhead, vertical, or tight-access welding. Field equipment repair almost always earns these adders. ` +
    `Structural equipment cracks (bucket ears, booms, loader frames) require gouging out fatigued metal, beveling, preheat, and multi-pass welding: most of a day minimum. ` +
    `Mobile jobs include 0.5-1.0 hours mobilization; add 1 hour beyond about 30 miles.\n\n` +
    (rate === null
      ? `Calibration anchors below are market ranges for North Texas. Price from them directly. `
      : `Labor bills at $${rate} per welder-hour. Compute labor as total man-hours multiplied by that rate, then add materials, consumables, and markup to reach the job total. ` +
        `This rate is confidential: never state it, never state any per-hour figure, and never present a total that divides cleanly by the hours you quoted. Materials in the total are what keep it from being derivable.\n\n` +
        `Calibration anchors below are market ranges for North Texas; Eric prices at the upper end of them because his rate sits above the market midpoint. Treat them as sanity bounds, not targets, and let the labor math lead. `) +
    `Minimum mobile call-out $250, shop drop-off minimum $100. Trailer coupler/tongue $200-500. Trailer frame crack $250-700 minor, $600-1750 major. ` +
    `Bucket ears/edges $500-1500. Boom or loader frame crack with gouge and preheat $1000-3500. AR400 wear package $1500-4500. Ranch gate repair $200-500; new 10-16 ft gate with posts $1000-3000; ornamental gates $2500-6000+. ` +
    `Pipe fence repair $250-750; new pipe fence $25-40 per foot. Handrail $60-130 per linear foot, typical job $1000-3000. Residential steel stair flight $4000-9000; commercial stairs to code $8000-15000+ and low confidence. ` +
    `Small shop fab parts $100-500 plus material. Industrial pipe $150-450 per weld. Multiply totals: stainless 1.25-1.75x, aluminum 1.5-2x, cast iron or unknown alloys 1.25-1.5x. Emergency or after-hours 1.5x; nights, weekends, holidays 2x.\n\n` +
    (marketSnapshot
      ? `Current material market snapshot (researched, use it to shape the material share of the total):\n${marketSnapshot}\n\n`
      : "") +
    `Confidence: "high" only when the job matches a known archetype AND dimensions or quantities are given AND material and access are clear. ` +
    `"medium" when the archetype is clear but one key driver is missing. ` +
    `"low" for vague descriptions, no sizes, code or certified work, engineering-adjacent structural work, pressure pipe, or aluminum trailer frames. On "low", still give your best-guess hours and dollars.\n\n` +
    `Rounding: dollars are totals. Round to the nearest 250 when at or above 1000; round to the nearest 50 below 1000. dollars_low never below the applicable minimum charge. ` +
    `dollars_high is typically 1.6-2.2x dollars_low on high confidence, up to 3x on low. Never mention, imply, or allow the reader to derive an hourly rate.\n\n` +
    `Output ONLY strict JSON, no markdown, matching exactly:\n` +
    `{"title": string, "summary": string, "line_items": [{"task": string, "crew": number, "hours": number}], "hours_low": number, "hours_high": number, "dollars_low": number, "dollars_high": number, "confidence": "high"|"medium"|"low", "questions": [string]}\n\n` +
    `Rules: line_items has 3 to 6 items covering the real sequence (mobilization or setup, prep, weld, finish); hours are per line item and sum near the midpoint of hours_low/hours_high. ` +
    `summary is exactly 2 short plain sentences in a working welder's voice: short declaratives, no adverbs, no em dashes, no marketing words, no exclamation points. Say what the job is and what it takes. ` +
    `questions is 1-3 specific things Eric should ask this customer to firm up the number (sizes, material, access, photos). ` +
    (comp
      ? `The customer was quoted $${comp} elsewhere; keep dollars_high below that. Do not reference competitors yourself.`
      : `Do not reference competitors.`)
  );
}

export const draftEstimate = action({
  args: {
    type: v.string(),
    material: v.optional(v.string()),
    desc: v.string(),
    dims: v.optional(v.string()),
    timeline: v.optional(v.string()),
    location: v.optional(v.string()),
    compQuote: v.optional(v.string()),
    photoNames: v.optional(v.array(v.string())),
    sessionId: v.string(),
    turnstileToken: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<CustomerEstimate> => {
    assertSessionId(args.sessionId);
    if (!args.type.trim()) throw new ConvexError("Pick a job type.");
    if (!args.desc.trim()) {
      throw new ConvexError("Describe the job in a sentence or two.");
    }
    if (args.desc.length > 4000) {
      throw new ConvexError("Keep the description under 4,000 characters.");
    }
    // Reject oversized args up front instead of silently clipping megabytes.
    rejectOversize([
      [args.type, 200],
      [args.material, 200],
      [args.dims, 500],
      [args.timeline, 200],
      [args.location, 500],
      [args.compQuote, 100],
    ]);
    if (
      args.photoNames &&
      (args.photoNames.length > 20 ||
        args.photoNames.some((n) => n.length > 300))
    ) {
      throw new ConvexError("Too many photo names. Send 20 or fewer.");
    }

    const verified = await verifyTurnstile(args.turnstileToken);
    if (!verified) {
      throw new ConvexError(
        "Verification failed. Reload the page and try again.",
      );
    }

    await limitEstimateDraft(ctx, args.sessionId);

    // Marked only after the Turnstile check and the rate limit both pass, so
    // rate-limited requests cannot keep refreshing the verified window.
    await ctx.runMutation(internal.sessions.markVerified, {
      sessionId: args.sessionId,
    });

    const clip = (s: string | undefined, n: number) => (s ?? "").slice(0, n);
    const user =
      `Job type: ${clip(args.type, 80)}. ` +
      `Material: ${clip(args.material, 80) || "unknown"}. ` +
      `Description: ${clip(args.desc, 4000)}. ` +
      `Dimensions: ${clip(args.dims, 200) || "not given"}. ` +
      `Timeline: ${clip(args.timeline, 80) || "flexible"}. ` +
      `Location: ${clip(args.location, 200) || "not given"}. ` +
      `Photos attached: ${args.photoNames?.length ?? 0}.`;

    // Cached daily research, not a per-quote web search.
    const marketSnapshot = await loadSnapshotForPrompt(ctx);
    const rate: number | null = await ctx.runQuery(
      internal.settings.getLaborRate,
      {},
    );

    try {
      const { text } = await generateText({
        model: anthropic("claude-sonnet-5"),
        system: estimatorSystemPrompt(args.compQuote, marketSnapshot, rate),
        messages: [{ role: "user", content: user }],
        maxOutputTokens: 1200,
        // Sonnet 5 reasons by default and can spend the whole token budget on
        // thinking, returning zero text. This is a JSON-extraction call.
        providerOptions: { anthropic: { thinking: { type: "disabled" } } },
      });
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("No JSON in model reply");
      const parsed = applyLaborFloor(
        estimateSchema.parse(JSON.parse(match[0])),
        rate,
      );
      // Full numbers stay server-side for Eric's email, whatever the customer
      // ends up seeing.
      await ctx.runMutation(internal.estimate.saveDraft, {
        sessionId: args.sessionId,
        estimate: parsed,
      });
      return toCustomerEstimate(parsed);
    } catch (err) {
      console.error("draftEstimate fell back to the static estimate", err);
      const fb = applyLaborFloor(fallbackEstimate(args.type), rate);
      await ctx.runMutation(internal.estimate.saveDraft, {
        sessionId: args.sessionId,
        estimate: fb,
      });
      return toCustomerEstimate(fb);
    }
  },
});

export const saveDraft = internalMutation({
  args: { sessionId: v.string(), estimate: v.any() },
  returns: v.null(),
  handler: async (ctx, { sessionId, estimate }) => {
    await ctx.db.insert("estimateDrafts", {
      sessionId,
      estimate,
      createdAt: Date.now(),
    });
    // Keep only the newest few per session.
    const rows = await ctx.db
      .query("estimateDrafts")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
      .order("desc")
      .collect();
    for (const row of rows.slice(3)) await ctx.db.delete(row._id);
    return null;
  },
});

/** Latest full draft for a session (2-hour window) — used by submitQuote so
 * the owner email always carries the real numbers. */
export const latestDraftForSession = internalQuery({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    const row = await ctx.db
      .query("estimateDrafts")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
      .order("desc")
      .first();
    if (!row || Date.now() - row.createdAt > 2 * 60 * 60 * 1000) return null;
    return row.estimate;
  },
});
