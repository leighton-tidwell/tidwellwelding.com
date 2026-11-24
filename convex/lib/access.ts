import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { requireAdmin } from "../auth";
import {
  type Actor,
  effectivePermissions,
  type Permission,
  type Role,
} from "./permissions";

/**
 * The one gate for admin data. Every admin query and mutation calls
 * requireAccess before it reads ctx.db; nothing else decides who may see what.
 */

export type Scope = "own" | "team" | "all";

/** A row a call is about. Jobs and time entries join this in later PRs. */
export type Resource = { kind: "user"; id: Id<"adminUsers"> };

export type Access = Actor & {
  user: Doc<"adminUsers">;
  scope: Scope;
};

type Ctx = Pick<QueryCtx, "db">;

/** The account that predates roles is the operator, so it resolves as owner
 * until people:backfillRoles writes the field. */
export function roleOf(user: Doc<"adminUsers">): Role {
  return user.role ?? "owner";
}

export function statusOf(
  user: Doc<"adminUsers">,
): "invited" | "active" | "deactivated" {
  return user.status ?? (user.passwordSetAt ? "active" : "invited");
}

export async function permissionsFor(
  ctx: Ctx,
  user: Doc<"adminUsers">,
): Promise<Set<Permission>> {
  const overrides = await ctx.db
    .query("permissionOverrides")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .collect();
  return effectivePermissions(roleOf(user), overrides, Date.now());
}

/** What part of the data a permission reaches, read off its name. */
export function scopeOf(permission: Permission): Scope {
  if (permission.endsWith(".team")) return "team";
  if (permission === "time.own" || permission.endsWith(".assigned")) {
    return "own";
  }
  return "all";
}

/** True when `id` reports to `managerId`, directly or through others. */
export async function isInTeam(
  ctx: Ctx,
  managerId: Id<"adminUsers">,
  id: Id<"adminUsers">,
): Promise<boolean> {
  const seen = new Set<string>();
  let current = await ctx.db.get(id);
  while (current?.supervisorId && !seen.has(current._id)) {
    if (current.supervisorId === managerId) return true;
    seen.add(current._id);
    current = await ctx.db.get(current.supervisorId);
  }
  return false;
}

async function inScope(
  ctx: Ctx,
  access: Access,
  resource: Resource,
): Promise<boolean> {
  if (access.scope === "all") return true;
  if (resource.id === access.user._id) return true;
  if (access.scope === "team") {
    return await isInTeam(ctx, access.user._id, resource.id);
  }
  return false;
}

/** The signed-in user and their effective permissions, whatever they are. */
export async function requireSession(ctx: Ctx, token: string): Promise<Access> {
  const userId = await requireAdmin(ctx, token);
  const user = await ctx.db.get(userId);
  if (!user || statusOf(user) !== "active") {
    throw new ConvexError("Not signed in.");
  }
  return {
    user,
    role: roleOf(user),
    permissions: await permissionsFor(ctx, user),
    scope: "all",
  };
}

/**
 * Resolve the session, require one permission, and when a resource is named,
 * require it to sit inside that permission's scope (own, team or all).
 */
export async function requireAccess(
  ctx: Ctx,
  token: string,
  permission: Permission,
  resource?: Resource,
): Promise<Access> {
  const session = await requireSession(ctx, token);
  if (!session.permissions.has(permission)) {
    throw new ConvexError("You do not have access to that.");
  }
  const access = { ...session, scope: scopeOf(permission) };
  if (resource && !(await inScope(ctx, access, resource))) {
    throw new ConvexError("You do not have access to that.");
  }
  return access;
}
