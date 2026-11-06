import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireAdmin } from "./auth";
import { estimateSchema } from "./estimate";

/**
 * Admin-only read side of the quotes inbox.
 *
 * Deliberately a separate module from quotes.ts: that file is the public
 * submit path, and keeping the operator's read queries out of it means a
 * change here can never widen what an anonymous caller can reach. Every
 * function goes through requireAdmin, the same gate the invoice and customer
 * functions use.
 *
 * Read-only on purpose. Triaging (status changes, notes) is not in #19, and a
 * query module that cannot write is one less thing to audit.
 */

/** The AI draft as the console renders it. Stored as v.any(), so the shape is
 * enforced here at read time — a row written by an older estimator, or one
 * whose draft was truncated, comes back as null instead of crashing the page. */
const estimateValidator = v.object({
  title: v.string(),
  summary: v.string(),
  lineItems: v.array(
    v.object({ task: v.string(), crew: v.number(), hours: v.number() }),
  ),
  hoursLow: v.number(),
  hoursHigh: v.number(),
  dollarsLow: v.number(),
  dollarsHigh: v.number(),
  confidence: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
  questions: v.array(v.string()),
});

/** snake_case on the wire from the model, camelCase everywhere in the app. */
function readEstimate(raw: unknown): typeof estimateValidator.type | null {
  if (raw === undefined || raw === null) return null;
  const parsed = estimateSchema.safeParse(raw);
  if (!parsed.success) return null;
  const e = parsed.data;
  return {
    title: e.title,
    summary: e.summary,
    lineItems: e.line_items.map((line) => ({
      task: line.task,
      crew: line.crew,
      hours: line.hours,
    })),
    hoursLow: e.hours_low,
    hoursHigh: e.hours_high,
    dollarsLow: e.dollars_low,
    dollarsHigh: e.dollars_high,
    confidence: e.confidence,
    questions: e.questions,
  };
}

const summaryValidator = v.object({
  _id: v.id("quotes"),
  requestId: v.string(),
  name: v.string(),
  company: v.optional(v.string()),
  phone: v.string(),
  email: v.optional(v.string()),
  jobType: v.string(),
  jobDesc: v.string(),
  slot: v.string(),
  status: v.string(),
  createdAt: v.number(),
  /** Attachment count, so the list can show a paperclip without loading blobs. */
  fileCount: v.number(),
  /** Absent when the row carries no usable draft. */
  dollarsLow: v.optional(v.number()),
  dollarsHigh: v.optional(v.number()),
});

/**
 * Newest first — an inbox is read from the top. Unfiltered on purpose: the
 * console tallies the statuses itself so the filter chips can show counts for
 * everything, not just the slice currently on screen.
 */
export const list = query({
  args: { token: v.string() },
  returns: v.array(summaryValidator),
  handler: async (ctx, { token }) => {
    await requireAdmin(ctx, token);
    const rows = await ctx.db
      .query("quotes")
      .withIndex("by_createdAt")
      .order("desc")
      .collect();

    return rows.map((row) => {
      const estimate = readEstimate(row.estimate);
      return {
        _id: row._id,
        requestId: row.requestId,
        name: row.name,
        company: row.company,
        phone: row.phone,
        email: row.email,
        jobType: row.job.type,
        jobDesc: row.job.desc,
        slot: row.slot,
        status: row.status,
        createdAt: row.createdAt,
        fileCount: row.files?.length ?? 0,
        ...(estimate
          ? {
              dollarsLow: estimate.dollarsLow,
              dollarsHigh: estimate.dollarsHigh,
            }
          : {}),
      };
    });
  },
});

const detailValidator = v.object({
  _id: v.id("quotes"),
  requestId: v.string(),
  name: v.string(),
  company: v.optional(v.string()),
  phone: v.string(),
  email: v.optional(v.string()),
  job: v.object({
    type: v.string(),
    material: v.optional(v.string()),
    desc: v.string(),
    dims: v.optional(v.string()),
    thickness: v.optional(v.string()),
    quantity: v.optional(v.string()),
    timeline: v.optional(v.string()),
    location: v.optional(v.string()),
    compQuote: v.optional(v.string()),
    /** Names the customer's browser listed. Rows from before #17 have only
     * these — no stored blob to download. */
    photoNames: v.optional(v.array(v.string())),
  }),
  files: v.array(
    v.object({
      storageId: v.id("_storage"),
      name: v.string(),
      contentType: v.string(),
      size: v.number(),
      competitor: v.boolean(),
      /** null when the blob is gone from storage; the row still lists it. */
      url: v.union(v.string(), v.null()),
    }),
  ),
  estimate: v.union(estimateValidator, v.null()),
  slot: v.string(),
  status: v.string(),
  createdAt: v.number(),
});

/**
 * One quote with download links for its uploads. The links come from
 * ctx.storage.getUrl behind requireAdmin, so an attachment is never reachable
 * without a live operator session.
 *
 * `files` is always an array. A quote submitted before #17 simply has none,
 * which is an ordinary empty inbox item, not an error.
 */
export const get = query({
  args: { token: v.string(), id: v.id("quotes") },
  returns: v.union(detailValidator, v.null()),
  handler: async (ctx, { token, id }) => {
    await requireAdmin(ctx, token);
    const row = await ctx.db.get(id);
    if (!row) return null;

    const files = [];
    for (const file of row.files ?? []) {
      files.push({
        storageId: file.storageId,
        name: file.name,
        contentType: file.contentType,
        size: file.size,
        competitor: file.kind === "competitor",
        url: await ctx.storage.getUrl(file.storageId),
      });
    }

    return {
      _id: row._id,
      requestId: row.requestId,
      name: row.name,
      company: row.company,
      phone: row.phone,
      email: row.email,
      job: row.job,
      files,
      estimate: readEstimate(row.estimate),
      slot: row.slot,
      status: row.status,
      createdAt: row.createdAt,
    };
  },
});
