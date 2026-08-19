import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

const VERIFIED_TTL_MS = 15 * 60 * 1000;

/**
 * Record that a session passed a Turnstile check. Lets submitQuote accept the
 * same session for the next 15 minutes without a second token.
 */
export const markVerified = internalMutation({
  args: { sessionId: v.string() },
  returns: v.null(),
  handler: async (ctx, { sessionId }) => {
    const existing = await ctx.db
      .query("verifiedSessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
      .collect();
    for (const row of existing) {
      await ctx.db.delete(row._id);
    }
    await ctx.db.insert("verifiedSessions", {
      sessionId,
      expiresAt: Date.now() + VERIFIED_TTL_MS,
    });
    return null;
  },
});

export const isVerified = internalQuery({
  args: { sessionId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { sessionId }) => {
    const rows = await ctx.db
      .query("verifiedSessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
      .collect();
    const now = Date.now();
    return rows.some((row) => row.expiresAt > now);
  },
});
