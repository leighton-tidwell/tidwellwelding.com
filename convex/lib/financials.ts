import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { computeInvoiceTotals, type InvoiceTotals } from "../invoiceMath";

/**
 * The one place that decides whether a caller sees invoice money. Every query
 * that returns amounts outside the invoice editor goes through it, so gating
 * on `financials.read` is a change to this function and nothing else.
 */
export async function invoiceAmountsFor(
  _ctx: QueryCtx,
  _userId: Id<"adminUsers">,
  invoice: Doc<"invoices">,
): Promise<InvoiceTotals | null> {
  // TODO(rbac): financials.read. Until PR 1 lands every admin session is the
  // owner, who sees all money; then return null when the permission is absent.
  return computeInvoiceTotals({
    lines: invoice.lineItems,
    discountCents: invoice.discountCents,
    taxRateBasisPoints: invoice.taxRateBasisPoints,
    paymentsCents: invoice.paymentsCents,
  });
}
