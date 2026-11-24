import { ConvexError, v } from "convex/values";
import { Resend as ResendSdk } from "resend";
import { SITE_URL } from "../src/lib/business";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  type MutationCtx,
  mutation,
  query,
} from "./_generated/server";
import {
  burnSetupTokens,
  clearCredentials,
  mintSetupToken,
  revokeSessions,
  SETUP_TOKEN_TTL_MS,
} from "./auth";
import { esc, isEmail } from "./emailTemplates";
import {
  type Access,
  isInTeam,
  requireAccess,
  requireSession,
  roleOf,
  statusOf,
} from "./lib/access";
import {
  outranks,
  overrideRefusal,
  permissionValidator,
  type Role,
  roleChangeRefusal,
  roleRank,
  roleValidator,
} from "./lib/permissions";
import { FROM, resend } from "./quotes";

/**
 * People: accounts, roles, supervisors and per-user overrides. Every change
 * here writes auditLog. Rules about who may do what are in lib/permissions.ts;
 * this file applies them to rows.
 */

async function audit(
  ctx: MutationCtx,
  actor: Access | null,
  action: string,
  targetId: Id<"adminUsers">,
  before?: unknown,
  after?: unknown,
) {
  await ctx.db.insert("auditLog", {
    actorId: actor?.user._id,
    action,
    targetId,
    before,
    after,
    at: Date.now(),
  });
}

/** Load someone the actor is allowed to act on: not themselves, and ranked
 * below them. */
async function requireSubordinate(
  ctx: MutationCtx,
  actor: Access,
  userId: Id<"adminUsers">,
): Promise<Doc<"adminUsers">> {
  const target = await ctx.db.get(userId);
  if (!target) throw new ConvexError("That person no longer exists.");
  if (target._id === actor.user._id) {
    throw new ConvexError("You cannot change your own account here.");
  }
  if (!outranks(actor.role, roleOf(target))) {
    throw new ConvexError("You can only change people below you.");
  }
  return target;
}

/** The signed-in user, for the console to decide what to show. Null rather
 * than an error once the session is gone (signed out, deactivated, role
 * changed), so the console can drop back to the sign-in screen. */
export const me = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const access = await requireSession(ctx, token).catch(() => null);
    if (!access) return null;
    return {
      id: access.user._id,
      email: access.user.email,
      name: access.user.name ?? null,
      role: access.role,
      permissions: [...access.permissions].sort(),
    };
  },
});

export const list = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireAccess(ctx, token, "users.read");
    const users = await ctx.db.query("adminUsers").collect();
    const now = Date.now();
    return await Promise.all(
      users.map(async (u) => {
        const overrides = await ctx.db
          .query("permissionOverrides")
          .withIndex("by_user", (q) => q.eq("userId", u._id))
          .collect();
        const tokens = await ctx.db
          .query("setupTokens")
          .withIndex("by_user", (q) => q.eq("userId", u._id))
          .collect();
        const pending = tokens.find(
          (t) => t.usedAt === undefined && t.expiresAt > now,
        );
        return {
          id: u._id,
          email: u.email,
          name: u.name ?? null,
          title: u.title ?? null,
          role: roleOf(u),
          status: statusOf(u),
          supervisorId: u.supervisorId ?? null,
          linkExpiresAt: pending?.expiresAt ?? null,
          overrides: overrides
            .filter((o) => o.expiresAt === undefined || o.expiresAt > now)
            .map((o) => ({
              id: o._id,
              permission: o.permission,
              effect: o.effect,
              reason: o.reason,
              expiresAt: o.expiresAt ?? null,
            })),
        };
      }),
    );
  },
});

/* ------------------------------------------------------------- invites --- */

const inviteArgs = {
  token: v.string(),
  email: v.string(),
  name: v.string(),
  role: roleValidator,
  title: v.optional(v.string()),
  phone: v.optional(v.string()),
  supervisorId: v.optional(v.id("adminUsers")),
  hiredAt: v.optional(v.number()),
};

