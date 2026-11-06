import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, type QueryCtx, query } from "./_generated/server";
import { requireAdmin } from "./auth";
import { estimateSchema } from "./estimate";
import {
  DEFAULT_TAX_BASIS_POINTS,
  DEFAULT_TERMS,
  nextInvoiceNumber,
} from "./invoices";
import { readLaborRate } from "./settings";

/**
 * Admin-only read side of the quotes inbox.
 *
 * Deliberately a separate module from quotes.ts: that file is the public
 * submit path, and keeping the operator's read queries out of it means a
 * change here can never widen what an anonymous caller can reach. Every
 * function goes through requireAdmin, the same gate the invoice and customer
 * functions use.
 *
 * The two mutations at the bottom are the only writes here, and they exist so
 * the inbox is not a dead end: an operator can turn a request into a customer
 * and into an invoice without retyping the contact details or the AI's hours.
 * Both go through requireAdmin like everything else in this file.
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
  /** The invoice raised from this quote, so the list can show at a glance
   * which requests have already been turned into work. */
  invoiceNumber: v.optional(v.string()),
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

    // One pass over the invoices that came from a quote, rather than a lookup
    // per row: the inbox renders every quote, and a per-row query would be a
    // read per request on every page load.
    const numberByQuote = new Map<string, string>();
    for (const invoice of await ctx.db.query("invoices").collect()) {
      if (invoice.quoteId) numberByQuote.set(invoice.quoteId, invoice.number);
    }

    return rows.map((row) => {
      const estimate = readEstimate(row.estimate);
      const invoiceNumber = numberByQuote.get(row._id);
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
        ...(invoiceNumber === undefined ? {} : { invoiceNumber }),
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
  /** The saved customer this request was turned into, if it has been. Null
   * when it has not — or when the linked customer has since been deleted,
   * which reads the same way to the operator: there is nobody to open. */
  customer: v.union(
    v.object({ _id: v.id("customers"), name: v.string() }),
    v.null(),
  ),
  /** The invoice raised from this request, if one has been. */
  invoice: v.union(
    v.object({
      _id: v.id("invoices"),
      number: v.string(),
      status: v.string(),
    }),
    v.null(),
  ),
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

    const customer = row.customerId ? await ctx.db.get(row.customerId) : null;
    const invoice = await invoiceForQuote(ctx, row._id);

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
      customer: customer ? { _id: customer._id, name: customer.name } : null,
      invoice: invoice
        ? {
            _id: invoice._id,
            number: invoice.number,
            status: invoice.status,
          }
        : null,
    };
  },
});

/* --------------------------------------------------------- quote → work --- */

/** The invoice raised from a quote, or null. There is at most one: both
 * mutations below refuse to make a second. */
async function invoiceForQuote(
  ctx: QueryCtx,
  quoteId: Id<"quotes">,
): Promise<Doc<"invoices"> | null> {
  return await ctx.db
    .query("invoices")
    .withIndex("by_quote", (q) => q.eq("quoteId", quoteId))
    .first();
}

/** Trim and drop blanks, so a quote with an empty company does not save a
 * customer with an empty-string one. */
function optionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === "" ? undefined : trimmed;
}

/**
 * Save a quote request as a customer, and remember on the quote which customer
 * it became.
 *
 * Idempotent: a quote that already points at a live customer returns that one
 * rather than making a second. A same-name customer is never silently merged
 * or silently duplicated either — the mutation stops and reports the match so
 * the console can ask, because "Mike Reyes" who called in March and "Mike
 * Reyes" who called today are not reliably the same person. The operator then
 * either re-calls with that customer's id to link the two, or with
 * createAnyway to keep them apart.
 */
