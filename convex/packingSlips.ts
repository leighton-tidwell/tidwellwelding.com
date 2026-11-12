import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  mutation,
  query,
} from "./_generated/server";
import { requireAdmin } from "./auth";
import { invoiceDateStamp } from "./invoices";

const lineItemValidator = v.object({
  partNumber: v.string(),
  description: v.string(),
  qty: v.number(),
  unit: v.string(),
});

/** PS-MMDDYY, with -2, -3 for more slips the same day, like invoice numbers. */
async function nextPackingSlipNumber(
  ctx: MutationCtx,
  shippedAt: number,
): Promise<string> {
  const base = `PS-${invoiceDateStamp(shippedAt)}`;
  const sameDay = await ctx.db
    .query("packingSlips")
    .withIndex("by_number", (q) =>
      q.gte("number", base).lt("number", `${base}~`),
    )
    .collect();
  if (sameDay.length === 0) return base;
  return `${base}-${sameDay.length + 1}`;
}

async function insertSlip(
  ctx: MutationCtx,
  customer: Doc<"customers">,
  extra: Partial<Doc<"packingSlips">> = {},
) {
  const now = Date.now();
  return await ctx.db.insert("packingSlips", {
    number: await nextPackingSlipNumber(ctx, now),
    customerId: customer._id,
    shipToName: customer.company ?? customer.name,
    shipToAddress: customer.address,
    shippedAt: now,
    lineItems: [],
    ...extra,
    createdAt: now,
    updatedAt: now,
  });
}

export const create = mutation({
  args: { token: v.string(), customerId: v.id("customers") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const customer = await ctx.db.get(args.customerId);
    if (!customer) throw new Error("That customer no longer exists");
    return await insertSlip(ctx, customer);
  },
});

/** Copies the customer, PO and lines from an invoice. Hourly lines are labour,
 * not something in the box, so they stay behind. */
export const createFromInvoice = mutation({
  args: { token: v.string(), invoiceId: v.id("invoices") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) throw new Error("That invoice no longer exists");
    const customer = await ctx.db.get(invoice.customerId);
    if (!customer) throw new Error("That invoice's customer no longer exists");
    return await insertSlip(ctx, customer, {
      invoiceId: invoice._id,
      poNumber: invoice.jobPo,
      lineItems: invoice.lineItems
        .filter((line) => line.unit !== "hr")
        .map((line) => ({
          partNumber: "",
          description: line.description,
          qty: line.qty,
          unit: line.unit,
        })),
    });
  },
});

export const update = mutation({
  args: {
    token: v.string(),
    id: v.id("packingSlips"),
    shipToName: v.optional(v.string()),
    shipToAddress: v.optional(v.string()),
    shippedAt: v.optional(v.number()),
    poNumber: v.optional(v.string()),
    jobProject: v.optional(v.string()),
    shippedVia: v.optional(v.string()),
    tracking: v.optional(v.string()),
    packages: v.optional(v.string()),
    lineItems: v.optional(v.array(lineItemValidator)),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { token, id, ...fields }) => {
    await requireAdmin(ctx, token);
    if (!(await ctx.db.get(id)))
      throw new Error("That packing slip no longer exists");
    for (const line of fields.lineItems ?? []) {
      if (!Number.isFinite(line.qty) || line.qty < 0) {
        throw new Error(`Line quantity must be zero or more, got ${line.qty}`);
      }
    }
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() });
  },
});

export const get = query({
  args: { token: v.string(), id: v.id("packingSlips") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const slip = await ctx.db.get(args.id);
    if (!slip) return null;
    const customer = await ctx.db.get(slip.customerId);
    const invoice = slip.invoiceId ? await ctx.db.get(slip.invoiceId) : null;
    return {
      ...slip,
      customerName: customer?.name ?? "(deleted customer)",
      invoice: invoice ? { _id: invoice._id, number: invoice.number } : null,
    };
  },
});

export const list = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const slips = await ctx.db
      .query("packingSlips")
      .withIndex("by_createdAt")
      .order("desc")
      .collect();
    const rows = [];
    for (const slip of slips) {
      const customer = await ctx.db.get(slip.customerId);
      rows.push({
        ...slip,
        customerName: customer?.name ?? "(deleted customer)",
      });
    }
    return rows;
  },
});

export const remove = mutation({
  args: { token: v.string(), id: v.id("packingSlips") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    await ctx.db.delete(args.id);
  },
});

/** Everything the renderer needs, gathered under the caller's session. */
export const loadForPdf = internalQuery({
  args: { token: v.string(), id: v.id("packingSlips") },
  handler: async (ctx, { token, id }) => {
    await requireAdmin(ctx, token);
    const slip = await ctx.db.get(id);
    if (!slip) throw new Error("That packing slip no longer exists");
    const customer = await ctx.db.get(slip.customerId);
    return {
      previousStorageId: slip.pdfStorageId,
      input: {
        number: slip.number,
        shippedAt: slip.shippedAt,
        customer: {
          name: customer?.company ?? customer?.name ?? "",
          contact: customer?.contact,
          phone: customer?.phone,
        },
        shipToName: slip.shipToName,
        shipToAddress: slip.shipToAddress,
        poNumber: slip.poNumber,
        jobProject: slip.jobProject,
        shippedVia: slip.shippedVia,
        tracking: slip.tracking,
        packages: slip.packages,
        lineItems: slip.lineItems,
        notes: slip.notes,
      },
    };
  },
});

/** Point the slip at the new file and delete the one it replaces. */
export const attachPdf = internalMutation({
  args: {
    id: v.id("packingSlips"),
    storageId: v.id("_storage"),
    previousStorageId: v.optional(v.id("_storage")),
  },
  returns: v.null(),
  handler: async (ctx, { id, storageId, previousStorageId }) => {
    await ctx.db.patch(id, { pdfStorageId: storageId, updatedAt: Date.now() });
    if (previousStorageId && previousStorageId !== storageId) {
      await ctx.storage.delete(previousStorageId);
    }
    return null;
  },
});
