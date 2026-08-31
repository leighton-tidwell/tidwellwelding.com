import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { type MutationCtx, mutation, query } from "./_generated/server";
import { requireAdmin } from "./auth";
import { computeInvoiceTotals } from "./invoiceMath";

/** Granbury, TX combined rate (6.25% state + 2% local), in basis points. */
export const DEFAULT_TAX_BASIS_POINTS = 825;
export const DEFAULT_TERMS = "Due upon receipt";

const lineItemValidator = v.object({
  qty: v.number(),
  unit: v.union(
    v.literal("hr"),
    v.literal("ea"),
    v.literal("ft"),
    v.literal("lb"),
    v.literal("lot"),
  ),
  description: v.string(),
  rateCents: v.number(),
  taxable: v.boolean(),
});

/**
 * Invoice numbers follow the owner's existing paper format: TSWS-MMDDYY, dated
 * in Central Time because that is the day he actually did the work. A second
 * invoice on the same day gets -2, a third -3, so the common one-a-day case
 * stays clean and a collision is impossible.
 */
export function invoiceDateStamp(issuedAt: number): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
  }).formatToParts(new Date(issuedAt));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("month")}${get("day")}${get("year")}`;
}

async function nextInvoiceNumber(
  ctx: MutationCtx,
  issuedAt: number,
): Promise<string> {
  const base = `TSWS-${invoiceDateStamp(issuedAt)}`;
  // Scan only same-day numbers; the by_number index keeps this cheap.
  const sameDay = await ctx.db
    .query("invoices")
    .withIndex("by_number", (q) =>
      q.gte("number", base).lt("number", `${base}~`),
    )
    .collect();
  if (sameDay.length === 0) return base;
  return `${base}-${sameDay.length + 1}`;
}

/** Guard every number that reaches the database. The math module also checks,
 * but rejecting at the boundary means bad data is never stored at all. */
function validateLineItems(lineItems: Doc<"invoices">["lineItems"]): void {
  for (const line of lineItems) {
    if (!Number.isFinite(line.qty) || line.qty < 0) {
      throw new Error(`Line quantity must be zero or more, got ${line.qty}`);
    }
    if (!Number.isInteger(line.rateCents) || line.rateCents < 0) {
      throw new Error(`Line rate must be whole cents, zero or more`);
    }
  }
}

function totalsFor(invoice: Doc<"invoices">) {
  return computeInvoiceTotals({
    lines: invoice.lineItems,
    discountCents: invoice.discountCents,
    taxRateBasisPoints: invoice.taxRateBasisPoints,
    paymentsCents: invoice.paymentsCents,
  });
}

export const create = mutation({
  args: {
    token: v.string(),
    customerId: v.id("customers"),
    issuedAt: v.optional(v.number()),
    jobPo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);

    const customer = await ctx.db.get(args.customerId);
    if (!customer) throw new Error("That customer no longer exists");

    const issuedAt = args.issuedAt ?? Date.now();
    const now = Date.now();
    return await ctx.db.insert("invoices", {
      number: await nextInvoiceNumber(ctx, issuedAt),
      status: "draft",
      customerId: args.customerId,
      jobPo: args.jobPo,
      issuedAt,
      // Terms are due-on-receipt, so today is the useful default. Eric can
      // move it before generating the PDF.
      dueAt: issuedAt,
      terms: DEFAULT_TERMS,
      lineItems: [],
      discountCents: 0,
      taxRateBasisPoints: DEFAULT_TAX_BASIS_POINTS,
      paymentsCents: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    token: v.string(),
    id: v.id("invoices"),
    customerId: v.optional(v.id("customers")),
    jobPo: v.optional(v.string()),
    issuedAt: v.optional(v.number()),
    dueAt: v.optional(v.number()),
    terms: v.optional(v.string()),
    lineItems: v.optional(v.array(lineItemValidator)),
    discountCents: v.optional(v.number()),
    taxRateBasisPoints: v.optional(v.number()),
    paymentsCents: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("That invoice no longer exists");

    if (args.lineItems !== undefined) validateLineItems(args.lineItems);
    for (const key of ["discountCents", "paymentsCents"] as const) {
      const value = args[key];
      if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
        throw new Error(`${key} must be whole cents, zero or more`);
      }
    }
    if (
      args.taxRateBasisPoints !== undefined &&
      (!Number.isFinite(args.taxRateBasisPoints) || args.taxRateBasisPoints < 0)
    ) {
      throw new Error("Tax rate must be zero or more");
    }
    if (args.customerId !== undefined && !(await ctx.db.get(args.customerId))) {
      throw new Error("That customer no longer exists");
    }

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    for (const key of [
      "customerId",
      "jobPo",
      "issuedAt",
      "dueAt",
      "terms",
      "lineItems",
      "discountCents",
      "taxRateBasisPoints",
      "paymentsCents",
      "notes",
    ] as const) {
      if (args[key] !== undefined) patch[key] = args[key];
    }
    await ctx.db.patch(args.id, patch);
  },
});

export const setStatus = mutation({
  args: {
    token: v.string(),
    id: v.id("invoices"),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("paid"),
      v.literal("void"),
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("That invoice no longer exists");
    await ctx.db.patch(args.id, { status: args.status, updatedAt: Date.now() });
  },
});

/** One read gives the editor everything: the invoice, its customer, and totals
 * computed on the server so the browser never decides what is owed. */
export const get = query({
  args: { token: v.string(), id: v.id("invoices") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const invoice = await ctx.db.get(args.id);
    if (!invoice) return null;
    const customer = await ctx.db.get(invoice.customerId);
    if (!customer) throw new Error("That invoice's customer no longer exists");
    return { ...invoice, customer, totals: totalsFor(invoice) };
  },
});

export const list = query({
  args: { token: v.string(), status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_createdAt")
      .order("desc")
      .collect();

    const rows = [];
    for (const invoice of invoices) {
      if (args.status && invoice.status !== args.status) continue;
      const customer = await ctx.db.get(invoice.customerId);
      rows.push({
        ...invoice,
        customerName: customer?.name ?? "(deleted customer)",
        totals: totalsFor(invoice),
      });
    }
    return rows;
  },
});

export const listForCustomer = query({
  args: { token: v.string(), customerId: v.id("customers") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
      .order("desc")
      .collect();
    return invoices.map((invoice) => ({ ...invoice, totals: totalsFor(invoice) }));
  },
});

export const remove = mutation({
  args: { token: v.string(), id: v.id("invoices") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    await ctx.db.delete(args.id);
  },
});