type Link = {
  userId: Id<"adminUsers">;
  email: string;
  name: string;
  link: string;
  purpose: "invite" | "reset";
};

export const prepareInvite = internalMutation({
  args: inviteArgs,
  handler: async (ctx, { token, ...args }): Promise<Link> => {
    const actor = await requireAccess(ctx, token, "users.invite");
    const email = args.email.trim().toLowerCase();
    const name = args.name.trim();
    if (!isEmail(email)) throw new ConvexError("Enter a valid email address.");
    if (!name) throw new ConvexError("Enter their name.");
    // Inviting straight into a role above employee is assigning a role.
    if (args.role !== "employee") {
      const refusal = roleChangeRefusal(actor, null, args.role);
      if (refusal) throw new ConvexError(refusal);
    }
    const existing = await ctx.db
      .query("adminUsers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (existing) throw new ConvexError("Someone already has that email.");
    if (args.supervisorId) {
      if (!actor.permissions.has("supervision.manage")) {
        throw new ConvexError("You cannot set supervisors.");
      }
      await assertSupervisor(ctx, args.supervisorId);
    }

    const profile = { ...args, email, name };
    const userId = await ctx.db.insert("adminUsers", {
      ...profile,
      status: "invited",
      createdAt: Date.now(),
    });
    await audit(ctx, actor, "user.invite", userId, undefined, profile);
    const secret = await mintSetupToken(ctx, userId, "invite");
    return { userId, email, name, link: setupLink(secret), purpose: "invite" };
  },
});

/**
 * Re-send an invite to someone who has not set a password yet, or send a reset
 * to someone who has. Either way the older link stops working. A reset wipes
 * the old password and signs them out everywhere at once.
 */
export const prepareLink = internalMutation({
  args: { token: v.string(), userId: v.id("adminUsers") },
  handler: async (ctx, { token, userId }): Promise<Link> => {
    const actor = await requireAccess(ctx, token, "users.invite");
    const target = await requireSubordinate(ctx, actor, userId);
    const status = statusOf(target);
    if (status === "deactivated") {
      throw new ConvexError("Reactivate them before sending a link.");
    }
    // A reset wipes a working password, which is managing the account.
    if (status === "active" && !actor.permissions.has("users.manage")) {
      throw new ConvexError("You do not have access to that.");
    }
    const purpose = status === "invited" ? "invite" : "reset";
    if (purpose === "reset") await clearCredentials(ctx, userId);
    const secret = await mintSetupToken(ctx, userId, purpose);
    await audit(ctx, actor, `user.${purpose}.send`, userId);
    return {
      userId,
      email: target.email,
      name: target.name ?? target.email,
      link: setupLink(secret),
      purpose,
    };
  },
});

function setupLink(secret: string): string {
  // ADMIN_SITE_URL points local stacks at their own web server.
  const base = process.env.ADMIN_SITE_URL ?? SITE_URL;
  return `${base}/admin/set-password?token=${secret}`;
}

/** Email the link. Returns false when email is not configured, so the caller
 * can say so instead of claiming it went out. */
async function sendLinkEmail(
  ctx: Parameters<typeof resend.sendEmailManually>[0],
  link: Link,
): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY is unset. Skipping the account email.");
    return false;
  }
  const subject =
    link.purpose === "invite"
      ? "Set up your TSWS admin account"
      : "Reset your TSWS admin password";
  const lead =
    link.purpose === "invite"
      ? "You have been given an account on the TSWS admin console."
      : "A password reset was requested for your TSWS admin account.";
  const hours = SETUP_TOKEN_TTL_MS / (60 * 60 * 1000);
  const text = `Hi ${link.name},\n\n${lead} Choose a password here:\n\n${link.link}\n\nThe link works once and expires in ${hours} hours.`;
  const html = `<p>Hi ${esc(link.name)},</p><p>${lead} Choose a password here:</p><p><a href="${esc(link.link)}">${esc(link.link)}</a></p><p>The link works once and expires in ${hours} hours.</p>`;
  // Test mode redirects to Resend's sink until RESEND_TEST_MODE=false, the
  // same as the quote emails.
  const to =
    process.env.RESEND_TEST_MODE !== "false"
      ? "delivered@resend.dev"
      : link.email;
  const sdk = new ResendSdk(process.env.RESEND_API_KEY);
  await resend.sendEmailManually(
    ctx,
    { from: FROM, to, subject },
    async (emailId) => {
      const { data, error } = await sdk.emails.send({
        from: FROM,
        to,
        subject,
        html,
        text,
        headers: { "Idempotency-Key": emailId },
      });
      if (error) throw new Error(`Resend send failed: ${error.message}`);
      if (!data) throw new Error("Resend send returned no data");
      return data.id;
    },
  );
  return true;
}

