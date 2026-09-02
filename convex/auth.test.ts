import rateLimiterComponent from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import { requireAdmin } from "./auth";
import schema from "./schema";

const modules = import.meta.glob([
  "./**/*.ts",
  "./**/*.js",
  "!./**/*.test.ts",
  "!./**/*.d.ts",
]);

const EMAIL = "eric@tidwellwelding.com";
const GOOD_PASSWORD = "correct horse battery staple";

function setup() {
  const t = convexTest(schema, modules);
  rateLimiterComponent.register(t);
  return t;
}

/** Independent SHA-256 hex, computed in the test so we are not just echoing
 * whatever auth.ts happens to do. */
async function sha256Hex(input: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Independent PBKDF2-SHA256, so the test proves the real KDF parameters
 * rather than trusting auth.ts's own helper. */
async function pbkdf2Hex(
  password: string,
  saltHex: string,
  iterations: number,
): Promise<string> {
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const salt = Uint8Array.from(
    saltHex.match(/.{2}/g)!.map((h) => Number.parseInt(h, 16)),
  );
  const bits = await globalThis.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** login reports failure as a returned value (not a throw) so the rate-limit
 * counter commits; every other endpoint throws. */
async function expectLoginFailure(
  p: Promise<{ ok: boolean; error?: string }>,
  snippet: string,
) {
  const res = await p;
  expect(res.ok).toBe(false);
  expect(res.error).toContain(snippet);
  return res;
}

async function expectThrows(p: Promise<unknown>, snippet: string) {
  let caught: unknown;
  try {
    await p;
    expect.unreachable("expected the call to throw");
  } catch (e) {
    caught = e;
  }
  const text =
    caught instanceof ConvexError && typeof caught.data === "string"
      ? caught.data
      : caught instanceof Error
        ? caught.message
        : String(caught);
  expect(text).toContain(snippet);
}

describe("createAdminUser", () => {
  test("creates the account with no password material at all", async () => {
    const t = setup();
    const userId = await t.mutation(internal.auth.createAdminUser, {
      email: EMAIL,
    });
    const row = await t.run(async (ctx) => ctx.db.get(userId));
    expect(row).not.toBeNull();
    expect(row!.email).toBe(EMAIL);
    expect(row!.passwordHash).toBeUndefined();
    expect(row!.passwordSalt).toBeUndefined();
    expect(row!.passwordSetAt).toBeUndefined();
    expect(row!.createdAt).toBeGreaterThan(0);
  });

  test("refuses to create a second account with the same email", async () => {
    const t = setup();
    await t.mutation(internal.auth.createAdminUser, { email: EMAIL });
    await expectThrows(
      t.mutation(internal.auth.createAdminUser, { email: EMAIL }),
      "exists",
    );
    const rows = await t.run(async (ctx) => ctx.db.query("adminUsers").collect());
    expect(rows).toHaveLength(1);
  });
});

describe("no public registration path exists", () => {
  test("createAdminUser, issueSetupToken and issuePasswordReset are registered internal, not public", async () => {
    const mod = (await import("./auth")) as unknown as Record<
      string,
      { isInternal?: boolean; isPublic?: boolean }
    >;
    for (const name of [
      "createAdminUser",
      "issueSetupToken",
      "issuePasswordReset",
    ]) {
      expect(mod[name], `${name} must be exported`).toBeDefined();
      expect(mod[name].isInternal, `${name} must be internal`).toBe(true);
      expect(
        mod[name].isPublic,
        `${name} must NOT be reachable from a browser`,
      ).toBeFalsy();
    }
  });

  test("the only public auth endpoints are the four the UI needs", async () => {
    const mod = (await import("./auth")) as unknown as Record<
      string,
      { isPublic?: boolean } | undefined
    >;
    const publicNames = Object.keys(mod)
      .filter((k) => mod[k] && (mod[k] as { isPublic?: boolean }).isPublic)
      .sort();
    // checkSetupToken is read-only and answers a bare boolean; every account
    // mutation stays internal. Anything else appearing here is a mistake.
    expect(publicNames).toEqual([
      "checkSetupToken",
      "login",
      "logout",
      "setPassword",
    ]);
  });
});

describe("issueSetupToken", () => {
  test("returns a plaintext token but stores only its SHA-256 hash, expiring in 48h", async () => {
    const t = setup();
    const userId = await t.mutation(internal.auth.createAdminUser, {
      email: EMAIL,
    });
    const before = Date.now();
    const token = await t.mutation(internal.auth.issueSetupToken, { userId });

    // 32 random bytes, hex-encoded.
    expect(token).toMatch(/^[0-9a-f]{64}$/);

    const rows = await t.run(async (ctx) =>
      ctx.db.query("setupTokens").collect(),
    );
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.userId).toBe(userId);
    expect(row.usedAt).toBeUndefined();
    // The plaintext must be nowhere in the stored row.
    expect(JSON.stringify(row)).not.toContain(token);
    expect(row.tokenHash).toBe(await sha256Hex(token));

    const fortyEightHours = 48 * 60 * 60 * 1000;
    expect(row.expiresAt).toBeGreaterThanOrEqual(before + fortyEightHours);
    expect(row.expiresAt).toBeLessThanOrEqual(Date.now() + fortyEightHours);
  });

  test("refuses to issue a setup link once a password has been set", async () => {
    const t = setup();
    const userId = await t.mutation(internal.auth.createAdminUser, {
      email: EMAIL,
    });
    await t.run(async (ctx) => {
      await ctx.db.patch(userId, { passwordSetAt: Date.now() });
    });
    await expectThrows(
      t.mutation(internal.auth.issueSetupToken, { userId }),
      "already",
    );
    const rows = await t.run(async (ctx) =>
      ctx.db.query("setupTokens").collect(),
    );
    expect(rows).toHaveLength(0);
  });
});

describe("setPassword (the burn-on-use link)", () => {
  async function userWithToken(t: ReturnType<typeof setup>) {
    const userId = await t.mutation(internal.auth.createAdminUser, {
      email: EMAIL,
    });
    const token = await t.mutation(internal.auth.issueSetupToken, { userId });
    return { userId, token };
  }

  test("rejects a token that was never issued", async () => {
    const t = setup();
    await userWithToken(t);
    await expectThrows(
      t.mutation(api.auth.setPassword, {
        token: "f".repeat(64),
        password: GOOD_PASSWORD,
      }),
      "invalid",
    );
    const user = await t.run(async (ctx) =>
      ctx.db
        .query("adminUsers")
        .withIndex("by_email", (q) => q.eq("email", EMAIL))
        .unique(),
    );
    expect(user!.passwordHash).toBeUndefined();
  });
});

describe("checkSetupToken (so a spent link does not show a live form)", () => {
  async function userWithToken(t: ReturnType<typeof setup>) {
    const userId = await t.mutation(internal.auth.createAdminUser, {
      email: EMAIL,
    });
    const token = await t.mutation(internal.auth.issueSetupToken, { userId });
    return { userId, token };
  }

  test("reports a fresh link as usable", async () => {
    const t = setup();
    const { token } = await userWithToken(t);

    expect(await t.query(api.auth.checkSetupToken, { token })).toEqual({
      valid: true,
    });
  });

  test("reports a spent link as unusable", async () => {
    const t = setup();
    const { token } = await userWithToken(t);
    await t.mutation(api.auth.setPassword, { token, password: GOOD_PASSWORD });

    expect(await t.query(api.auth.checkSetupToken, { token })).toEqual({
      valid: false,
    });
  });

  test("reports a token that was never issued as unusable", async () => {
    const t = setup();
    expect(
      await t.query(api.auth.checkSetupToken, { token: "f".repeat(64) }),
    ).toEqual({ valid: false });
  });

  test("reports an expired link as unusable", async () => {
    const t = setup();
    const { token } = await userWithToken(t);
    await t.run(async (ctx) => {
      const row = await ctx.db.query("setupTokens").first();
      await ctx.db.patch(row!._id, { expiresAt: Date.now() - 1 });
    });

    expect(await t.query(api.auth.checkSetupToken, { token })).toEqual({
      valid: false,
    });
  });

  test("says nothing about who the token belongs to", async () => {
    // The reply is a bare boolean: a link handed to the wrong person must not
    // confirm an account exists or whose it is.
    const t = setup();
    const { token } = await userWithToken(t);

    const reply = await t.query(api.auth.checkSetupToken, { token });
    expect(Object.keys(reply)).toEqual(["valid"]);
  });
});

describe("setPassword happy path and replay", () => {
  async function userWithToken(t: ReturnType<typeof setup>) {
    const userId = await t.mutation(internal.auth.createAdminUser, {
      email: EMAIL,
    });
    const token = await t.mutation(internal.auth.issueSetupToken, { userId });
    return { userId, token };
  }

  test("writes the hash, burns the token and stamps passwordSetAt together", async () => {
    const t = setup();
    const { userId, token } = await userWithToken(t);
    await t.mutation(api.auth.setPassword, {
      token,
      password: GOOD_PASSWORD,
    });

    const user = await t.run(async (ctx) => ctx.db.get(userId));
    expect(user!.passwordSalt).toMatch(/^[0-9a-f]{32}$/);
    expect(user!.passwordHash).toMatch(/^[0-9a-f]{64}$/);
    // The plaintext must never be stored, in any field.
    expect(JSON.stringify(user)).not.toContain(GOOD_PASSWORD);
    expect(user!.passwordSetAt).toBeGreaterThan(0);

    const row = await t.run(async (ctx) =>
      ctx.db.query("setupTokens").collect(),
    );
    expect(row[0].usedAt).toBeGreaterThan(0);
  });

  test("a used setup link cannot be redeemed a second time", async () => {
    const t = setup();
    const { userId, token } = await userWithToken(t);
    await t.mutation(api.auth.setPassword, { token, password: GOOD_PASSWORD });
    const firstHash = await t.run(
      async (ctx) => (await ctx.db.get(userId))!.passwordHash,
    );

    await expectThrows(
      t.mutation(api.auth.setPassword, {
        token,
        password: "an entirely different password",
      }),
      "invalid",
    );
    const afterHash = await t.run(
      async (ctx) => (await ctx.db.get(userId))!.passwordHash,
    );
    expect(afterHash).toBe(firstHash);
  });
});

describe("setPassword refuses every other path", () => {
  async function userWithToken(t: ReturnType<typeof setup>) {
    const userId = await t.mutation(internal.auth.createAdminUser, {
      email: EMAIL,
    });
    const token = await t.mutation(internal.auth.issueSetupToken, { userId });
    return { userId, token };
  }

  test("rejects an expired token", async () => {
    const t = setup();
    const { userId, token } = await userWithToken(t);
    await t.run(async (ctx) => {
      const row = (await ctx.db.query("setupTokens").collect())[0];
      await ctx.db.patch(row._id, { expiresAt: Date.now() - 1000 });
    });
    await expectThrows(
      t.mutation(api.auth.setPassword, { token, password: GOOD_PASSWORD }),
      "expired",
    );
    const user = await t.run(async (ctx) => ctx.db.get(userId));
    expect(user!.passwordHash).toBeUndefined();
  });

  test("rejects a pristine token when the user already has a password set", async () => {
    const t = setup();
    const { userId, token } = await userWithToken(t);
    // Token untouched: unused and unexpired. Only passwordSetAt is present.
    await t.run(async (ctx) => {
      await ctx.db.patch(userId, { passwordSetAt: Date.now() });
    });
    const row = await t.run(
      async (ctx) => (await ctx.db.query("setupTokens").collect())[0],
    );
    expect(row.usedAt).toBeUndefined();
    expect(row.expiresAt).toBeGreaterThan(Date.now());

    await expectThrows(
      t.mutation(api.auth.setPassword, { token, password: GOOD_PASSWORD }),
      "invalid",
    );
    const user = await t.run(async (ctx) => ctx.db.get(userId));
    expect(user!.passwordHash).toBeUndefined();
  });

  test("rejects a password shorter than 12 characters and leaves the token unburned", async () => {
    const t = setup();
    const { userId, token } = await userWithToken(t);
    await expectThrows(
      t.mutation(api.auth.setPassword, { token, password: "elevenchars" }),
      "12 characters",
    );
    const user = await t.run(async (ctx) => ctx.db.get(userId));
    expect(user!.passwordHash).toBeUndefined();
    expect(user!.passwordSetAt).toBeUndefined();
    const row = await t.run(
      async (ctx) => (await ctx.db.query("setupTokens").collect())[0],
    );
    expect(row.usedAt).toBeUndefined();
  });
});

describe("login", () => {
  async function readyUser(t: ReturnType<typeof setup>) {
    const userId = await t.mutation(internal.auth.createAdminUser, {
      email: EMAIL,
    });
    const token = await t.mutation(internal.auth.issueSetupToken, { userId });
    await t.mutation(api.auth.setPassword, { token, password: GOOD_PASSWORD });
    return userId;
  }

  test("issues a 12h session token for the right password", async () => {
    const t = setup();
    const userId = await readyUser(t);
    const before = Date.now();
    const res = await t.mutation(api.auth.login, {
      email: EMAIL,
      password: GOOD_PASSWORD,
    });
    expect(res.ok).toBe(true);
    const token = res.token as string;
    expect(token).toMatch(/^[0-9a-f]{64}$/);

    const session = await t.run(async (ctx) =>
      ctx.db
        .query("adminSessions")
        .withIndex("by_token", (q) => q.eq("token", token))
        .unique(),
    );
    expect(session!.userId).toBe(userId);
    const twelveHours = 12 * 60 * 60 * 1000;
    expect(session!.expiresAt).toBeGreaterThanOrEqual(before + twelveHours);
    expect(session!.expiresAt).toBeLessThanOrEqual(Date.now() + twelveHours);
  });

  test("rejects a wrong password and creates no session", async () => {
    const t = setup();
    await readyUser(t);
    await expectLoginFailure(
      t.mutation(api.auth.login, {
        email: EMAIL,
        password: "wrong password here",
      }),
      "Email or password is incorrect.",
    );
    const sessions = await t.run(async (ctx) =>
      ctx.db.query("adminSessions").collect(),
    );
    expect(sessions).toHaveLength(0);
  });

  test("does not reveal whether the email exists", async () => {
    const t = setup();
    await readyUser(t);
    const messages: (string | undefined)[] = [];
    for (const args of [
      { email: EMAIL, password: "wrong password here" },
      { email: "nobody@example.com", password: "wrong password here" },
    ]) {
      const res = await t.mutation(api.auth.login, args);
      expect(res.ok).toBe(false);
      messages.push(res.error);
    }
    expect(messages[0]).toBe("Email or password is incorrect.");
    expect(messages[0]).toBe(messages[1]);
  });

  test("rejects a user who has not set a password yet", async () => {
    const t = setup();
    await t.mutation(internal.auth.createAdminUser, { email: EMAIL });
    await expectLoginFailure(
      t.mutation(api.auth.login, { email: EMAIL, password: GOOD_PASSWORD }),
      "Email or password is incorrect.",
    );
  });

  test("uses a per-user random salt and >=150000 PBKDF2 iterations", async () => {
    const t = setup();
    const userId = await readyUser(t);
    const user = await t.run(async (ctx) => ctx.db.get(userId));

    // A second account with the SAME password must not share a hash.
    const otherId = await t.mutation(internal.auth.createAdminUser, {
      email: "other@example.com",
    });
    const otherToken = await t.mutation(internal.auth.issueSetupToken, {
      userId: otherId,
    });
    await t.mutation(api.auth.setPassword, {
      token: otherToken,
      password: GOOD_PASSWORD,
    });
    const other = await t.run(async (ctx) => ctx.db.get(otherId));
    expect(other!.passwordSalt).not.toBe(user!.passwordSalt);
    expect(other!.passwordHash).not.toBe(user!.passwordHash);

    // Recompute independently at 150k iterations; must match what login accepts.
    const expected = await pbkdf2Hex(
      GOOD_PASSWORD,
      user!.passwordSalt as string,
      150000,
    );
    expect(user!.passwordHash).toBe(expected);
  });
});

describe("requireAdmin and logout", () => {
  async function loggedIn(t: ReturnType<typeof setup>) {
    const userId = await t.mutation(internal.auth.createAdminUser, {
      email: EMAIL,
    });
    const setupToken = await t.mutation(internal.auth.issueSetupToken, {
      userId,
    });
    await t.mutation(api.auth.setPassword, {
      token: setupToken,
      password: GOOD_PASSWORD,
    });
    const res = await t.mutation(api.auth.login, {
      email: EMAIL,
      password: GOOD_PASSWORD,
    });
    expect(res.ok).toBe(true);
    return { userId, token: res.token as string };
  }

  test("requireAdmin returns the userId for a live session", async () => {
    const t = setup();
    const { userId, token } = await loggedIn(t);
    const got = await t.run(async (ctx) => requireAdmin(ctx, token));
    expect(got).toBe(userId);
  });

  test("requireAdmin rejects an unknown token", async () => {
    const t = setup();
    await loggedIn(t);
    await expectThrows(
      t.run(async (ctx) => requireAdmin(ctx, "a".repeat(64))),
      "Not signed in",
    );
  });

  test("requireAdmin rejects an expired session", async () => {
    const t = setup();
    const { token } = await loggedIn(t);
    await t.run(async (ctx) => {
      const s = (await ctx.db.query("adminSessions").collect())[0];
      await ctx.db.patch(s._id, { expiresAt: Date.now() - 1 });
    });
    await expectThrows(
      t.run(async (ctx) => requireAdmin(ctx, token)),
      "Not signed in",
    );
  });

  test("logout deletes the session so the token stops working", async () => {
    const t = setup();
    const { token } = await loggedIn(t);
    await t.mutation(api.auth.logout, { token });
    const sessions = await t.run(async (ctx) =>
      ctx.db.query("adminSessions").collect(),
    );
    expect(sessions).toHaveLength(0);
    await expectThrows(
      t.run(async (ctx) => requireAdmin(ctx, token)),
      "Not signed in",
    );
  });
});

describe("issuePasswordReset (the only escape hatch)", () => {
  test("clears passwordSetAt, kills every session, and mints a usable fresh token", async () => {
    const t = setup();
    const userId = await t.mutation(internal.auth.createAdminUser, {
      email: EMAIL,
    });
    const first = await t.mutation(internal.auth.issueSetupToken, { userId });
    await t.mutation(api.auth.setPassword, {
      token: first,
      password: GOOD_PASSWORD,
    });
    // Two live sessions from two logins.
    const a = await t.mutation(api.auth.login, {
      email: EMAIL,
      password: GOOD_PASSWORD,
    });
    const b = await t.mutation(api.auth.login, {
      email: EMAIL,
      password: GOOD_PASSWORD,
    });
    expect(a.ok && b.ok).toBe(true);
    const oldHash = await t.run(
      async (ctx) => (await ctx.db.get(userId))!.passwordHash,
    );

    const fresh = await t.mutation(internal.auth.issuePasswordReset, {
      userId,
    });
    expect(fresh).toMatch(/^[0-9a-f]{64}$/);
    expect(fresh).not.toBe(first);

    // Both sessions are gone.
    const sessions = await t.run(async (ctx) =>
      ctx.db.query("adminSessions").collect(),
    );
    expect(sessions).toHaveLength(0);
    for (const tok of [a.token as string, b.token as string]) {
      await expectThrows(
        t.run(async (ctx) => requireAdmin(ctx, tok)),
        "Not signed in",
      );
    }

    // passwordSetAt cleared, so the fresh link works.
    const user = await t.run(async (ctx) => ctx.db.get(userId));
    expect(user!.passwordSetAt).toBeUndefined();

    const NEW_PASSWORD = "a brand new passphrase";
    await t.mutation(api.auth.setPassword, {
      token: fresh,
      password: NEW_PASSWORD,
    });
    const after = await t.run(async (ctx) => ctx.db.get(userId));
    expect(after!.passwordHash).not.toBe(oldHash);
    const relogin = await t.mutation(api.auth.login, {
      email: EMAIL,
      password: NEW_PASSWORD,
    });
    expect(relogin.ok).toBe(true);
    expect(relogin.token).toMatch(/^[0-9a-f]{64}$/);
    // The old password no longer works.
    await expectLoginFailure(
      t.mutation(api.auth.login, { email: EMAIL, password: GOOD_PASSWORD }),
      "Email or password is incorrect.",
    );
  });

  test("the superseded setup link cannot be used after a reset", async () => {
    const t = setup();
    const userId = await t.mutation(internal.auth.createAdminUser, {
      email: EMAIL,
    });
    const first = await t.mutation(internal.auth.issueSetupToken, { userId });
    await t.mutation(api.auth.setPassword, {
      token: first,
      password: GOOD_PASSWORD,
    });
    await t.mutation(internal.auth.issuePasswordReset, { userId });
    // `first` was burned when it was used; a reset must not resurrect it.
    await expectThrows(
      t.mutation(api.auth.setPassword, {
        token: first,
        password: "yet another passphrase",
      }),
      "invalid",
    );
  });
});

describe("login rate limiting", () => {
  test("the 11th login attempt for one email is blocked, and the block is per-email", async () => {
    const t = setup();
    const userId = await t.mutation(internal.auth.createAdminUser, {
      email: EMAIL,
    });
    const setupToken = await t.mutation(internal.auth.issueSetupToken, {
      userId,
    });
    await t.mutation(api.auth.setPassword, {
      token: setupToken,
      password: GOOD_PASSWORD,
    });

    // 10 wrong-password attempts are allowed through to the password check.
    for (let i = 0; i < 10; i++) {
      await expectLoginFailure(
        t.mutation(api.auth.login, { email: EMAIL, password: "wrong guess 1" }),
        "Email or password is incorrect.",
      );
    }
    // The 11th is refused by the limiter — even with the CORRECT password,
    // which proves the limit runs before the credential check.
    await expectLoginFailure(
      t.mutation(api.auth.login, { email: EMAIL, password: GOOD_PASSWORD }),
      "Too many",
    );

    // A different email is unaffected: it still reaches the credential check.
    await expectLoginFailure(
      t.mutation(api.auth.login, {
        email: "someone.else@example.com",
        password: GOOD_PASSWORD,
      }),
      "Email or password is incorrect.",
    );
  });
});

describe("failed login attempts are actually counted", () => {
  test("a wrong-password attempt persists limiter state instead of rolling back", async () => {
    const t = setup();
    const userId = await t.mutation(internal.auth.createAdminUser, {
      email: EMAIL,
    });
    const st = await t.mutation(internal.auth.issueSetupToken, { userId });
    await t.mutation(api.auth.setPassword, {
      token: st,
      password: GOOD_PASSWORD,
    });

    // Nine failures, then a tenth attempt with the CORRECT password. If the
    // failures had rolled back the limiter (which a throwing mutation does),
    // there would still be full budget left; instead only one slot remains,
    // so the eleventh call is refused.
    for (let i = 0; i < 9; i++) {
      await expectLoginFailure(
        t.mutation(api.auth.login, { email: EMAIL, password: "bad guess xyz" }),
        "Email or password is incorrect.",
      );
    }
    const tenth = await t.mutation(api.auth.login, {
      email: EMAIL,
      password: GOOD_PASSWORD,
    });
    expect(tenth.ok).toBe(true);

    await expectLoginFailure(
      t.mutation(api.auth.login, { email: EMAIL, password: GOOD_PASSWORD }),
      "Too many",
    );
  });
});
