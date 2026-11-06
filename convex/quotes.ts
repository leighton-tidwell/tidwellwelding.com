import { Resend } from "@convex-dev/resend";
import { ConvexError, type ObjectType, v } from "convex/values";
import { Resend as ResendSdk } from "resend";
import { components, internal } from "./_generated/api";
import { type ActionCtx, action, internalMutation } from "./_generated/server";
import {
  buildCustomerEmail,
  buildOwnerEmail,
  isEmail,
  type QuotePayload,
} from "./emailTemplates";
import { type Estimate, estimateSchema, rejectOversize } from "./estimate";
import { buildCallbackIcs } from "./ics";
import { assertSessionId, limitQuoteSubmit } from "./rateLimits";
import { verifyTurnstile } from "./turnstile";
import {
  MAX_UPLOAD_FILES,
  rejectCompetitorFile,
  rejectFile,
} from "./uploadRules";

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
  thickness: v.optional(v.string()),
  quantity: v.optional(v.string()),
  timeline: v.optional(v.string()),
  location: v.optional(v.string()),
  compQuote: v.optional(v.string()),
  photoNames: v.optional(v.array(v.string())),
});

/** The same job, as it sits on a failed attempt: every field optional,
 * because the attempt failed and any of them may be missing or malformed. */
const failedJobValidator = v.object({
  type: v.optional(v.string()),
  material: v.optional(v.string()),
  desc: v.optional(v.string()),
  dims: v.optional(v.string()),
  thickness: v.optional(v.string()),
  quantity: v.optional(v.string()),
  timeline: v.optional(v.string()),
  location: v.optional(v.string()),
  compQuote: v.optional(v.string()),
  photoNames: v.optional(v.array(v.string())),
});

/** A file as it sits on the quote row. */
const storedFileValidator = v.object({
  storageId: v.id("_storage"),
  name: v.string(),
  contentType: v.string(),
  size: v.number(),
  kind: v.optional(v.literal("competitor")),
});
type StoredFile = typeof storedFileValidator.type;

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
    files: v.optional(v.array(storedFileValidator)),
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

const submitArgs = {
  requestId: v.optional(v.string()),
  name: v.string(),
  company: v.optional(v.string()),
  phone: v.string(),
  email: v.optional(v.string()),
  job: jobValidator,
  // Uploaded via uploads.generateUploadUrl; checked and described here.
  // kind "competitor" is the other shop's quote (one photo or PDF).
  files: v.optional(
    v.array(
      v.object({
        storageId: v.id("_storage"),
        name: v.string(),
        kind: v.optional(v.literal("competitor")),
      }),
    ),
  ),
  estimate: v.optional(v.any()),
  slot: v.string(),
  sessionId: v.string(),
  turnstileToken: v.optional(v.string()),
};

type SubmitArgs = ObjectType<typeof submitArgs>;

/** Rows in `failedQuotes` are pruned this long after they land: contact
 * details from people who never completed a submission do not sit here
 * indefinitely. */
const FAILED_QUOTE_TTL_MS = 90 * 24 * 60 * 60 * 1000;
/** Bounded so one submission never pays for an unbounded sweep. */
const PRUNE_BATCH = 50;

export const insertFailedQuote = internalMutation({
  args: {
    requestId: v.optional(v.string()),
    name: v.optional(v.string()),
    company: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    job: v.optional(failedJobValidator),
    slot: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    reason: v.string(),
    tokenPresent: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("failedQuotes", { ...args, createdAt: now });
    const stale = await ctx.db
      .query("failedQuotes")
      .withIndex("by_createdAt", (q) =>
        q.lt("createdAt", now - FAILED_QUOTE_TTL_MS),
      )
      .take(PRUNE_BATCH);
    for (const row of stale) {
      await ctx.db.delete(row._id);
    }
    return null;
  },
});

/** The message a ConvexError carries, else the error's own text. */
function reasonFor(err: unknown): string {
  if (err instanceof ConvexError && typeof err.data === "string") {
    return err.data;
  }
  return err instanceof Error ? err.message : String(err);
}

/**
 * A submission that did not persist must still leave a callable lead rather
 * than vanishing. Logs which check rejected it and whether a token was sent,
 * then records the attempt — but only when there is some way to reach the
 * person, since contact details with no contact method serve nobody.
 *
 * Never throws: the visitor's own error is the one that matters.
 */
async function recordFailedQuote(
  ctx: ActionCtx,
  args: SubmitArgs,
  err: unknown,
): Promise<void> {
  const reason = reasonFor(err);
  const phone = clipOpt(args.phone, 40);
  const email = clipOpt(args.email, 200);
  const reachable =
    (phone?.replace(/\D/g, "").length ?? 0) >= 10 ||
    (!!email && isEmail(email));
  const tokenPresent = !!args.turnstileToken;
  console.error("submitQuote rejected the attempt", {
    reason,
    tokenPresent,
    reachable,
    sessionId: clipOpt(args.sessionId, 80),
  });
  if (!reachable) return;
  try {
    // Everything is clipped on the way in: the attempt may be the oversize
    // one that was just rejected.
    await ctx.runMutation(internal.quotes.insertFailedQuote, {
      requestId: clipOpt(args.requestId, 40),
      name: clipOpt(args.name, 120),
      company: clipOpt(args.company, 120),
      phone,
      email,
      job: {
        type: clipOpt(args.job.type, 80),
        material: clipOpt(args.job.material, 80),
        desc: clipOpt(args.job.desc, 4000),
        dims: clipOpt(args.job.dims, 200),
        thickness: clipOpt(args.job.thickness, 40),
        quantity: clipOpt(args.job.quantity, 40),
        timeline: clipOpt(args.job.timeline, 80),
        location: clipOpt(args.job.location, 300),
        compQuote: clipOpt(args.job.compQuote, 40),
        photoNames: args.job.photoNames
          ?.slice(0, 20)
          .map((n) => clip(n, 200))
          .filter(Boolean),
      },
      slot: clipOpt(args.slot, 80),
      sessionId: clipOpt(args.sessionId, 80),
      reason: clip(reason, 300),
      tokenPresent,
    });
  } catch (saveErr) {
    console.error("Recording the failed quote attempt failed", saveErr);
  }
}

