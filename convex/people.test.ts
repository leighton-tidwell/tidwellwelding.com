import rateLimiterComponent from "@convex-dev/rate-limiter/test";
import { ConvexError } from "convex/values";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { requireAccess } from "./lib/access";
import type { Role } from "./lib/permissions";
import schema from "./schema";

const modules = import.meta.glob([
  "./**/*.ts",
  "./**/*.js",
  "!./**/*.test.ts",
  "!./**/*.d.ts",
]);

// Both email layers are mocked; the SDK mock records what would have gone out
// so a test can follow the link exactly as the invitee would.
const sdkSendMock = vi.hoisted(() => vi.fn());
vi.mock("@convex-dev/resend", () => ({
  Resend: class {
    sendEmailManually = async (
      _ctx: unknown,
      _opts: unknown,
      send: (id: string) => Promise<string>,
    ) => send("email-id");
  },
}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sdkSendMock };
  },
}));

const PASSWORD = "correct horse battery staple";

function setup() {
  const t = convexTest(schema, modules);
  rateLimiterComponent.register(t);
  return t;
}
type T = ReturnType<typeof setup>;

beforeEach(() => {
  sdkSendMock.mockReset();
  sdkSendMock.mockResolvedValue({ data: { id: "sent" }, error: null });
  vi.stubEnv("RESEND_API_KEY", "test-key-not-real");
});
afterEach(() => vi.unstubAllEnvs());

/** A signed-in account of the given role, set up through the real link. */
async function person(
  t: T,
  role: Role,
  email = `${role}@example.com`,
): Promise<{ id: Id<"adminUsers">; token: string }> {
  const id = await t.mutation(internal.auth.createAdminUser, { email, role });
  const link = await t.mutation(internal.auth.issueSetupToken, { userId: id });
  await t.mutation(api.auth.setPassword, { token: link, password: PASSWORD });
  return { id, token: await login(t, email) };
}

async function login(t: T, email: string): Promise<string> {
  const res = await t.mutation(api.auth.login, { email, password: PASSWORD });
  if (!res.ok || !res.token) throw new Error(`login failed: ${res.error}`);
  return res.token;
}

async function refused(p: Promise<unknown>, snippet = "access") {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err, "expected the call to be refused").toBeInstanceOf(ConvexError);
  expect(String((err as ConvexError<string>).data)).toContain(snippet);
}

/** The setup link in the most recent email, as the recipient would click it. */
function lastLinkToken(): string {
  const call = sdkSendMock.mock.calls.at(-1);
  const text = (call?.[0] as { text?: string } | undefined)?.text ?? "";
  const match = text.match(/set-password\?token=([0-9a-f]{64})/);
  if (!match?.[1]) throw new Error("no link in the email");
  return match[1];
}

const audits = (t: T, targetId: Id<"adminUsers">) =>
  t.run(async (ctx) =>
    ctx.db
      .query("auditLog")
      .withIndex("by_target", (q) => q.eq("targetId", targetId))
      .collect(),
  );

describe("who may see admin data", () => {
  test("an employee is refused invoices, customers, quotes, people and settings", async () => {
    const t = setup();
    const { token } = await person(t, "employee");
    await refused(t.query(api.invoices.list, { token }));
    await refused(t.query(api.customers.list, { token }));
    await refused(t.query(api.adminQuotes.list, { token }));
    await refused(t.query(api.people.list, { token }));
    await refused(t.query(api.settings.getLaborRateAdmin, { token }));
    await refused(t.query(api.packingSlips.list, { token }));
  });

  test("HR sees people but no money", async () => {
    const t = setup();
    const { token } = await person(t, "hr");
    expect(await t.query(api.people.list, { token })).toHaveLength(1);
    await refused(t.query(api.invoices.list, { token }));
    await refused(t.query(api.adminQuotes.list, { token }));
  });

  test("the owner still reads invoices", async () => {
    const t = setup();
    const { token } = await person(t, "owner");
    expect(await t.query(api.invoices.list, { token })).toEqual([]);
  });

  test("a granted override opens money to one manager, and a deny closes it", async () => {
    const t = setup();
    const owner = await person(t, "owner");
    const manager = await person(t, "manager");
    await refused(t.query(api.invoices.list, { token: manager.token }));

    await t.mutation(api.people.setOverride, {
      token: owner.token,
      userId: manager.id,
      permission: "financials.read",
      effect: "grant",
      reason: "Runs the Bishop contract",
    });
    expect(await t.query(api.invoices.list, { token: manager.token })).toEqual(
      [],
    );

    await t.mutation(api.people.setOverride, {
      token: owner.token,
      userId: manager.id,
      permission: "financials.read",
      effect: "deny",
      reason: "Contract ended",
    });
    await refused(t.query(api.invoices.list, { token: manager.token }));
    const log = await audits(t, manager.id);
    expect(log.filter((a) => a.action === "override.set")).toHaveLength(2);
  });
});

