import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type ActionCtx,
} from "./_generated/server";

// One researched snapshot feeds every quote for a day. The refresh itself is
// the only call that pays for web search.
const SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;
// Don't stack refreshes if several quotes hit a stale snapshot at once.
const REFRESH_DEDUPE_MS = 15 * 60 * 1000;

export const getLatestSnapshot = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("marketSnapshots").order("desc").first();
  },
});

export const saveSnapshot = internalMutation({
  args: { content: v.string() },
  returns: v.null(),
  handler: async (ctx, { content }) => {
    await ctx.db.insert("marketSnapshots", {
      content,
      createdAt: Date.now(),
    });
    // Keep the table tiny: drop everything but the newest three.
    const all = await ctx.db.query("marketSnapshots").order("desc").collect();
    for (const row of all.slice(3)) await ctx.db.delete(row._id);
    return null;
  },
});

/** Marks intent to refresh; returns false when another refresh ran recently. */
export const claimRefresh = internalMutation({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const latest = await ctx.db.query("marketSnapshots").order("desc").first();
    const now = Date.now();
    if (latest) {
      if (now - latest.createdAt < SNAPSHOT_TTL_MS) return false;
      if (
        latest.refreshRequestedAt &&
        now - latest.refreshRequestedAt < REFRESH_DEDUPE_MS
      ) {
        return false;
      }
      await ctx.db.patch(latest._id, { refreshRequestedAt: now });
    }
    return true;
  },
});

export const refreshMarketSnapshot = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const claimed: boolean = await ctx.runMutation(
      internal.market.claimRefresh,
    );
    const existing = await ctx.runQuery(internal.market.getLatestSnapshot);
    if (!claimed && existing) return null;
    try {
      const { text } = await generateText({
        model: anthropic("claude-haiku-4-5"),
        tools: {
          web_search: anthropic.tools.webSearch_20250305({ maxUses: 4 }),
        },
        providerOptions: { anthropic: { thinking: { type: "disabled" } } },
        maxOutputTokens: 700,
        system:
          "You research current US steel and welding-material prices for a small Texas fab shop's quoting system. " +
          "Search for current prices, then output ONLY a compact plain-text bullet list (no prose, no markdown headers) titled with today's date. " +
          "Cover, with $ figures and units: A36 mild steel plate (1/4in and 1/2in, $/lb or $/sq ft), 2x2x0.120 wall square tubing ($/ft), " +
          "sch 40 carbon pipe 2in and 4in ($/ft), 304 stainless sheet premium vs mild (multiplier), 6061 aluminum premium (multiplier), " +
          "typical welding consumables cost per active welding hour (wire/rod/gas/abrasives), and one line on the current mill/scrap price trend. " +
          "Retail/small-quantity distributor prices, not mill bulk. If a number is uncertain give a range. Under 200 words.",
        messages: [
          {
            role: "user",
            content: "Refresh the material price snapshot for today.",
          },
        ],
      });
      const content = text.trim();
      if (content.length > 100) {
        await ctx.runMutation(internal.market.saveSnapshot, { content });
      } else {
        console.error("Market snapshot refresh returned too little text");
      }
    } catch (err) {
      console.error("Market snapshot refresh failed", err);
    }
    return null;
  },
});

/** Read the snapshot for prompt injection; kicks a lazy refresh when stale. */
export async function loadSnapshotForPrompt(
  ctx: ActionCtx,
): Promise<string | null> {
  const snap = await ctx.runQuery(internal.market.getLatestSnapshot, {});
  const stale = !snap || Date.now() - snap.createdAt > SNAPSHOT_TTL_MS;
  if (stale) {
    try {
      await ctx.scheduler.runAfter(0, internal.market.refreshMarketSnapshot, {});
    } catch (err) {
      console.error("Could not schedule market refresh", err);
    }
  }
  return snap ? snap.content : null;
}
