import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";
import { requireAdmin } from "./auth";

/** Settings the shop owner controls. Stored in the database rather than code
 * so the admin console can edit them without a deploy, and so the values
 * never sit in the repo. */
export const LABOR_RATE_KEY = "laborRateHourly";

/** The one place the rate is read out of the table. Shared by the gated and
 * internal readers, and by any mutation that needs to price a line, so they
 * can never disagree about what counts as a usable rate. Returns dollars per
 * hour, or null when the owner has not set one. */
export async function readLaborRate(ctx: QueryCtx): Promise<number | null> {
  const row = await ctx.db
    .query("shopSettings")
    .withIndex("by_key", (q) => q.eq("key", LABOR_RATE_KEY))
    .unique();
  const value = row?.numberValue;
  return typeof value === "number" && value > 0 ? value : null;
}

/** Eric's billed labor rate, or null when it has not been set. Callers must
 * handle null by falling back to public market anchors — there is deliberately
 * no rate hardcoded anywhere in this codebase. */
export const getLaborRate = internalQuery({
  args: {},
  returns: v.union(v.number(), v.null()),
  handler: async (ctx) => await readLaborRate(ctx),
});

/** Seed or update the rate. Run it with the value at the command line:
 *   npx convex run --prod settings:setLaborRate '{"rate": 000}'
 * The admin console uses the gated wrappers below. */
export const setLaborRate = internalMutation({
  args: { rate: v.number() },
  returns: v.null(),
  handler: async (ctx, { rate }) => {
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error("Rate must be a positive number.");
    }
    const existing = await ctx.db
      .query("shopSettings")
      .withIndex("by_key", (q) => q.eq("key", LABOR_RATE_KEY))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        numberValue: rate,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("shopSettings", {
        key: LABOR_RATE_KEY,
        numberValue: rate,
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});

/**
 * Session-gated wrappers for the admin console. The rate stays invisible to the
 * public site — only a signed-in owner can read or change it, and it is used to
 * prefill hourly invoice lines.
 */
export const getLaborRateAdmin = query({
  args: { token: v.string() },
  returns: v.union(v.number(), v.null()),
  handler: async (ctx, { token }) => {
    await requireAdmin(ctx, token);
    return await readLaborRate(ctx);
  },
});

export const setLaborRateAdmin = mutation({
  args: { token: v.string(), rate: v.number() },
  returns: v.null(),
  handler: async (ctx, { token, rate }) => {
    await requireAdmin(ctx, token);
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error("Rate must be a positive number.");
    }
    const existing = await ctx.db
      .query("shopSettings")
      .withIndex("by_key", (q) => q.eq("key", LABOR_RATE_KEY))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        numberValue: rate,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("shopSettings", {
        key: LABOR_RATE_KEY,
        numberValue: rate,
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});
