import { Resend } from "@convex-dev/resend";
import { Resend as ResendSdk } from "resend";
import { ConvexError, v } from "convex/values";
import { components, internal } from "./_generated/api";
import { action, internalMutation } from "./_generated/server";
import {
  buildCustomerEmail,
  buildOwnerEmail,
  isEmail,
  type QuotePayload,
} from "./emailTemplates";
import { buildCallbackIcs } from "./ics";
import { estimateSchema, rejectOversize, type Estimate } from "./estimate";
import { assertSessionId, limitQuoteSubmit } from "./rateLimits";
import { verifyTurnstile } from "./turnstile";

const OWNER_EMAIL = "eric@tidwellwelding.com";
const FROM = "TSWS Website <quotes@tidwellwelding.com>";

// Test mode stays on until RESEND_TEST_MODE is explicitly set to "false", so
// nothing real sends before the domain and API key are configured.
export const resend: Resend = new Resend(components.resend, {
  testMode: process.env.RESEND_TEST_MODE !== "false",
});

const jobValidator = v.object({
  type: v.string(),
  material: v.optional(v.string()),
  desc: v.string(),
  dims: v.optional(v.string()),
  timeline: v.optional(v.string()),
  location: v.optional(v.string()),
  compQuote: v.optional(v.string()),
  photoNames: v.optional(v.array(v.string())),
});

function makeRequestId(): string {
  return (
    "Q-" +
    new Date().getFullYear() +
    "-" +
    String(Math.floor(100 + Math.random() * 900))
  );
}

const clip = (s: string, n: number) => s.trim().slice(0, n);
const clipOpt = (s: string | undefined, n: number) => {
  const out = s?.trim().slice(0, n);
  return out ? out : undefined;
};

export const insertQuote = internalMutation({
  args: {
    requestId: v.string(),
    name: v.string(),
    company: v.optional(v.string()),
    phone: v.string(),
    email: v.optional(v.string()),
    job: jobValidator,
    estimate: v.optional(v.any()),
    slot: v.string(),
  },
  returns: v.id("quotes"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("quotes", {
      ...args,
      status: "new",
      createdAt: Date.now(),
    });
  },
});