/**
 * Delete the uploads this attempt pushed to storage, including the
 * competitor quote. Only safe while no quote row references them.
 *
 * Never throws: the visitor's own error is the one that matters.
 */
async function discardUploads(ctx: ActionCtx, args: SubmitArgs): Promise<void> {
  const storageIds = (args.files ?? []).map((f) => f.storageId);
  if (!storageIds.length) return;
  try {
    await ctx.runMutation(internal.uploads.discardFiles, { storageIds });
  } catch (err) {
    console.error("Discarding the uploads of a rejected quote failed", err);
  }
}

/** Whether the quote row has landed. Until it has, the uploaded files belong
 * to nothing and a failure must delete them; once it has, the row owns them
 * and deleting would strip Eric's own request of its photos. Set next to the
 * insert, read only in the handler's catch. */
type UploadOwner = { byQuote: boolean };

export const submitQuote = action({
  args: submitArgs,
  handler: async (ctx, args): Promise<{ ok: boolean; requestId: string }> => {
    // The browser uploads its files before it calls this action, so a
    // submission rejected below leaves them with nothing pointing at them.
    const owner: UploadOwner = { byQuote: false };
    try {
      return await runSubmit(ctx, args, owner);
    } catch (err) {
      // Any failure at all, anticipated or not: the orphaned uploads go and
      // the lead is kept, both before the error goes back to the visitor.
      if (!owner.byQuote) await discardUploads(ctx, args);
      await recordFailedQuote(ctx, args, err);
      throw err;
    }
  },
});

/** The submission proper. Throws a ConvexError carrying the message the
 * visitor is shown; nothing here persists a quote until every check has
 * passed. */
async function runSubmit(
  ctx: ActionCtx,
  args: SubmitArgs,
  owner: UploadOwner,
): Promise<{ ok: boolean; requestId: string }> {
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
    [args.job.thickness, 100],
    [args.job.quantity, 100],
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

  // Uploaded files: photos for every job, drawings and CAD files for CNC,
  // plus one competitor quote (photo or PDF). One bad file refuses the set.
  const uploads = args.files ?? [];
  const files: StoredFile[] = [];
  const fileLinks: { name: string; url: string }[] = [];
  let competitorLink: { name: string; url: string } | undefined;
  if (uploads.length) {
    const competitorCount = uploads.filter(
      (f) => f.kind === "competitor",
    ).length;
    let problem =
      uploads.length - competitorCount > MAX_UPLOAD_FILES
        ? `Send ${MAX_UPLOAD_FILES} files or fewer.`
        : competitorCount > 1
          ? "Send one competitor quote."
          : null;
    for (const upload of uploads) {
      if (problem) break;
      const name = clip(upload.name, 200);
      const meta = await ctx.runQuery(internal.uploads.fileMeta, {
        storageId: upload.storageId,
      });
      const url = meta ? await ctx.storage.getUrl(upload.storageId) : null;
      if (!meta || !url || !name) {
        problem = "A file did not upload. Try again.";
        break;
      }
      const file = { name, type: meta.contentType, size: meta.size };
      problem =
        upload.kind === "competitor"
          ? rejectCompetitorFile(file)
          : rejectFile(args.job.type, file);
      files.push({
        storageId: upload.storageId,
        name,
        contentType: meta.contentType,
        size: meta.size,
        ...(upload.kind ? { kind: upload.kind } : {}),
      });
      if (upload.kind === "competitor") competitorLink = { name, url };
      else fileLinks.push({ name, url });
    }
    // Throwing is enough: the handler deletes every upload of a rejected
    // attempt, whichever check refused it.
    if (problem) throw new ConvexError(problem);
  }

  const requestId =
    args.requestId && /^Q-\d{4}-\d{3,4}$/.test(args.requestId)
      ? args.requestId
      : makeRequestId();

  // Prefer the server-side draft for this job type (it keeps the dollars a
  // low-confidence customer never saw); fall back to validating whatever the client sent.
  let estimate: Estimate | undefined;
  const serverDraft = await ctx.runQuery(
    internal.estimate.latestDraftForSession,
    { sessionId: args.sessionId, jobType: args.job.type },
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
      thickness: clipOpt(args.job.thickness, 40),
      quantity: clipOpt(args.job.quantity, 40),
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

  await ctx.runMutation(internal.quotes.insertQuote, {
    ...payload,
    files: files.length ? files : undefined,
  });
  // The row references the uploads now. Nothing may delete them after this.
  owner.byQuote = true;
  // Download links go in Eric's email only; the row keeps the storage ids.
  if (fileLinks.length) payload.files = fileLinks;
  if (competitorLink) payload.competitorFile = competitorLink;

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
        if (!data) throw new Error("Resend send returned no data");
        return data.id;
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
}
