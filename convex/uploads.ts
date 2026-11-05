import { v } from "convex/values";
import { internalMutation, internalQuery, mutation } from "./_generated/server";
import { assertSessionId, limitUploadUrl } from "./rateLimits";

/** One-shot upload URL for a quote photo or CNC drawing. Rate limited per
 * session and globally, like every other public quote endpoint. */
export const generateUploadUrl = mutation({
  args: { sessionId: v.string() },
  returns: v.string(),
  handler: async (ctx, { sessionId }) => {
    assertSessionId(sessionId);
    await limitUploadUrl(ctx, sessionId);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Size and content type the storage layer recorded for an upload. */
export const fileMeta = internalQuery({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const doc = await ctx.db.system.get(storageId);
    return doc ? { size: doc.size, contentType: doc.contentType ?? "" } : null;
  },
});

/** Drop uploads a quote refused so they do not sit in storage. */
export const discardFiles = internalMutation({
  args: { storageIds: v.array(v.id("_storage")) },
  returns: v.null(),
  handler: async (ctx, { storageIds }) => {
    for (const id of storageIds) {
      if (await ctx.db.system.get(id)) await ctx.storage.delete(id);
    }
    return null;
  },
});