export const createCustomerFromQuote = mutation({
  args: {
    token: v.string(),
    id: v.id("quotes"),
    /** Link the quote to this existing customer instead of inserting one. */
    linkTo: v.optional(v.id("customers")),
    /** Insert a second customer under a name already in the book. */
    createAnyway: v.optional(v.boolean()),
  },
  returns: v.union(
    v.object({
      outcome: v.union(v.literal("linked"), v.literal("created")),
      customerId: v.id("customers"),
    }),
    /** No write happened. The console asks, then calls back with linkTo or
     * createAnyway. */
    v.object({
      outcome: v.literal("nameTaken"),
      customerId: v.id("customers"),
      customerName: v.string(),
    }),
  ),
  handler: async (ctx, { token, id, linkTo, createAnyway }) => {
    await requireAdmin(ctx, token);
    const quote = await ctx.db.get(id);
    if (!quote) throw new Error("That quote no longer exists");

    // Already linked, and the customer is still there: nothing to do. This is
    // what makes a double-click or a replayed request harmless.
    if (quote.customerId && (await ctx.db.get(quote.customerId))) {
      return { outcome: "linked" as const, customerId: quote.customerId };
    }

    if (linkTo !== undefined) {
      const chosen = await ctx.db.get(linkTo);
      if (!chosen) throw new Error("That customer no longer exists");
      await ctx.db.patch(id, { customerId: chosen._id });
      return { outcome: "linked" as const, customerId: chosen._id };
    }

    const name = quote.name.trim();
    if (name === "") throw new Error("That quote has no name to save");

    if (createAnyway !== true) {
      const existing = await ctx.db
        .query("customers")
        .withIndex("by_name", (q) => q.eq("name", name))
        .first();
      if (existing) {
        return {
          outcome: "nameTaken" as const,
          customerId: existing._id,
          customerName: existing.name,
        };
      }
    }

    const now = Date.now();
    const customerId = await ctx.db.insert("customers", {
      name,
      company: optionalText(quote.company),
      phone: optionalText(quote.phone),
      email: optionalText(quote.email),
      // Where this customer came from, so the billing record carries its own
      // provenance even if the quote is later cleared out.
      notes: `From quote request ${quote.requestId}`,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(id, { customerId });
    return { outcome: "created" as const, customerId };
  },
});

/**
 * Raise a draft invoice from a quote, seeded from the AI's estimate.
 *
 * The seeding rule: each estimate line {task, crew, hours} becomes one hourly
 * line — the task as the description, hours × crew as the quantity (two welders
 * for three hours is six billable hours), and the shop's labor rate as the
 * rate. Taxable, matching the editor's default for a new line. Nothing else is
 * read from the estimate: its dollar range is the model's own arithmetic, and
 * the only total that ever reaches the database is the one the server computes
 * from these lines.
 *
 * A quote with no usable draft still gets an invoice, with no lines. An empty
 * invoice the operator prices by hand beats refusing and leaving them to start
 * one from the Invoices tab and retype the customer.
 *
 * Also stamps the quote "quoted". The field has been "new" on every row since
 * it was added, which is why the inbox's status chips never appear; raising an
 * invoice is the one moment in this flow that unambiguously means the request
 * has been dealt with, so it is where the status earns its keep.
 */
export const createInvoiceFromQuote = mutation({
  args: { token: v.string(), id: v.id("quotes") },
  returns: v.id("invoices"),
  handler: async (ctx, { token, id }) => {
    await requireAdmin(ctx, token);
    const quote = await ctx.db.get(id);
    if (!quote) throw new Error("That quote no longer exists");

    // Idempotent for the same reason the customer mutation is.
    const already = await invoiceForQuote(ctx, id);
    if (already) return already._id;

    if (!quote.customerId) {
      throw new Error("Save this request as a customer first");
    }
    const customer = await ctx.db.get(quote.customerId);
    if (!customer) throw new Error("That quote's customer no longer exists");

    const estimate = readEstimate(quote.estimate);
    const laborRate = await readLaborRate(ctx);
    // No rate set yet: seed the lines anyway at zero. The descriptions and
    // hours are the part that is tedious to retype; a rate is one field.
    const rateCents = laborRate === null ? 0 : Math.round(laborRate * 100);

    const lineItems = (estimate?.lineItems ?? []).map((line) => ({
      qty: line.hours * line.crew,
      unit: "hr" as const,
      description: line.task,
      rateCents,
      taxable: true,
    }));

    const now = Date.now();
    const invoiceId = await ctx.db.insert("invoices", {
      number: await nextInvoiceNumber(ctx, now),
      status: "draft",
      customerId: quote.customerId,
      quoteId: id,
      jobPo: quote.requestId,
      issuedAt: now,
      dueAt: now,
      terms: DEFAULT_TERMS,
      lineItems,
      discountCents: 0,
      taxRateBasisPoints: DEFAULT_TAX_BASIS_POINTS,
      paymentsCents: 0,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(id, { status: "quoted" });
    return invoiceId;
  },
});
