import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { requireAdmin } from "./auth";

/**
 * Database access for invoice PDF generation. Kept out of invoicePdfAction.ts
 * because that file runs in the Node runtime ("use node"), which may only
 * contain actions.
 */

/** Everything the renderer needs, gathered under the caller's session. */
export const loadForPdf = internalQuery({
  args: { token: v.string(), id: v.id("invoices") },
  handler: async (ctx, { token, id }) => {
    await requireAdmin(ctx, token);

    const invoice = await ctx.db.get(id);
    if (!invoice) throw new Error("That invoice no longer exists");
    const customer = await ctx.db.get(invoice.customerId);
    if (!customer) throw new Error("That invoice's customer no longer exists");

    return {
      previousStorageId: invoice.pdfStorageId,
      input: {
        number: invoice.number,
        issuedAt: invoice.issuedAt,
        dueAt: invoice.dueAt,
        terms: invoice.terms,
        jobPo: invoice.jobPo,
        customer: {
          name: customer.name,
          company: customer.company,
          contact: customer.contact,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
        },
        lineItems: invoice.lineItems,
        discountCents: invoice.discountCents,
        taxRateBasisPoints: invoice.taxRateBasisPoints,
        paymentsCents: invoice.paymentsCents,
        notes: invoice.notes,
      },
    };
  },
});

/** Point the invoice at the new file and delete the one it replaces. */
export const attachPdf = internalMutation({
  args: {
    id: v.id("invoices"),
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
