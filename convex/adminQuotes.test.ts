import rateLimiterComponent from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob([
  "./**/*.ts",
  "./**/*.js",
  "!./**/*.test.ts",
  "!./**/*.d.ts",
]);

/** auth.login is rate limited, so the component must be registered or every
 * sign-in in these tests throws before it reaches the credential check. */
function convexTestWithLimiter() {
  const t = convexTest(schema, modules);
  rateLimiterComponent.register(t);
  return t;
}

const PASSWORD = "a-long-enough-password";

async function signedIn(t: ReturnType<typeof convexTest>) {
  const userId = await t.mutation(internal.auth.createAdminUser, {
    email: "eric@tidwellwelding.com",
  });
  const setupToken = await t.mutation(internal.auth.issueSetupToken, {
    userId,
  });
  await t.mutation(api.auth.setPassword, {
    token: setupToken,
    password: PASSWORD,
  });
  const result = await t.mutation(api.auth.login, {
    email: "eric@tidwellwelding.com",
    password: PASSWORD,
  });
  if (!result.ok || !result.token)
    throw new Error("login failed in test setup");
  return result.token;
}

const JOB = {
  type: "Gate / fence",
  desc: "Ranch gate, 16 ft, with a walk-through",
  material: "A36",
};

/** A full AI draft in the on-the-wire snake_case the estimator produces. */
const ESTIMATE = {
  title: "16 ft ranch gate",
  summary: "Fabricate and hang a 16 ft gate with a walk-through.",
  line_items: [{ task: "Fabricate frame", crew: 1, hours: 8 }],
  hours_low: 8,
  hours_high: 12,
  dollars_low: 1200,
  dollars_high: 1800,
  confidence: "medium" as const,
  questions: ["Is there power at the site?"],
};

async function insertQuote(
  t: ReturnType<typeof convexTest>,
  overrides: Record<string, unknown> = {},
) {
  return await t.mutation(internal.quotes.insertQuote, {
    requestId: "Q-2026-101",
    name: "Marisol Serrano",
    phone: "(817) 555-0142",
    job: JOB,
    slot: "Thursday morning",
    ...overrides,
  });
}

describe("adminQuotes — authorization", () => {
  test("list refuses a caller with no session token", async () => {
    const t = convexTestWithLimiter();
    await insertQuote(t);

    await expect(t.query(api.adminQuotes.list, { token: "" })).rejects.toThrow(
      /not signed in/i,
    );
  });

  test("list refuses a made-up token", async () => {
    const t = convexTestWithLimiter();
    await insertQuote(t);

    await expect(
      t.query(api.adminQuotes.list, { token: "deadbeef".repeat(8) }),
    ).rejects.toThrow(/not signed in/i);
  });

  test("get refuses an unauthenticated caller, even with a real quote id", async () => {
    const t = convexTestWithLimiter();
    const id = await insertQuote(t);

    await expect(
      t.query(api.adminQuotes.get, { token: "nope", id }),
    ).rejects.toThrow(/not signed in/i);
  });

  test("an expired session cannot read the inbox", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    await insertQuote(t);

    // Age the session past its window rather than waiting 12 hours.
    await t.run(async (ctx) => {
      const session = await ctx.db
        .query("adminSessions")
        .withIndex("by_token", (q) => q.eq("token", token))
        .unique();
      if (!session) throw new Error("no session row");
      await ctx.db.patch(session._id, { expiresAt: Date.now() - 1000 });
    });

    await expect(t.query(api.adminQuotes.list, { token })).rejects.toThrow(
      /not signed in/i,
    );
  });
});