// Actions so the plaintext link only ever exists in memory: a mutation would
// have to persist it in a scheduled job's arguments to email it.
export const invite = action({
  args: inviteArgs,
  handler: async (ctx, args): Promise<{ emailed: boolean }> => {
    const link = await ctx.runMutation(internal.people.prepareInvite, args);
    return { emailed: await sendLinkEmail(ctx, link) };
  },
});

export const sendLink = action({
  args: { token: v.string(), userId: v.id("adminUsers") },
  handler: async (ctx, args): Promise<{ emailed: boolean }> => {
    const link = await ctx.runMutation(internal.people.prepareLink, args);
    return { emailed: await sendLinkEmail(ctx, link) };
  },
});

/* ------------------------------------------------------ status and role --- */

export const setActive = mutation({
  args: { token: v.string(), userId: v.id("adminUsers"), active: v.boolean() },
  handler: async (ctx, { token, userId, active }) => {
    const actor = await requireAccess(ctx, token, "users.manage");
    const target = await requireSubordinate(ctx, actor, userId);
    const before = statusOf(target);
    const after = active
      ? target.passwordSetAt
        ? "active"
        : "invited"
      : "deactivated";
    if (before === after) return;
    await ctx.db.patch(userId, { status: after });
    if (!active) {
      await revokeSessions(ctx, userId);
      await burnSetupTokens(ctx, userId);
    }
    await audit(ctx, actor, "user.status", userId, before, after);
  },
});

export const setRole = mutation({
  args: { token: v.string(), userId: v.id("adminUsers"), role: roleValidator },
  handler: async (ctx, { token, userId, role }) => {
    const actor = await requireAccess(ctx, token, "roles.assign");
    const target = await requireSubordinate(ctx, actor, userId);
    const before = roleOf(target);
    const refusal = roleChangeRefusal(actor, before, role);
    if (refusal) throw new ConvexError(refusal);
    if (before === role) return;
    await ctx.db.patch(userId, { role });
    await revokeSessions(ctx, userId);
    await audit(ctx, actor, "user.role", userId, before, role);
  },
});

async function assertSupervisor(ctx: MutationCtx, id: Id<"adminUsers">) {
  const supervisor = await ctx.db.get(id);
  if (!supervisor || statusOf(supervisor) === "deactivated") {
    throw new ConvexError("Pick a supervisor who is still on staff.");
  }
}

export const setSupervisor = mutation({
  args: {
    token: v.string(),
    userId: v.id("adminUsers"),
    supervisorId: v.union(v.id("adminUsers"), v.null()),
  },
  handler: async (ctx, { token, userId, supervisorId }) => {
    const actor = await requireAccess(ctx, token, "supervision.manage");
    // Who reports to whom decides team scope, so it is as guarded as a role.
    const target = await requireSubordinate(ctx, actor, userId);
    if (supervisorId) {
      await assertSupervisor(ctx, supervisorId);
      // A supervisor who already reports to them would close a loop.
      if (
        supervisorId === userId ||
        (await isInTeam(ctx, userId, supervisorId))
      ) {
        throw new ConvexError("That would make them their own supervisor.");
      }
    }
    const before = target.supervisorId ?? null;
    if (before === supervisorId) return;
    await ctx.db.patch(userId, { supervisorId: supervisorId ?? undefined });
    await audit(ctx, actor, "user.supervisor", userId, before, supervisorId);
  },
});

