"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { renderInvoicePdf } from "./invoicePdf";

/**
 * Generates the invoice PDF and stores it in Convex file storage, returning a
 * URL the browser can download. Actions cannot touch the database, so the read
 * and the write live in invoicePdfData.ts and are called through the runtime.
 *
 * pdf-lib itself is pure JS and does not require Node, but this file is marked
 * "use node" so PDF work never competes with the default runtime's limits.
 */
export const generate = action({
  args: { token: v.string(), id: v.id("invoices") },
  returns: v.string(),
  handler: async (ctx, { token, id }): Promise<string> => {
    // requireAdmin runs inside the query, so an unauthenticated caller is
    // rejected before any rendering work happens.
    const data = await ctx.runQuery(internal.invoicePdfData.loadForPdf, {
      token,
      id,
    });

    const bytes = await renderInvoicePdf(data.input);

    const storageId = await ctx.storage.store(
      new Blob([bytes as BlobPart], { type: "application/pdf" }),
    );

    await ctx.runMutation(internal.invoicePdfData.attachPdf, {
      id,
      storageId,
      previousStorageId: data.previousStorageId,
    });

    const url = await ctx.storage.getUrl(storageId);
    if (!url) throw new Error("The PDF was stored but produced no URL");
    return url;
  },
});
