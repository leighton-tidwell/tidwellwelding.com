import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./auth";
import { computeInvoiceTotals } from "./invoiceMath";

/** Trim and reject empty required text so a blank name cannot be saved. */
function requireText(value: string, label: string): string {
  const trimmed = value.trim();
  if (trimmed === "") throw new Error(`A ${label} is required`);
  return trimmed;
}

function optionalText(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

export const create = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    company: v.optional(v.string()),
    contact: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const now = Date.now();
    return await ctx.db.insert("customers", {
      name: requireText(args.name, "customer name"),
      company: optionalText(args.company),
      contact: optionalText(args.contact),
      email: optionalText(args.email),
      phone: optionalText(args.phone),
      address: optionalText(args.address),
      notes: optionalText(args.notes),
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    token: v.string(),
    id: v.id("customers"),
    name: v.optional(v.string()),
    company: v.optional(v.string()),
    contact: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("That customer no longer exists");

    // Only fields actually supplied are touched; omitting a field leaves it be.
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = requireText(args.name, "customer name");
    for (const key of ["company", "contact", "email", "phone", "address", "notes"] as const) {
      if (args[key] !== undefined) patch[key] = optionalText(args[key]);
    }
    await ctx.db.patch(args.id, patch);
  },
});

export const get = query({
  args: { token: v.string(), id: v.id("customers") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    return await ctx.db.get(args.id);
  },
});

export const list = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    return await ctx.db.query("customers").withIndex("by_name").collect();
  },
});

/** A customer plus what they have actually been billed. Voided invoices are
 * counted in the list but never in the money, or the total would lie. */
export const summary = query({
  args: { token: v.string(), id: v.id("customers") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const customer = await ctx.db.get(args.id);
    if (!customer) throw new Error("That customer no longer exists");

    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_customer", (q) => q.eq("customerId", args.id))
      .collect();

    let billedCents = 0;
    for (const invoice of invoices) {
      if (invoice.status === "void") continue;
      billedCents += computeInvoiceTotals({
        lines: invoice.lineItems,
        discountCents: invoice.discountCents,
        taxRateBasisPoints: invoice.taxRateBasisPoints,
        paymentsCents: invoice.paymentsCents,
      }).totalCents;
    }

    return { customer, invoiceCount: invoices.length, billedCents };
  },
});

export const remove = mutation({
  args: { token: v.string(), id: v.id("customers") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    await ctx.db.delete(args.id);
  },
});