describe("overrides", () => {
  test("HR cannot grant money it does not hold", async () => {
    const t = setup();
    const hr = await person(t, "hr");
    const manager = await person(t, "manager");
    await refused(
      t.mutation(api.people.setOverride, {
        token: hr.token,
        userId: manager.id,
        permission: "financials.read",
        effect: "grant",
        reason: "x",
      }),
      "do not hold",
    );
  });

  test("an override needs a reason", async () => {
    const t = setup();
    const owner = await person(t, "owner");
    const employee = await person(t, "employee");
    await refused(
      t.mutation(api.people.setOverride, {
        token: owner.token,
        userId: employee.id,
        permission: "businesses.read",
        effect: "grant",
        reason: "  ",
      }),
      "why",
    );
  });

  test("removing an override is audited with what it was", async () => {
    const t = setup();
    const owner = await person(t, "owner");
    const employee = await person(t, "employee");
    await t.mutation(api.people.setOverride, {
      token: owner.token,
      userId: employee.id,
      permission: "businesses.read",
      effect: "grant",
      reason: "Site contact lookups",
    });
    const [row] = (await t.query(api.people.list, { token: owner.token })).find(
      (p) => p.id === employee.id,
    )!.overrides;
    await t.mutation(api.people.removeOverride, {
      token: owner.token,
      overrideId: row!.id,
    });
    const removed = (await audits(t, employee.id)).find(
      (a) => a.action === "override.remove",
    );
    expect(removed?.before).toMatchObject({
      permission: "businesses.read",
      reason: "Site contact lookups",
    });
  });
});

describe("undoing overrides", () => {
  test("HR cannot lift or overwrite a deny the owner set", async () => {
    const t = setup();
    const owner = await person(t, "owner");
    const hr = await person(t, "hr");
    const manager = await person(t, "manager");
    await t.mutation(api.people.setOverride, {
      token: owner.token,
      userId: manager.id,
      permission: "time.approve.team",
      effect: "deny",
      reason: "Under review",
    });
    const [row] = (await t.query(api.people.list, { token: hr.token })).find(
      (p) => p.id === manager.id,
    )!.overrides;
    await refused(
      t.mutation(api.people.removeOverride, {
        token: hr.token,
        overrideId: row!.id,
      }),
      "above you",
    );
    await refused(
      t.mutation(api.people.setOverride, {
        token: hr.token,
        userId: manager.id,
        permission: "time.approve.team",
        effect: "grant",
        reason: "Review done",
      }),
      "above you",
    );
  });

  test("HR cannot remove an override on a permission it does not hold", async () => {
    const t = setup();
    const owner = await person(t, "owner");
    const hr = await person(t, "hr");
    const manager = await person(t, "manager");
    await t.mutation(api.people.setOverride, {
      token: hr.token,
      userId: manager.id,
      permission: "users.read",
      effect: "grant",
      reason: "Needs the staff list",
    });
    await t.mutation(api.people.setOverride, {
      token: owner.token,
      userId: hr.id,
      permission: "users.read",
      effect: "deny",
      reason: "Testing",
    });
    // Permissions are read on every call, so the deny bites at once.
    await refused(t.query(api.people.list, { token: hr.token }));
    const [row] = (await t.query(api.people.list, { token: owner.token })).find(
      (p) => p.id === manager.id,
    )!.overrides;
    await refused(
      t.mutation(api.people.removeOverride, {
        token: hr.token,
        overrideId: row!.id,
      }),
      "do not hold",
    );
  });
});