describe("adminQuotes — the inbox list", () => {
  test("newest requests come first", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);

    const first = await insertQuote(t, { requestId: "Q-2026-101" });
    await insertQuote(t, { requestId: "Q-2026-102" });
    // insertQuote stamps Date.now(); force a gap so the order is not a tie.
    await t.run(async (ctx) => {
      await ctx.db.patch(first, { createdAt: Date.now() - 60_000 });
    });

    const rows = await t.query(api.adminQuotes.list, { token });
    expect(rows.map((row) => row.requestId)).toEqual([
      "Q-2026-102",
      "Q-2026-101",
    ]);
  });

  test("a row carries the contact, job type and dollar range for the list", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    await insertQuote(t, { company: "Serrano Builds", estimate: ESTIMATE });

    const [row] = await t.query(api.adminQuotes.list, { token });
    expect(row.name).toBe("Marisol Serrano");
    expect(row.company).toBe("Serrano Builds");
    expect(row.jobType).toBe("Gate / fence");
    expect(row.dollarsLow).toBe(1200);
    expect(row.dollarsHigh).toBe(1800);
    expect(row.status).toBe("new");
  });

  test("a quote with no estimate omits the dollar range instead of showing zero", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    await insertQuote(t);

    const [row] = await t.query(api.adminQuotes.list, { token });
    expect(row.dollarsLow).toBeUndefined();
    expect(row.dollarsHigh).toBeUndefined();
  });

  test("the file count is zero for a quote taken before uploads existed", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    await insertQuote(t, {
      job: { ...JOB, photoNames: ["gate.jpg", "post.jpg"] },
    });

    const [row] = await t.query(api.adminQuotes.list, { token });
    expect(row.fileCount).toBe(0);
  });
});

describe("adminQuotes — one quote with its files", () => {
  test("files come back with a download URL for each upload", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);

    const storageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob(["fake-jpeg-bytes"], { type: "image/jpeg" })),
    );
    const id = await insertQuote(t, {
      files: [
        {
          storageId,
          name: "gate.jpg",
          contentType: "image/jpeg",
          size: 15,
        },
      ],
    });

    const quote = await t.query(api.adminQuotes.get, { token, id });
    expect(quote?.files).toHaveLength(1);
    expect(quote?.files[0].name).toBe("gate.jpg");
    expect(quote?.files[0].competitor).toBe(false);
    expect(typeof quote?.files[0].url).toBe("string");
  });

  test("a competitor quote is flagged so it is not mistaken for a photo", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);

    const storageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob(["%PDF-1.7"], { type: "application/pdf" })),
    );
    const id = await insertQuote(t, {
      files: [
        {
          storageId,
          name: "other-shop.pdf",
          contentType: "application/pdf",
          size: 8,
          kind: "competitor" as const,
        },
      ],
    });

    const quote = await t.query(api.adminQuotes.get, { token, id });
    expect(quote?.files[0].competitor).toBe(true);
  });

  test("a quote submitted before uploads existed reads back with an empty file list", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    const id = await insertQuote(t, {
      job: { ...JOB, photoNames: ["gate.jpg"] },
    });

    const quote = await t.query(api.adminQuotes.get, { token, id });
    // Not undefined and not an error: an older row simply has nothing attached.
    expect(quote?.files).toEqual([]);
    expect(quote?.job.photoNames).toEqual(["gate.jpg"]);
  });

  test("a file whose blob was deleted still lists, with no URL", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);

    const storageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob(["bytes"], { type: "image/jpeg" })),
    );
    const id = await insertQuote(t, {
      files: [
        { storageId, name: "gate.jpg", contentType: "image/jpeg", size: 5 },
      ],
    });
    await t.run(async (ctx) => ctx.storage.delete(storageId));

    const quote = await t.query(api.adminQuotes.get, { token, id });
    expect(quote?.files[0].name).toBe("gate.jpg");
    expect(quote?.files[0].url).toBeNull();
  });

  test("the estimate is normalised to camelCase for the console", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    const id = await insertQuote(t, { estimate: ESTIMATE });

    const quote = await t.query(api.adminQuotes.get, { token, id });
    expect(quote?.estimate).toEqual({
      title: "16 ft ranch gate",
      summary: "Fabricate and hang a 16 ft gate with a walk-through.",
      lineItems: [{ task: "Fabricate frame", crew: 1, hours: 8 }],
      hoursLow: 8,
      hoursHigh: 12,
      dollarsLow: 1200,
      dollarsHigh: 1800,
      confidence: "medium",
      questions: ["Is there power at the site?"],
    });
  });

  test("a draft that does not match the schema reads as no estimate, not a crash", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    const id = await insertQuote(t, { estimate: { title: "half a draft" } });

    const quote = await t.query(api.adminQuotes.get, { token, id });
    expect(quote?.estimate).toBeNull();
  });

  test("an id that no longer exists reads as null rather than throwing", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    const id = await insertQuote(t);
    await t.run(async (ctx) => ctx.db.delete(id));

    expect(await t.query(api.adminQuotes.get, { token, id })).toBeNull();
  });
});
