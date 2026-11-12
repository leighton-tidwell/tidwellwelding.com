"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { LOGO_BYTES } from "./invoiceLogo";
import { renderPackingSlipPdf } from "./packingSlipPdf";

/** Same flow as invoicePdfAction: render, store, swap, return a URL. */
export const generate = action({
  args: { token: v.string(), id: v.id("packingSlips") },
  returns: v.string(),
  handler: async (ctx, { token, id }): Promise<string> => {
    const data = await ctx.runQuery(internal.packingSlips.loadForPdf, {
      token,
      id,
    });
    const bytes = await renderPackingSlipPdf({
      ...data.input,
      logoPngBytes: LOGO_BYTES,
    });
    const storageId = await ctx.storage.store(
      new Blob([bytes as BlobPart], { type: "application/pdf" }),
    );
    await ctx.runMutation(internal.packingSlips.attachPdf, {
      id,
      storageId,
      previousStorageId: data.previousStorageId,
    });
    const url = await ctx.storage.getUrl(storageId);
    if (!url) throw new Error("The PDF was stored but produced no URL");
    return url;
  },
});