describe("invites", () => {
  test("HR invites an employee: invited account, a 72h invite link that works once, and an audit row", async () => {
    const t = setup();
    const hr = await person(t, "hr");
    const before = Date.now();
    const res = await t.action(api.people.invite, {
      token: hr.token,
      email: "New.Hire@Example.com",
      name: "New Hire",
      role: "employee",
    });
    expect(res.emailed).toBe(true);

    const hire = (await t.query(api.people.list, { token: hr.token })).find(
      (p) => p.email === "new.hire@example.com",
    )!;
    expect(hire).toMatchObject({ status: "invited", role: "employee" });
    expect(hire.linkExpiresAt).toBeGreaterThanOrEqual(
      before + 72 * 60 * 60 * 1000,
    );
    const tokens = await t.run(async (ctx) =>
      ctx.db.query("setupTokens").collect(),
    );
    expect(tokens.find((r) => r.userId === hire.id)?.purpose).toBe("invite");

    const link = lastLinkToken();
    await t.mutation(api.auth.setPassword, { token: link, password: PASSWORD });
    await login(t, "new.hire@example.com");
    const after = (await t.query(api.people.list, { token: hr.token })).find(
      (p) => p.id === hire.id,
    );
    expect(after?.status).toBe("active");
    await refused(
      t.mutation(api.auth.setPassword, { token: link, password: PASSWORD }),
      "invalid",
    );

    const log = await audits(t, hire.id);
    expect(log[0]).toMatchObject({ action: "user.invite", actorId: hr.id });
  });

  test("HR cannot invite an owner", async () => {
    const t = setup();
    const hr = await person(t, "hr");
    await refused(
      t.action(api.people.invite, {
        token: hr.token,
        email: "boss@example.com",
        name: "Boss",
        role: "owner",
      }),
      "Owner",
    );
  });

  test("an employee cannot invite anyone", async () => {
    const t = setup();
    const employee = await person(t, "employee");
    await refused(
      t.action(api.people.invite, {
        token: employee.token,
        email: "friend@example.com",
        name: "Friend",
        role: "employee",
      }),
    );
  });

  test("re-sending an invite burns the older link", async () => {
    const t = setup();
    const hr = await person(t, "hr");
    await t.action(api.people.invite, {
      token: hr.token,
      email: "slow@example.com",
      name: "Slow Reader",
      role: "employee",
    });
    const first = lastLinkToken();
    const hire = (await t.query(api.people.list, { token: hr.token })).find(
      (p) => p.email === "slow@example.com",
    )!;
    await t.action(api.people.sendLink, { token: hr.token, userId: hire.id });
    const second = lastLinkToken();
    expect(second).not.toBe(first);

    expect(await t.query(api.auth.checkSetupToken, { token: first })).toEqual({
      state: "spent",
    });
    await t.mutation(api.auth.setPassword, {
      token: second,
      password: PASSWORD,
    });
    await login(t, "slow@example.com");
  });

  test("a reset for an active account wipes the password and signs them out", async () => {
    const t = setup();
    const hr = await person(t, "hr");
    const employee = await person(t, "employee");
    await t.action(api.people.sendLink, {
      token: hr.token,
      userId: employee.id,
    });
    await refused(
      t.query(api.people.me, { token: employee.token }).then((me) => {
        if (me === null) throw new ConvexError("signed out, no access");
      }),
    );
    const res = await t.mutation(api.auth.login, {
      email: "employee@example.com",
      password: PASSWORD,
    });
    expect(res.ok).toBe(false);
    const tokens = await t.run(async (ctx) =>
      ctx.db.query("setupTokens").collect(),
    );
    expect(tokens.at(-1)?.purpose).toBe("reset");
    await t.mutation(api.auth.setPassword, {
      token: lastLinkToken(),
      password: PASSWORD,
    });
    await login(t, "employee@example.com");
  });
});

