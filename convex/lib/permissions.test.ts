import { describe, expect, test } from "vitest";
import {
  assignableRoles,
  effectivePermissions,
  overrideRefusal,
  type Permission,
  ROLE_PERMISSIONS,
  type Role,
  roleChangeRefusal,
} from "./permissions";

const NOW = 1_000_000;
const MONEY: Permission[] = ["financials.read", "financials.write"];

function actor(role: Role, extra: Permission[] = []) {
  return {
    role,
    permissions: new Set<Permission>([...ROLE_PERMISSIONS[role], ...extra]),
  };
}

describe("role map", () => {
  test("only owner and developer hold money by default", () => {
    for (const role of ["employee", "manager", "hr"] as const) {
      for (const p of MONEY) expect(ROLE_PERMISSIONS[role]).not.toContain(p);
    }
    for (const role of ["owner", "developer"] as const) {
      for (const p of MONEY) expect(ROLE_PERMISSIONS[role]).toContain(p);
    }
  });

  test("only a developer holds system.developer", () => {
    expect(ROLE_PERMISSIONS.developer).toContain("system.developer");
    expect(ROLE_PERMISSIONS.owner).not.toContain("system.developer");
  });

  test("HR runs people and time, not the quote inbox or shop settings", () => {
    const hr = ROLE_PERMISSIONS.hr;
    for (const p of [
      "users.invite",
      "users.manage",
      "roles.assign",
      "supervision.manage",
      "wages.read",
      "time.edit.all",
    ] as const) {
      expect(hr).toContain(p);
    }
    expect(hr).not.toContain("quotes.inbox");
    expect(hr).not.toContain("settings.shop");
  });

  test("a manager sees their team's time and jobs, no wages or people admin", () => {
    const m = ROLE_PERMISSIONS.manager;
    expect(m).toEqual(
      expect.arrayContaining([
        "time.read.team",
        "time.approve.team",
        "jobs.read.team",
        "jobs.assign",
      ]),
    );
    for (const p of ["wages.read", "users.read", "jobs.read.all"] as const) {
      expect(m).not.toContain(p);
    }
  });

  test("an employee has only their own clock and assigned jobs", () => {
    expect([...ROLE_PERMISSIONS.employee].sort()).toEqual([
      "jobs.read.assigned",
      "time.own",
    ]);
  });
});

describe("effectivePermissions", () => {
  test("a grant adds one permission to the role", () => {
    const set = effectivePermissions(
      "manager",
      [{ permission: "financials.read", effect: "grant" }],
      NOW,
    );
    expect(set.has("financials.read")).toBe(true);
    expect(set.has("financials.write")).toBe(false);
  });

  test("a deny removes a role permission", () => {
    const set = effectivePermissions(
      "owner",
      [{ permission: "financials.write", effect: "deny" }],
      NOW,
    );
    expect(set.has("financials.write")).toBe(false);
    expect(set.has("financials.read")).toBe(true);
  });

  test("deny beats grant for the same permission", () => {
    const set = effectivePermissions(
      "employee",
      [
        { permission: "businesses.read", effect: "grant" },
        { permission: "businesses.read", effect: "deny" },
      ],
      NOW,
    );
    expect(set.has("businesses.read")).toBe(false);
  });

  test("an expired override no longer applies", () => {
    const set = effectivePermissions(
      "manager",
      [
        { permission: "financials.read", effect: "grant", expiresAt: NOW },
        { permission: "time.own", effect: "deny", expiresAt: NOW - 1 },
      ],
      NOW,
    );
    expect(set.has("financials.read")).toBe(false);
    expect(set.has("time.own")).toBe(true);
  });

  test("system.developer never comes from a grant", () => {
    const set = effectivePermissions(
      "owner",
      [{ permission: "system.developer", effect: "grant" }],
      NOW,
    );
    expect(set.has("system.developer")).toBe(false);
  });
});

describe("overrideRefusal", () => {
  test("the owner can grant money to a manager", () => {
    expect(
      overrideRefusal(actor("owner"), "manager", "financials.read", "grant"),
    ).toBeNull();
  });

  test("you cannot grant what you do not hold", () => {
    expect(
      overrideRefusal(actor("hr"), "manager", "financials.read", "grant"),
    ).toContain("do not hold");
  });

  test("you cannot set overrides on a peer or someone above you", () => {
    expect(
      overrideRefusal(actor("hr"), "hr", "time.read.all", "grant"),
    ).toContain("below you");
    expect(
      overrideRefusal(actor("owner"), "owner", "jobs.write", "deny"),
    ).toContain("below you");
  });

  test("system.developer is refused even from a developer", () => {
    expect(
      overrideRefusal(actor("developer"), "owner", "system.developer", "grant"),
    ).toContain("never granted");
  });

  test("you need overrides.manage at all", () => {
    expect(
      overrideRefusal(actor("manager"), "employee", "time.own", "deny"),
    ).toContain("cannot manage overrides");
  });
});

describe("role assignment", () => {
  test("HR assigns up to HR and no higher", () => {
    expect(assignableRoles(actor("hr"))).toEqual(["employee", "manager", "hr"]);
    expect(roleChangeRefusal(actor("hr"), "employee", "owner")).toContain(
      "Owner",
    );
  });

  test("only a developer can make a developer", () => {
    expect(assignableRoles(actor("owner"))).not.toContain("developer");
    expect(assignableRoles(actor("developer"))).toContain("developer");
  });

  test("roles.assign by override never reaches above HR or the holder's rank", () => {
    const manager = actor("manager", ["roles.assign"]);
    expect(assignableRoles(manager)).toEqual(["employee", "manager"]);
  });

  test("you cannot change the role of a peer", () => {
    expect(roleChangeRefusal(actor("hr"), "hr", "employee")).toContain(
      "below you",
    );
  });

  test("a developer can change anyone's role, owners included", () => {
    expect(roleChangeRefusal(actor("developer"), "owner", "hr")).toBeNull();
  });
});