/* ----------------------------------------------------------- overrides --- */

export const setOverride = mutation({
  args: {
    token: v.string(),
    userId: v.id("adminUsers"),
    permission: permissionValidator,
    effect: v.union(v.literal("grant"), v.literal("deny")),
    reason: v.string(),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, { token, userId, ...rule }) => {
    const actor = await requireAccess(ctx, token, "overrides.manage");
    const target = await requireSubordinate(ctx, actor, userId);
    const refusal = overrideRefusal(
      actor,
      roleOf(target),
      rule.permission,
      rule.effect,
    );
    if (refusal) throw new ConvexError(refusal);
    const reason = rule.reason.trim();
    if (!reason) throw new ConvexError("Say why this override is needed.");
    if (rule.expiresAt !== undefined && rule.expiresAt <= Date.now()) {
      throw new ConvexError("Pick an expiry in the future.");
    }
    // One override per permission per person: a new one replaces the old.
    const existing = (
      await ctx.db
        .query("permissionOverrides")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect()
    ).filter((o) => o.permission === rule.permission);
    for (const o of existing) {
      await assertCanUndo(ctx, actor, roleOf(target), o);
      await ctx.db.delete(o._id);
    }
    const after = { ...rule, reason, grantedBy: actor.user._id };
    await ctx.db.insert("permissionOverrides", {
      userId,
      ...after,
      createdAt: Date.now(),
    });
    await audit(
      ctx,
      actor,
      "override.set",
      userId,
      existing[0] ? overrideSnapshot(existing[0]) : undefined,
      after,
    );
  },
});

export const removeOverride = mutation({
  args: { token: v.string(), overrideId: v.id("permissionOverrides") },
  handler: async (ctx, { token, overrideId }) => {
    const actor = await requireAccess(ctx, token, "overrides.manage");
    const row = await ctx.db.get(overrideId);
    if (!row) return;
    const target = await requireSubordinate(ctx, actor, row.userId);
    await assertCanUndo(ctx, actor, roleOf(target), row);
    await ctx.db.delete(overrideId);
    await audit(
      ctx,
      actor,
      "override.remove",
      row.userId,
      overrideSnapshot(row),
    );
  },
});

/**
 * Undoing an override is held to the same rules as setting it: the actor must
 * hold the permission, and cannot undo one set by someone ranked above them,
 * or HR could lift an owner's deny.
 */
async function assertCanUndo(
  ctx: MutationCtx,
  actor: Access,
  targetRole: Role,
  existing: Doc<"permissionOverrides">,
) {
  const refusal = overrideRefusal(
    actor,
    targetRole,
    existing.permission,
    existing.effect,
  );
  if (refusal) throw new ConvexError(refusal);
  const setter = await ctx.db.get(existing.grantedBy);
  if (
    setter &&
    actor.role !== "developer" &&
    roleRank(roleOf(setter)) > roleRank(actor.role)
  ) {
    throw new ConvexError(
      "Someone above you set that override, so only they can change it.",
    );
  }
}

function overrideSnapshot(o: Doc<"permissionOverrides">) {
  return {
    permission: o.permission,
    effect: o.effect,
    reason: o.reason,
    grantedBy: o.grantedBy,
    expiresAt: o.expiresAt,
  };
}

/* ----------------------------------------------------------- migration --- */

/**
 * One-off: the account that predates roles is the operator, so it becomes the
 * owner. Safe to run twice; rows that already have a role are left alone.
 *   npx convex run people:backfillRoles
 */
export const backfillRoles = internalMutation({
  args: {},
  handler: async (ctx) => {
    let changed = 0;
    for (const user of await ctx.db.query("adminUsers").collect()) {
      if (user.role && user.status) continue;
      const after = { role: roleOf(user), status: statusOf(user) };
      await ctx.db.patch(user._id, after);
      await audit(ctx, null, "user.migrate", user._id, undefined, after);
      changed++;
    }
    return changed;
  },
});
