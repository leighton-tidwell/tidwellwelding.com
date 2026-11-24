import { v } from "convex/values";

/**
 * Fixed roles and what they may do. The map lives in code so a change to who
 * can see what is reviewed and tested like any other logic. Pure: no database,
 * so the client imports it too to decide what to show. Hiding is never the
 * control; the server re-checks every call through requireAccess.
 *
 * Spec: docs/admin-rbac-jobs.md.
 */

/** Lowest to highest. A role's index is its rank. */
export const ROLES = [
  "employee",
  "manager",
  "hr",
  "owner",
  "developer",
] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "users.read",
  "users.invite",
  "users.manage",
  "roles.assign",
  "overrides.manage",
  "supervision.manage",
  "wages.read",
  "wages.write",
  "time.own",
  "time.read.team",
  "time.read.all",
  "time.approve.team",
  "time.edit.all",
  "jobs.read.assigned",
  "jobs.read.team",
  "jobs.read.all",
  "jobs.write",
  "jobs.assign",
  "businesses.read",
  "businesses.write",
  "quotes.inbox",
  "financials.read",
  "financials.write",
  "settings.shop",
  "system.developer",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const roleValidator = v.union(...ROLES.map((r) => v.literal(r)));
export const permissionValidator = v.union(
  ...PERMISSIONS.map((p) => v.literal(p)),
);

const EMPLOYEE: Permission[] = ["time.own", "jobs.read.assigned"];

const MANAGER: Permission[] = [
  ...EMPLOYEE,
  "time.read.team",
  "time.approve.team",
  "jobs.read.team",
  "jobs.assign",
  "businesses.read",
];

const HR: Permission[] = [
  "users.read",
  "users.invite",
  "users.manage",
  "roles.assign",
  "overrides.manage",
  "supervision.manage",
  "wages.read",
  "wages.write",
  "time.own",
  "time.read.team",
  "time.read.all",
  "time.approve.team",
  "time.edit.all",
  "jobs.read.assigned",
  "jobs.read.team",
  "jobs.read.all",
  "businesses.read",
];

const OWNER: Permission[] = PERMISSIONS.filter((p) => p !== "system.developer");

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  employee: EMPLOYEE,
  manager: MANAGER,
  hr: HR,
  owner: OWNER,
  developer: PERMISSIONS,
};

export const ROLE_LABELS: Record<Role, string> = {
  employee: "Employee",
  manager: "Manager",
  hr: "HR",
  owner: "Owner",
  developer: "Developer",
};

export function roleRank(role: Role): number {
  return ROLES.indexOf(role);
}

/** Never handed out by override, whoever asks. */
export const NEVER_GRANTABLE: readonly Permission[] = ["system.developer"];

export type OverrideRule = {
  permission: Permission;
  effect: "grant" | "deny";
  expiresAt?: number;
};

/** role ∪ grants − denies, ignoring expired overrides. Deny wins. */
export function effectivePermissions(
  role: Role,
  overrides: readonly OverrideRule[],
  now: number,
): Set<Permission> {
  const live = overrides.filter(
    (o) => o.expiresAt === undefined || o.expiresAt > now,
  );
  const set = new Set<Permission>(ROLE_PERMISSIONS[role]);
  for (const o of live) {
    if (o.effect === "grant" && !NEVER_GRANTABLE.includes(o.permission)) {
      set.add(o.permission);
    }
  }
  for (const o of live) if (o.effect === "deny") set.delete(o.permission);
  return set;
}

export type Actor = { role: Role; permissions: ReadonlySet<Permission> };

/** Developers can act on anyone; everyone else only on people ranked below. */
export function outranks(actor: Role, target: Role): boolean {
  return actor === "developer" || roleRank(actor) > roleRank(target);
}

/**
 * The highest role this actor may hand out. Owner and developer can assign up
 * to their own rank; anyone else holding roles.assign, by role or by override,
 * stops at HR and never above their own rank. Developer is developer-only.
 */
export function assignableRoles(actor: Actor): Role[] {
  if (!actor.permissions.has("roles.assign")) return [];
  const top =
    actor.role === "owner" || actor.role === "developer"
      ? roleRank(actor.role)
      : Math.min(roleRank(actor.role), roleRank("hr"));
  return ROLES.filter((r) => roleRank(r) <= top);
}

/** Why an actor may not move `target` from `from` to `to`, or null if allowed. */
export function roleChangeRefusal(
  actor: Actor,
  from: Role | null,
  to: Role,
): string | null {
  if (!actor.permissions.has("roles.assign")) {
    return "You cannot assign roles.";
  }
  if (from !== null && !outranks(actor.role, from)) {
    return "You can only change the role of someone below you.";
  }
  if (!assignableRoles(actor).includes(to)) {
    return `You cannot assign the ${ROLE_LABELS[to]} role.`;
  }
  return null;
}

/**
 * Why an actor may not set this override on someone of `targetRole`, or null.
 * You can only grant or deny a permission you hold, only to someone below you,
 * and some permissions are never grantable at all.
 */
export function overrideRefusal(
  actor: Actor,
  targetRole: Role,
  permission: Permission,
  effect: "grant" | "deny",
): string | null {
  if (!actor.permissions.has("overrides.manage")) {
    return "You cannot manage overrides.";
  }
  if (!outranks(actor.role, targetRole)) {
    return "You can only set overrides for someone below you.";
  }
  if (effect === "grant" && NEVER_GRANTABLE.includes(permission)) {
    return `${permission} is never granted by override.`;
  }
  if (!actor.permissions.has(permission)) {
    return `You do not hold ${permission}, so you cannot ${effect} it.`;
  }
  return null;
}
