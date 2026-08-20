import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

/** Settings the shop owner controls. Stored in the database rather than code
 * so the crew console can edit them later without a deploy, and so the values
 * never sit in the repo. */
export const LABOR_RATE_KEY = "laborRateHourly";

/** Eric's billed labor rate, or null when it has not been set. Callers must
 * handle null by falling back to public market anchors — there is deliberately
 * no rate hardcoded anywhere in this codebase. */
export const getLaborRate = internalQuery({
  args: {},
  returns: v.union(v.number(), v.null()),
  handler: async (ctx) => {
    const row = await ctx.db
      .query("shopSettings")
      .withIndex("by_key", (q) => q.eq("key", LABOR_RATE_KEY))
      .unique();
    const value = row?.numberValue;
    return typeof value === "number" && value > 0 ? value : null;
  },
});

/** Seed or update the rate. Run it with the value at the command line:
 *   npx convex run --prod settings:setLaborRate '{"rate": 000}'
 * The crew console will call a gated public wrapper once real auth exists. */
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