export const submitQuote = action({
  args: {
    requestId: v.optional(v.string()),
    name: v.string(),
    company: v.optional(v.string()),
    phone: v.string(),
    email: v.optional(v.string()),
    job: jobValidator,
    estimate: v.optional(v.any()),
    slot: v.string(),
    sessionId: v.string(),
    turnstileToken: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ ok: boolean; requestId: string }> => {
    assertSessionId(args.sessionId);

    if (!args.name.trim()) throw new ConvexError("Enter your name.");
    const phoneDigits = args.phone.replace(/\D/g, "");
    if (phoneDigits.length !== 10 && phoneDigits.length !== 11) {
      throw new ConvexError("Enter a 10-digit number.");
    }
    if (!args.job.type.trim()) throw new ConvexError("Pick a job type.");
    if (!args.job.desc.trim()) {
      throw new ConvexError("Describe the job in a sentence or two.");
    }
    if (!args.slot.trim()) throw new ConvexError("Pick a callback slot.");
    // Reject oversized args up front instead of silently clipping megabytes.
    rejectOversize([
      [args.name, 300],
      [args.company, 300],
      [args.phone, 100],
      [args.email, 300],
      [args.slot, 200],
      [args.job.type, 200],
      [args.job.material, 200],
      [args.job.desc, 4000],
      [args.job.dims, 500],
      [args.job.timeline, 200],
      [args.job.location, 600],
      [args.job.compQuote, 100],
    ]);
    if (
      args.job.photoNames &&
      (args.job.photoNames.length > 20 ||
        args.job.photoNames.some((n) => n.length > 300))
    ) {
      throw new ConvexError("Too many photo names. Send 20 or fewer.");
    }
    const email = clipOpt(args.email, 200);
    if (email && !isEmail(email)) {
      throw new ConvexError("Enter a valid email or leave it blank.");
    }

    // Accept either a fresh Turnstile token or a session that verified one
    // within the last 15 minutes (the estimate step already ran a check).
    let verified = false;
    if (args.turnstileToken) {
      verified = await verifyTurnstile(args.turnstileToken);
    }
    if (!verified) {
      verified = await ctx.runQuery(internal.sessions.isVerified, {
        sessionId: args.sessionId,
      });
    }
    if (!verified) {
      throw new ConvexError(
        "Verification failed. Reload the page and try again.",
      );
    }

    await limitQuoteSubmit(ctx, args.sessionId);

    const requestId =
      args.requestId && /^Q-\d{4}-\d{3,4}$/.test(args.requestId)
        ? args.requestId
        : makeRequestId();

    // Prefer the server-side draft (it keeps the dollars a low-confidence
    // customer never saw); fall back to validating whatever the client sent.
    let estimate: Estimate | undefined;
    const serverDraft = await ctx.runQuery(
      internal.estimate.latestDraftForSession,
      { sessionId: args.sessionId },
    );
    if (serverDraft) {
      const parsed = estimateSchema.safeParse(serverDraft);
      if (parsed.success) estimate = parsed.data;
    }
    if (!estimate && args.estimate !== undefined && args.estimate !== null) {
      let plausible = false;
      try {
        plausible = JSON.stringify(args.estimate).length <= 20_000;
      } catch {
        plausible = false;
      }
      if (plausible) {
        const parsed = estimateSchema.safeParse(args.estimate);
        if (parsed.success) estimate = parsed.data;
      }
    }

    const payload: QuotePayload = {
      requestId,
      name: clip(args.name, 120),
      company: clipOpt(args.company, 120),
      phone: clip(args.phone, 40),
      email,
      job: {
        type: clip(args.job.type, 80),
        material: clipOpt(args.job.material, 80),
        desc: clip(args.job.desc, 4000),
        dims: clipOpt(args.job.dims, 200),
        timeline: clipOpt(args.job.timeline, 80),
        location: clipOpt(args.job.location, 300),
        compQuote: clipOpt(args.job.compQuote, 40),
        photoNames: args.job.photoNames
          ?.slice(0, 20)
          .map((n) => clip(n, 200))
          .filter(Boolean),
      },
      estimate,
      slot: clip(args.slot, 80),
    };

    await ctx.runMutation(internal.quotes.insertQuote, payload);

    if (!process.env.RESEND_API_KEY) {
      console.warn("RESEND_API_KEY is unset. Skipping quote emails.");
      return { ok: true, requestId };
    }

    // Manual sends (not the component's batch queue) so the callback slot can
    // ride along as an .ics invite. Test mode redirects to Resend's sink
    // address until RESEND_TEST_MODE=false.
    const testMode = process.env.RESEND_TEST_MODE !== "false";
    const sdk = new ResendSdk(process.env.RESEND_API_KEY);
    const ics = buildCallbackIcs({
      requestId,
      slot: payload.slot,
      name: payload.name,
      phone: payload.phone,
      jobType: payload.job.type,
      desc: payload.job.desc,
      attendeeEmail: OWNER_EMAIL,
    });
    const attachments = ics
      ? [
          {
            filename: ics.filename,
            content: ics.contentBase64,
            contentType: "text/calendar; method=REQUEST",
          },
        ]
      : undefined;

    const sendWithInvite = async (
      to: string,
      subject: string,
      html: string,
      text: string,
      replyTo?: string[],
    ) => {
      const realTo = testMode ? "delivered@resend.dev" : to;
      await resend.sendEmailManually(
        ctx,
        { from: FROM, to: realTo, subject },
        async (emailId) => {
          const { data, error } = await sdk.emails.send({
            from: FROM,
            to: realTo,
            subject,
            html,
            text,
            replyTo,
            attachments,
            headers: { "Idempotency-Key": emailId },
          });
          if (error) throw new Error(`Resend send failed: ${error.message}`);
          return data!.id;
        },
      );
    };

    try {
      const owner = buildOwnerEmail(payload);
      await sendWithInvite(
        OWNER_EMAIL,
        owner.subject,
        owner.html,
        owner.text,
        // The only user-supplied header value; validated as an email above.
        payload.email ? [payload.email] : undefined,
      );
    } catch (err) {
      console.error("Owner notification email failed", err);
    }

    if (payload.email) {
      try {
        const customer = buildCustomerEmail(payload);
        await sendWithInvite(
          payload.email,
          customer.subject,
          customer.html,
          customer.text,
        );
      } catch (err) {
        console.error("Customer confirmation email failed", err);
      }
    }

    return { ok: true, requestId };
  },
});
