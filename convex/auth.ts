import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { ConvexError, v } from "convex/values";
import { components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server";

// 10 attempts per 15 minutes per email address.
const loginLimiter = new RateLimiter(components.rateLimiter, {
  adminLogin: { kind: "fixed window", rate: 10, period: 15 * MINUTE },
});

const SETUP_TOKEN_TTL_MS = 48 * 60 * 60 * 1000;

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
 * Create the single operator account. Internal only — there is deliberately no
 * public registration path anywhere in the API. The account starts with no
 * password; a setup link is issued separately.
 */
export const createAdminUser = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const existing = await ctx.db
      .query("adminUsers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (existing) throw new ConvexError("An admin with that email exists.");
    return await ctx.db.insert("adminUsers", { email, createdAt: Date.now() });
  },
});

/**
 * Mint a one-time set-password link. Only the token's hash is persisted, so
 * reading the table never yields a usable link. The plaintext is returned once,
 * to the internal caller (CLI or email job).
 */
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
    const token = randomHex(32);
    await ctx.db.insert("setupTokens", {
      tokenHash: await sha256Hex(token),
      userId,
      expiresAt: Date.now() + SETUP_TOKEN_TTL_MS,
      createdAt: Date.now(),
    });
    return token;
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
  const salt = Uint8Array.from(
    saltHex.match(/.{2}/g)!.map((h) => Number.parseInt(h, 16)),
  );
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
 * Whether a setup link is still usable, so the page can show "this link has
 * already been used" instead of a form that will only fail on submit.
 *
 * Returns a bare boolean on purpose: a link that reached the wrong person must
 * not confirm that an account exists or reveal whose it is. This is a
 * convenience for the UI, not the security boundary — setPassword re-checks
 * every condition inside the transaction that burns the token.
 */
export const checkSetupToken = query({
  args: { token: v.string() },
  returns: v.object({ valid: v.boolean() }),
  handler: async (ctx, { token }) => {
    const tokenHash = await sha256Hex(token);
    const row = await ctx.db
      .query("setupTokens")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (!row) return { valid: false };
    if (row.usedAt !== undefined || row.expiresAt <= Date.now()) {
      return { valid: false };
    }

    const user = await ctx.db.get(row.userId);
    if (!user || user.passwordSetAt !== undefined) return { valid: false };

    return { valid: true };
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
    if (!user) throw new ConvexError("That link is invalid or has expired.");
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
      return { ok: false, error: "Too many sign-in attempts. Try again later." };
    }

    const deny = { ok: false, error: "Email or password is incorrect." };

    const user = await ctx.db
      .query("adminUsers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (!user || !user.passwordHash || !user.passwordSalt) return deny;

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
 * The only escape hatch: run this from the Convex CLI or dashboard if the
 * password is lost. Clears passwordSetAt, revokes every live session, and
 * mints a fresh one-time link. Deliberately internal — never reachable from
 * the browser.
 */
export const issuePasswordReset = internalMutation({
  args: { userId: v.id("adminUsers") },
  returns: v.string(),
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError("No such admin user.");

    await ctx.db.patch(userId, { passwordSetAt: undefined });

    const sessions = await ctx.db
      .query("adminSessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const s of sessions) await ctx.db.delete(s._id);

    const token = randomHex(32);
    await ctx.db.insert("setupTokens", {
      tokenHash: await sha256Hex(token),
      userId,
      expiresAt: Date.now() + SETUP_TOKEN_TTL_MS,
      createdAt: Date.now(),
    });
    return token;
  },
});
