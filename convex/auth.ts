import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { ConvexError, v } from "convex/values";
import { components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";
import { roleValidator } from "./lib/permissions";

// 10 attempts per 15 minutes per email address.
const loginLimiter = new RateLimiter(components.rateLimiter, {
  adminLogin: { kind: "fixed window", rate: 10, period: 15 * MINUTE },
});

export const SETUP_TOKEN_TTL_MS = 72 * 60 * 60 * 1000;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return toHex(new Uint8Array(digest));
}

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);
  return toHex(bytes);
}

/**
 * Create an account by hand, from the CLI or the local seed. Internal only —
 * there is deliberately no public registration path anywhere in the API; the
 * console invites people through people:invite. Defaults to owner because
 * this is how the first owner is bootstrapped. The account starts with no
 * password; a setup link is issued separately.
 */
export const createAdminUser = internalMutation({
  args: {
    email: v.string(),
    role: v.optional(roleValidator),
    name: v.optional(v.string()),
    title: v.optional(v.string()),
    supervisorId: v.optional(v.id("adminUsers")),
  },
  handler: async (ctx, { email, role = "owner", ...profile }) => {
    const existing = await ctx.db
      .query("adminUsers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (existing) throw new ConvexError("An admin with that email exists.");
    const userId = await ctx.db.insert("adminUsers", {
      email,
      role,
      status: "invited",
      ...profile,
      createdAt: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      action: "user.create",
      targetId: userId,
      after: { email, role, ...profile },
      at: Date.now(),
    });
    return userId;
  },
});

/**
 * Mint a one-time set-password link and burn every older one for the user, so
 * only the newest link ever works. Only the hash is persisted; the plaintext
 * is returned once, to the caller that emails or prints it.
 */
export async function mintSetupToken(
  ctx: MutationCtx,
  userId: Id<"adminUsers">,
  purpose: "invite" | "reset",
): Promise<string> {
  await burnSetupTokens(ctx, userId);
  const token = randomHex(32);
  const now = Date.now();
  await ctx.db.insert("setupTokens", {
    tokenHash: await sha256Hex(token),
    userId,
    purpose,
    expiresAt: now + SETUP_TOKEN_TTL_MS,
    createdAt: now,
  });
  return token;
}

export async function burnSetupTokens(
  ctx: MutationCtx,
  userId: Id<"adminUsers">,
): Promise<void> {
  const now = Date.now();
  const rows = await ctx.db
    .query("setupTokens")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  for (const row of rows) {
    if (row.usedAt === undefined) await ctx.db.patch(row._id, { usedAt: now });
  }
}

export async function revokeSessions(
  ctx: MutationCtx,
  userId: Id<"adminUsers">,
): Promise<void> {
  const sessions = await ctx.db
    .query("adminSessions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  for (const s of sessions) await ctx.db.delete(s._id);
}

/**
 * Wipe the password itself, not just the marker: the old password must stop
 * working the moment a reset is issued, not once a new one is set. Every live
 * session goes with it.
 */
export async function clearCredentials(
  ctx: MutationCtx,
  userId: Id<"adminUsers">,
): Promise<void> {
  await ctx.db.patch(userId, {
    passwordHash: undefined,
    passwordSalt: undefined,
    passwordSetAt: undefined,
  });
  await revokeSessions(ctx, userId);
}

/** CLI form of an invite: prints the link instead of emailing it. */
export const issueSetupToken = internalMutation({
  args: { userId: v.id("adminUsers") },
  returns: v.string(),
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError("No such admin user.");
    if (user.passwordSetAt !== undefined) {
      throw new ConvexError(
        "That account already has a password. Use issuePasswordReset.",
      );
    }
    return await mintSetupToken(ctx, userId, "invite");
  },
});

const PBKDF2_ITERATIONS = 150_000;
const MIN_PASSWORD_LENGTH = 12;

async function derivePasswordHash(
  password: string,
  saltHex: string,
): Promise<string> {
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const saltBytes = saltHex.match(/.{2}/g);
  if (!saltBytes) throw new Error("Password salt is empty");
  const salt = Uint8Array.from(saltBytes.map((h) => Number.parseInt(h, 16)));
  const bits = await globalThis.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return toHex(new Uint8Array(bits));
}

/**
 * Consume a one-time setup link and set the password. The token is burned and
 * passwordSetAt is stamped in the same transaction as the hash write, so a
 * replayed link can never take effect.
 */

/**
 * Why a setup link cannot be used — or that it can — so the page can say which
 * of these actually happened instead of a form that will only fail on submit.
 *
 * This used to be a bare boolean, and the single false meant four different
 * situations were indistinguishable: a token that was never issued, one that
 * was already spent, one that timed out, and an account that already has a
 * password. Worse, the page's catch-all turned "the backend is unreachable"
 * into the same screen, so a perfectly valid link on a misconfigured
 * deployment read as "used up" with no error anywhere. Naming the state is
 * what makes those cases tellable apart.
 *
 * Deliberately still says nothing about *whose* token it is: no email, no user
 * id. A link that reached the wrong person must not reveal whose account it
 * belongs to — it only names why the holder's own token failed. This is a
 * convenience for the UI, not the security boundary: setPassword re-checks
 * every condition inside the transaction that burns the token.
 */
const setupTokenState = v.union(
  v.object({ state: v.literal("valid") }),
  v.object({ state: v.literal("unknown") }),
  v.object({ state: v.literal("spent") }),
  v.object({ state: v.literal("expired") }),
  v.object({ state: v.literal("already_set") }),
);

export const checkSetupToken = query({
  args: { token: v.string() },
  returns: setupTokenState,
  handler: async (ctx, { token }) => {
    const tokenHash = await sha256Hex(token);
    const row = await ctx.db
      .query("setupTokens")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (!row) return { state: "unknown" as const };
    // Spent is checked before expired: a burned token is burned regardless of
    // whether its 72h window also ran out while it sat in an inbox.
    if (row.usedAt !== undefined) return { state: "spent" as const };
    if (row.expiresAt <= Date.now()) return { state: "expired" as const };

    const user = await ctx.db.get(row.userId);
    // A token pointing at an account that no longer exists is as good as one
    // that was never issued, and saying so leaks nothing extra.
    if (!user || user.status === "deactivated") {
      return { state: "unknown" as const };
    }
    if (user.passwordSetAt !== undefined) {
      return { state: "already_set" as const };
    }

    return { state: "valid" as const };
  },
});

export const setPassword = mutation({
  args: { token: v.string(), password: v.string() },
  returns: v.null(),
  handler: async (ctx, { token, password }) => {
    const tokenHash = await sha256Hex(token);
    const row = await ctx.db
      .query("setupTokens")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (!row) throw new ConvexError("That link is invalid or has expired.");
    if (row.usedAt !== undefined || row.expiresAt <= Date.now()) {
      throw new ConvexError("That link is invalid or has expired.");
    }
    const user = await ctx.db.get(row.userId);
    if (!user || user.status === "deactivated") {
      throw new ConvexError("That link is invalid or has expired.");
    }
    // Belt and braces: even a pristine token cannot re-set an existing password.
    if (user.passwordSetAt !== undefined) {
      throw new ConvexError("That link is invalid or has expired.");
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new ConvexError(
        `Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
    }

    const passwordSalt = randomHex(16);
    const passwordHash = await derivePasswordHash(password, passwordSalt);
    const now = Date.now();
    // One transaction: hash written, token burned, password marked as set.
    await ctx.db.patch(row.userId, {
      passwordHash,
      passwordSalt,
      passwordSetAt: now,
      status: "active",
    });
    await ctx.db.patch(row._id, { usedAt: now });
    return null;
  },
});

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/** Length-independent equality so a wrong hash cannot be found byte by byte. */
function constantTimeEquals(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

/**
 * Password login. Failure is a RETURNED value, not a thrown error: a Convex
 * mutation that throws rolls back every write it made, including the rate
 * limiter's counter, which would make failed attempts free. Returning the
 * failure lets the attempt commit and actually be counted.
 *
 * Every failure mode — unknown email, no password set yet, or a wrong password
 * — returns the same message, so the endpoint is not an account-existence
 * oracle.
 */
export const login = mutation({
  args: { email: v.string(), password: v.string() },
  returns: v.object({
    ok: v.boolean(),
    token: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, { email, password }) => {
    // Throttle before touching credentials, so brute force is capped no matter
    // how cheap the guess is.
    const limit = await loginLimiter.limit(ctx, "adminLogin", { key: email });
    if (!limit.ok) {
      return {
        ok: false,
        error: "Too many sign-in attempts. Try again later.",
      };
    }

    const deny = { ok: false, error: "Email or password is incorrect." };

    const user = await ctx.db
      .query("adminUsers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    // passwordSetAt is the "this account has a live password" marker. Checking
    // it here is defense in depth alongside issuePasswordReset wiping the hash:
    // a credential left behind by any path must not authenticate.
    if (
      !user?.passwordHash ||
      !user.passwordSalt ||
      user.passwordSetAt === undefined ||
      user.status === "deactivated"
    ) {
      return deny;
    }

    const attempt = await derivePasswordHash(password, user.passwordSalt);
    if (!constantTimeEquals(attempt, user.passwordHash)) return deny;

    const token = randomHex(32);
    const now = Date.now();
    const expiresAt = now + SESSION_TTL_MS;
    await ctx.db.insert("adminSessions", {
      token,
      userId: user._id,
      expiresAt,
      createdAt: now,
    });
    return { ok: true, token, expiresAt };
  },
});

/**
 * Gate for every admin-only function in other modules. Not a Convex function
 * itself — call it at the top of a handler with the caller's session token.
 */
export async function requireAdmin(
  ctx: { db: { query: QueryCtx["db"]["query"] } },
  token: string,
): Promise<Id<"adminUsers">> {
  const session = await ctx.db
    .query("adminSessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
  if (!session || session.expiresAt <= Date.now()) {
    throw new ConvexError("Not signed in.");
  }
  return session.userId;
}

/** Sign out by destroying the session row. */
export const logout = mutation({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, { token }) => {
    const session = await ctx.db
      .query("adminSessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (session) await ctx.db.delete(session._id);
    return null;
  },
});

/**
 * CLI form of a reset, for when nobody who could send one from the console is
 * able to sign in. Wipes the password, revokes every session and prints a
 * fresh one-time link. The console's version is people:sendLink.
 */
export const issuePasswordReset = internalMutation({
  args: { userId: v.id("adminUsers") },
  returns: v.string(),
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError("No such admin user.");
    await clearCredentials(ctx, userId);
    return await mintSetupToken(ctx, userId, "reset");
  },
});