describe("deactivate and role changes", () => {
  test("deactivating revokes sessions, blocks sign-in and burns open links", async () => {
    const t = setup();
    const hr = await person(t, "hr");
    const employee = await person(t, "employee");
    await t.mutation(api.people.setActive, {
      token: hr.token,
      userId: employee.id,
      active: false,
    });
    expect(await t.query(api.people.me, { token: employee.token })).toBeNull();
    const res = await t.mutation(api.auth.login, {
      email: "employee@example.com",
      password: PASSWORD,
    });
    expect(res.ok).toBe(false);
    await refused(
      t.action(api.people.sendLink, { token: hr.token, userId: employee.id }),
      "Reactivate",
    );
    expect((await audits(t, employee.id)).at(-1)).toMatchObject({
      action: "user.status",
      before: "active",
      after: "deactivated",
    });
  });

  test("a role change signs the person out and is audited", async () => {
    const t = setup();
    const hr = await person(t, "hr");
    const employee = await person(t, "employee");
    await t.mutation(api.people.setRole, {
      token: hr.token,
      userId: employee.id,
      role: "manager",
    });
    expect(await t.query(api.people.me, { token: employee.token })).toBeNull();
    const token = await login(t, "employee@example.com");
    expect((await t.query(api.people.me, { token }))?.role).toBe("manager");
    expect((await audits(t, employee.id)).at(-1)).toMatchObject({
      action: "user.role",
      before: "employee",
      after: "manager",
    });
  });

  test("HR cannot touch the owner's account", async () => {
    const t = setup();
    const hr = await person(t, "hr");
    const owner = await person(t, "owner");
    await refused(
      t.mutation(api.people.setActive, {
        token: hr.token,
        userId: owner.id,
        active: false,
      }),
      "below you",
    );
    await refused(
      t.mutation(api.people.setRole, {
        token: hr.token,
        userId: owner.id,
        role: "employee",
      }),
      "below you",
    );
  });

  test("nobody changes their own role", async () => {
    const t = setup();
    const owner = await person(t, "owner");
    await refused(
      t.mutation(api.people.setRole, {
        token: owner.token,
        userId: owner.id,
        role: "developer",
      }),
      "your own",
    );
  });
});

describe("supervisors and team scope", () => {
  test("HR cannot put the owner, or themselves, under someone", async () => {
    const t = setup();
    const hr = await person(t, "hr");
    const owner = await person(t, "owner");
    const manager = await person(t, "manager");
    await refused(
      t.mutation(api.people.setSupervisor, {
        token: hr.token,
        userId: owner.id,
        supervisorId: manager.id,
      }),
      "below you",
    );
    await refused(
      t.mutation(api.people.setSupervisor, {
        token: hr.token,
        userId: hr.id,
        supervisorId: manager.id,
      }),
      "your own",
    );
  });

  test("a supervisor loop is refused", async () => {
    const t = setup();
    const hr = await person(t, "hr");
    const manager = await person(t, "manager");
    const employee = await person(t, "employee");
    await t.mutation(api.people.setSupervisor, {
      token: hr.token,
      userId: employee.id,
      supervisorId: manager.id,
    });
    await refused(
      t.mutation(api.people.setSupervisor, {
        token: hr.token,
        userId: manager.id,
        supervisorId: employee.id,
      }),
      "own supervisor",
    );
  });

  test("a team permission reaches indirect reports and nobody else", async () => {
    const t = setup();
    const hr = await person(t, "hr");
    const manager = await person(t, "manager");
    const lead = await person(t, "employee", "lead@example.com");
    const welder = await person(t, "employee", "welder@example.com");
    const outsider = await person(t, "employee", "other@example.com");
    for (const [userId, supervisorId] of [
      [lead.id, manager.id],
      [welder.id, lead.id],
    ] as const) {
      await t.mutation(api.people.setSupervisor, {
        token: hr.token,
        userId,
        supervisorId,
      });
    }
    const check = (id: Id<"adminUsers">) =>
      t.run(async (ctx) =>
        requireAccess(ctx, manager.token, "time.read.team", {
          kind: "user",
          id,
        }).then(() => "allowed"),
      );
    expect(await check(lead.id)).toBe("allowed");
    expect(await check(welder.id)).toBe("allowed");
    await refused(check(outsider.id));
  });
});

describe("backfillRoles", () => {
  test("the account that predates roles becomes an active owner", async () => {
    const t = setup();
    const legacy = await t.run(async (ctx) =>
      ctx.db.insert("adminUsers", {
        email: "operator@example.com",
        passwordSetAt: 1,
        createdAt: 1,
      }),
    );
    expect(await t.mutation(internal.people.backfillRoles, {})).toBe(1);
    const row = await t.run(async (ctx) => ctx.db.get(legacy));
    expect(row).toMatchObject({ role: "owner", status: "active" });
    expect(await t.mutation(internal.people.backfillRoles, {})).toBe(0);
  });
});
