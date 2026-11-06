import rateLimiterComponent from "@convex-dev/rate-limiter/test";
import { ConvexError } from "convex/values";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Estimate } from "./estimate";
import schema from "./schema";

const modules = import.meta.glob([
  "./**/*.ts",
  "./**/*.js",
  "!./**/*.test.ts",
  "!./**/*.d.ts",
]);

// Mock both email layers so no email machinery runs at all: the Convex Resend
// component (tracking wrapper — submitQuote calls resend.sendEmailManually and
// the real send happens inside its callback) and the raw `resend` SDK whose
// emails.send carries the full html/text/replyTo/attachments payload.
const sendEmailManuallyMock = vi.hoisted(() => vi.fn());
vi.mock("@convex-dev/resend", () => ({
  Resend: class {
    sendEmailManually = sendEmailManuallyMock;
  },
}));
const sdkSendMock = vi.hoisted(() => vi.fn());
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sdkSendMock };
  },
}));

const SESSION = "quote-session-1234";
const OWNER_EMAIL = "eric@tidwellwelding.com";
const CUSTOMER_EMAIL = "jane@example.com";

function setup() {
  const t = convexTest(schema, modules);
  rateLimiterComponent.register(t);
  return t;
}

const baseArgs = (sessionId = SESSION) => ({
  name: "Jane Walker",
  phone: "(817) 555-0123",
  email: CUSTOMER_EMAIL,
  job: {
    type: "Fabrication",
    desc: "Build a steel gate frame, 6 ft by 4 ft.",
  },
  slot: "Tomorrow morning",
  sessionId,
});

async function markSessionVerified(
  t: ReturnType<typeof setup>,
  sessionId = SESSION,
) {
  await t.run(async (ctx) => {
    await ctx.db.insert("verifiedSessions", {
      sessionId,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
  });
}

async function expectConvexError(p: Promise<unknown>, snippet: string) {
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

beforeEach(() => {
  sendEmailManuallyMock.mockReset();
  // The component wrapper hands the callback a tracking emailId and expects it
  // to run the actual provider send.
  sendEmailManuallyMock.mockImplementation(
    async (
      _ctx: unknown,
      _opts: unknown,
      cb: (emailId: string) => Promise<string>,
    ) => cb("mock-email-id"),
  );
  sdkSendMock.mockReset();
  sdkSendMock.mockResolvedValue({
    data: { id: "mock-provider-id" },
    error: null,
  });
  // Simulate production: turnstile enforced, no secret shortcuts, no emails
  // unless a test opts in by stubbing RESEND_API_KEY.
  vi.stubEnv("TURNSTILE_SECRET_KEY", "");
  vi.stubEnv("TURNSTILE_REQUIRED", "true");
  vi.stubEnv("RESEND_API_KEY", "");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.mocked(console.warn).mockRestore();
  vi.mocked(console.error).mockRestore();
});

describe("turnstile gating", () => {
  test("a verified session is accepted without any token", async () => {
    const t = setup();
    await markSessionVerified(t);
    const res = await t.action(api.quotes.submitQuote, baseArgs());
    expect(res.ok).toBe(true);
    expect(res.requestId).toMatch(/^Q-\d{4}-\d{3}$/);
  });

  test("unverified session with no token is rejected when turnstile is required", async () => {
    const t = setup();
    await expectConvexError(
      t.action(api.quotes.submitQuote, baseArgs()),
      "Verification failed. Reload the page and try again.",
    );
    const rows = await t.run(async (ctx) => ctx.db.query("quotes").collect());
    expect(rows).toHaveLength(0);
    expect(sendEmailManuallyMock).not.toHaveBeenCalled();
    expect(sdkSendMock).not.toHaveBeenCalled();
  });

  test("a token cannot pass when TURNSTILE_REQUIRED=true and the secret is missing (fail closed)", async () => {
    const t = setup();
    await expectConvexError(
      t.action(api.quotes.submitQuote, {
        ...baseArgs(),
        turnstileToken: "some-token",
      }),
      "Verification failed.",
    );
  });

  test("a fresh token verified against siteverify is accepted without a session row", async () => {
    const t = setup();
    vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret-not-real");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await t.action(api.quotes.submitQuote, {
      ...baseArgs(),
      turnstileToken: "fresh-token",
    });
    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.anything(),
    );
  });
});

describe("input validation", () => {
  test("rejects a phone number that is not 10 or 11 digits", async () => {
    const t = setup();
    await markSessionVerified(t);
    await expectConvexError(
      t.action(api.quotes.submitQuote, { ...baseArgs(), phone: "555-0123" }),
      "Enter a 10-digit number.",
    );
  });

  test("rejects an invalid email but accepts a blank one", async () => {
    const t = setup();
    await markSessionVerified(t);
    await expectConvexError(
      t.action(api.quotes.submitQuote, {
        ...baseArgs(),
        email: "not-an-email",
      }),
      "Enter a valid email or leave it blank.",
    );
    const res = await t.action(api.quotes.submitQuote, {
      ...baseArgs(),
      email: "   ",
    });
    expect(res.ok).toBe(true);
  });

  test("rejects blank name, job type, description, and slot", async () => {
    const t = setup();
    await markSessionVerified(t);
    await expectConvexError(
      t.action(api.quotes.submitQuote, { ...baseArgs(), name: " " }),
      "Enter your name.",
    );
    await expectConvexError(
      t.action(api.quotes.submitQuote, {
        ...baseArgs(),
        job: { type: " ", desc: "x" },
      }),
      "Pick a job type.",
    );
    await expectConvexError(
      t.action(api.quotes.submitQuote, {
        ...baseArgs(),
        job: { type: "Repair", desc: " " },
      }),
      "Describe the job",
    );
    await expectConvexError(
      t.action(api.quotes.submitQuote, { ...baseArgs(), slot: " " }),
      "Pick a callback slot.",
    );
  });

  test("rejects oversize args before verification work", async () => {
    const t = setup();
    await markSessionVerified(t);
    await expectConvexError(
      t.action(api.quotes.submitQuote, {
        ...baseArgs(),
        name: "n".repeat(301),
      }),
      "An entry is too long.",
    );
    await expectConvexError(
      t.action(api.quotes.submitQuote, {
        ...baseArgs(),
        job: { type: "Repair", desc: "d".repeat(4001) },
      }),
      "An entry is too long.",
    );
    await expectConvexError(
      t.action(api.quotes.submitQuote, {
        ...baseArgs(),
        job: {
          type: "Repair",
          desc: "ok",
          photoNames: Array.from({ length: 21 }, (_, i) => `p${i}.jpg`),
        },
      }),
      "Too many photo names.",
    );
  });

  test("rejects a junk sessionId", async () => {
    const t = setup();
    await expectConvexError(
      t.action(api.quotes.submitQuote, baseArgs("bad!")),
      "Session invalid",
    );
  });
});

describe("failed attempts are kept as leads (issue #6)", () => {
  const failedRows = (t: ReturnType<typeof setup>) =>
    t.run(async (ctx) => ctx.db.query("failedQuotes").collect());

  test("a refused verification leaves a callable record and no quote", async () => {
    const t = setup();

    await expectConvexError(
      t.action(api.quotes.submitQuote, baseArgs()),
      "Verification failed.",
    );

    expect(
      await t.run(async (ctx) => ctx.db.query("quotes").collect()),
    ).toHaveLength(0);
    const rows = await failedRows(t);
    expect(rows).toHaveLength(1);
    expect(rows[0]!).toMatchObject({
      name: "Jane Walker",
      phone: "(817) 555-0123",
      email: CUSTOMER_EMAIL,
      slot: "Tomorrow morning",
      sessionId: SESSION,
      reason: "Verification failed. Reload the page and try again.",
      // No token at all: the visitor clicked before the widget solved.
      tokenPresent: false,
    });
    expect(rows[0]!.job).toMatchObject({
      type: "Fabrication",
      desc: "Build a steel gate frame, 6 ft by 4 ft.",
    });
  });

  test("a rejected token is recorded as a token that was present", async () => {
    const t = setup();

    await expectConvexError(
      t.action(api.quotes.submitQuote, {
        ...baseArgs(),
        turnstileToken: "stale-token",
      }),
      "Verification failed.",
    );

    const rows = await failedRows(t);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokenPresent).toBe(true);
  });

  test("any rejection is recorded, not just the verification ones", async () => {
    const t = setup();
    await markSessionVerified(t);

    await expectConvexError(
      t.action(api.quotes.submitQuote, {
        ...baseArgs(),
        job: { type: "Repair", desc: "d".repeat(4001) },
      }),
      "An entry is too long.",
    );

    const rows = await failedRows(t);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.reason).toBe(
      "An entry is too long. Shorten it and try again.",
    );
    // The oversize value that caused it is clipped on the way in.
    expect(rows[0]!.job?.desc).toHaveLength(4000);
  });

  test("an attempt with no way to reach anyone is not kept, while a reachable one is", async () => {
    const t = setup();

    // Same rejection twice: once with nothing to call or write to, once with
    // a good email. Only the second is a lead.
    await expectConvexError(
      t.action(api.quotes.submitQuote, {
        ...baseArgs(),
        phone: "555-0123",
        email: undefined,
      }),
      "Enter a 10-digit number.",
    );
    await expectConvexError(
      t.action(api.quotes.submitQuote, { ...baseArgs(), phone: "555-0123" }),
      "Enter a 10-digit number.",
    );

    const rows = await failedRows(t);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.email).toBe(CUSTOMER_EMAIL);
    expect(rows[0]!.reason).toBe("Enter a 10-digit number.");
  });

  test("a submission that lands adds nothing to the failed attempts", async () => {
    const t = setup();

    // One rejection, so the table is not trivially empty, then the same
    // request once the session is verified.
    await expectConvexError(
      t.action(api.quotes.submitQuote, baseArgs()),
      "Verification failed.",
    );
    expect(await failedRows(t)).toHaveLength(1);

    await markSessionVerified(t);
    expect((await t.action(api.quotes.submitQuote, baseArgs())).ok).toBe(true);

    expect(await failedRows(t)).toHaveLength(1);
    expect(
      await t.run(async (ctx) => ctx.db.query("quotes").collect()),
    ).toHaveLength(1);
  });

  test("records older than 90 days are pruned on the next write", async () => {
    const t = setup();
    const day = 24 * 60 * 60 * 1000;
    await t.run(async (ctx) => {
      await ctx.db.insert("failedQuotes", {
        phone: "(817) 555-0000",
        reason: "Verification failed.",
        tokenPresent: false,
        createdAt: Date.now() - 91 * day,
      });
      await ctx.db.insert("failedQuotes", {
        phone: "(817) 555-0001",
        reason: "Verification failed.",
        tokenPresent: false,
        createdAt: Date.now() - 89 * day,
      });
    });

    await expectConvexError(
      t.action(api.quotes.submitQuote, baseArgs()),
      "Verification failed.",
    );

    const phones = (await failedRows(t)).map((row) => row.phone);
    expect(phones).toHaveLength(2);
    expect(phones).toContain("(817) 555-0001");
    expect(phones).toContain("(817) 555-0123");
    expect(phones).not.toContain("(817) 555-0000");
  });
});

describe("requestId and stored row", () => {
  test("server generates a Q-YYYY-NNN id and stores the quote under it", async () => {
    const t = setup();
    await markSessionVerified(t);
    const year = new Date().getFullYear();
    const res = await t.action(api.quotes.submitQuote, baseArgs());
    expect(res.requestId).toMatch(new RegExp(`^Q-${year}-\\d{3}$`));

    const row = await t.run(async (ctx) =>
      ctx.db
        .query("quotes")
        .withIndex("by_requestId", (q) => q.eq("requestId", res.requestId))
        .unique(),
    );
    expect(row).not.toBeNull();
    expect(row!.name).toBe("Jane Walker");
    expect(row!.phone).toBe("(817) 555-0123");
    expect(row!.email).toBe(CUSTOMER_EMAIL);
    expect(row!.job.type).toBe("Fabrication");
    expect(row!.slot).toBe("Tomorrow morning");
    expect(row!.status).toBe("new");
    expect(row!.createdAt).toBeGreaterThan(0);
  });

  test("a client-supplied id in the valid format is kept", async () => {
    const t = setup();
    await markSessionVerified(t);
    const res = await t.action(api.quotes.submitQuote, {
      ...baseArgs(),
      requestId: "Q-2031-777",
    });
    expect(res.requestId).toBe("Q-2031-777");
  });

  // The generator draws from 900 ids per year, so by the birthday bound a
  // collision is likelier than not at ~35 quotes. These two pin Math.random so
  // the collision happens every run instead of 1-in-900: before insertQuote
  // claimed the id transactionally, both submissions were filed under one id
  // and the by_requestId lookup below threw "more than one result".
  test("a second quote cannot take an id the generator just handed out", async () => {
    const t = setup();
    // Every draw returns the low end of whichever space is in use, so each
    // 3-digit candidate is the same id the first quote already holds.
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    try {
      const year = new Date().getFullYear();
      await markSessionVerified(t, "collide-1");
      const first = await t.action(
        api.quotes.submitQuote,
        baseArgs("collide-1"),
      );
      expect(first.requestId).toBe(`Q-${year}-100`);

      await markSessionVerified(t, "collide-2");
      const second = await t.action(
        api.quotes.submitQuote,
        baseArgs("collide-2"),
      );
      expect(second.requestId).not.toBe(first.requestId);
      // The 3-digit space is exhausted for this draw, so the id widens.
      expect(second.requestId).toBe(`Q-${year}-1000`);

      const rows = await t.run(async (ctx) => ctx.db.query("quotes").collect());
      expect(rows).toHaveLength(2);
      // Both ids still resolve to exactly one row, which is what every
      // by_requestId lookup assumes.
      for (const requestId of [first.requestId, second.requestId]) {
        const row = await t.run(async (ctx) =>
          ctx.db
            .query("quotes")
            .withIndex("by_requestId", (q) => q.eq("requestId", requestId))
            .unique(),
        );
        expect(row).not.toBeNull();
      }
    } finally {
      random.mockRestore();
    }
  });

  test("a client-supplied id that is already taken is replaced", async () => {
    const t = setup();
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    try {
      await markSessionVerified(t, "reuse-session-1");
      const first = await t.action(api.quotes.submitQuote, {
        ...baseArgs("reuse-session-1"),
        requestId: "Q-2031-777",
      });
      expect(first.requestId).toBe("Q-2031-777");

      await markSessionVerified(t, "reuse-session-2");
      const second = await t.action(api.quotes.submitQuote, {
        ...baseArgs("reuse-session-2"),
        requestId: "Q-2031-777",
      });
      expect(second.requestId).not.toBe("Q-2031-777");
      expect(second.requestId).toMatch(/^Q-\d{4}-\d{3,4}$/);

      const row = await t.run(async (ctx) =>
        ctx.db
          .query("quotes")
          .withIndex("by_requestId", (q) => q.eq("requestId", "Q-2031-777"))
          .unique(),
      );
      expect(row).not.toBeNull();
    } finally {
      random.mockRestore();
    }
  });

  test("a client-supplied id in the wrong format is replaced server-side", async () => {
    const t = setup();
    await markSessionVerified(t);
    const res = await t.action(api.quotes.submitQuote, {
      ...baseArgs(),
      requestId: "DROP TABLE quotes",
    });
    expect(res.requestId).not.toBe("DROP TABLE quotes");
    expect(res.requestId).toMatch(/^Q-\d{4}-\d{3}$/);
  });

  test("a schema-valid estimate is stored; garbage estimates are dropped", async () => {
    const t = setup();
    const estimate: Estimate = {
      title: "Gate frame",
      summary: "Cut and weld. Inspect at the end.",
      line_items: [{ task: "Weld-out", crew: 1, hours: 4 }],
      hours_low: 4,
      hours_high: 6,
      dollars_low: 500,
      dollars_high: 1000,
      confidence: "medium",
      questions: [],
    };

    await markSessionVerified(t, "estimate-keeper-1");
    const kept = await t.action(api.quotes.submitQuote, {
      ...baseArgs("estimate-keeper-1"),
      estimate,
    });
    const keptRow = await t.run(async (ctx) =>
      ctx.db
        .query("quotes")
        .withIndex("by_requestId", (q) => q.eq("requestId", kept.requestId))
        .unique(),
    );
    expect(keptRow!.estimate).toEqual(estimate);

    await markSessionVerified(t, "estimate-dropper-1");
    const dropped = await t.action(api.quotes.submitQuote, {
      ...baseArgs("estimate-dropper-1"),
      estimate: { totally: "bogus", dollars_low: "a million" },
    });
    const droppedRow = await t.run(async (ctx) =>
      ctx.db
        .query("quotes")
        .withIndex("by_requestId", (q) => q.eq("requestId", dropped.requestId))
        .unique(),
    );
    expect(droppedRow!.estimate).toBeUndefined();
  });

  describe("server-side estimate drafts are keyed by job type", () => {
    const draft: Estimate = {
      title: "Bucket ear repair",
      summary: "Gouge and reweld the ear. Dress it after.",
      line_items: [{ task: "Weld-out", crew: 1, hours: 6 }],
      hours_low: 6,
      hours_high: 9,
      dollars_low: 1250,
      dollars_high: 2500,
      confidence: "low",
      questions: [],
    };

    async function seedDraft(
      t: ReturnType<typeof setup>,
      sessionId: string,
      jobType: string | undefined,
    ) {
      await t.run(async (ctx) => {
        await ctx.db.insert("estimateDrafts", {
          sessionId,
          ...(jobType === undefined ? {} : { jobType }),
          estimate: draft,
          createdAt: Date.now(),
        });
      });
    }

    async function storedEstimate(
      t: ReturnType<typeof setup>,
      requestId: string,
    ) {
      const row = await t.run(async (ctx) =>
        ctx.db
          .query("quotes")
          .withIndex("by_requestId", (q) => q.eq("requestId", requestId))
          .unique(),
      );
      return row!.estimate;
    }

    test("a draft for another job type is not attached", async () => {
      const t = setup();
      await markSessionVerified(t);
      await seedDraft(t, SESSION, "Heavy equipment repair");
      const res = await t.action(api.quotes.submitQuote, {
        ...baseArgs(),
        job: { type: "CNC plasma cutting / signs", desc: "Ranch sign." },
      });
      expect(await storedEstimate(t, res.requestId)).toBeUndefined();
    });

    test("a draft for the same job type is attached", async () => {
      const t = setup();
      await markSessionVerified(t);
      await seedDraft(t, SESSION, "Fabrication");
      const res = await t.action(api.quotes.submitQuote, baseArgs());
      expect(await storedEstimate(t, res.requestId)).toEqual(draft);
    });

    test("a legacy draft with no job type is not attached", async () => {
      const t = setup();
      await markSessionVerified(t);
      await seedDraft(t, SESSION, undefined);
      const res = await t.action(api.quotes.submitQuote, baseArgs());
      expect(await storedEstimate(t, res.requestId)).toBeUndefined();
    });
  });

  test("thickness and quantity are stored and reach the owner email", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-resend-key-not-real");
    vi.stubEnv("RESEND_TEST_MODE", "false");
    const t = setup();
    await markSessionVerified(t);
    const res = await t.action(api.quotes.submitQuote, {
      ...baseArgs(),
      job: {
        type: "CNC plasma cutting / signs",
        desc: "Ranch entry sign.",
        thickness: '3/16"',
        quantity: "4",
      },
    });
    const row = await t.run(async (ctx) =>
      ctx.db
        .query("quotes")
        .withIndex("by_requestId", (q) => q.eq("requestId", res.requestId))
        .unique(),
    );
    expect(row!.job).toMatchObject({ thickness: '3/16"', quantity: "4" });
    const ownerCall = sdkSendMock.mock.calls[0]![0];
    expect(ownerCall.text).toContain('Thickness: 3/16"');
    expect(ownerCall.text).toContain("Quantity: 4");
  });

  describe("uploaded files", () => {
    async function storeBlob(
      t: ReturnType<typeof setup>,
      bytes: number,
      type: string,
    ) {
      return await t.run(async (ctx) =>
        ctx.storage.store(new Blob([new Uint8Array(bytes)], { type })),
      );
    }

    async function blobExists(t: ReturnType<typeof setup>, id: string) {
      return await t.run(
        async (ctx) => (await ctx.db.system.get(id as never)) !== null,
      );
    }

    test("a .dxf is accepted for CNC, saved on the quote and linked in the owner email", async () => {
      vi.stubEnv("RESEND_API_KEY", "test-resend-key-not-real");
      vi.stubEnv("RESEND_TEST_MODE", "false");
      const t = setup();
      await markSessionVerified(t);
      const dxf = await storeBlob(t, 2048, "application/octet-stream");
      const photo = await storeBlob(t, 1024, "image/jpeg");
      const res = await t.action(api.quotes.submitQuote, {
        ...baseArgs(),
        job: { type: "CNC plasma cutting / signs", desc: "Ranch sign." },
        files: [
          { storageId: dxf, name: "sign.dxf" },
          { storageId: photo, name: "sketch.jpg" },
        ],
      });
      const row = await t.run(async (ctx) =>
        ctx.db
          .query("quotes")
          .withIndex("by_requestId", (q) => q.eq("requestId", res.requestId))
          .unique(),
      );
      // convex-test records no content type; production storage does.
      expect(row!.files).toEqual([
        {
          storageId: dxf,
          name: "sign.dxf",
          contentType: expect.any(String),
          size: 2048,
        },
        {
          storageId: photo,
          name: "sketch.jpg",
          contentType: expect.any(String),
          size: 1024,
        },
      ]);
      const ownerCall = sdkSendMock.mock.calls[0]![0];
      const links = [
        ...String(ownerCall.html).matchAll(
          /<a href="([^"]+)"[^>]*>(sign\.dxf|sketch\.jpg)<\/a>/g,
        ),
      ];
      expect(links.map((m) => m[2])).toEqual(["sign.dxf", "sketch.jpg"]);
      expect(ownerCall.text).toMatch(/File: sign\.dxf <\S+>/);
      expect(ownerCall.text).toMatch(/File: sketch\.jpg <\S+>/);
      // The customer copy carries no file links.
      expect(String(sdkSendMock.mock.calls[1]![0].html)).not.toContain(
        "sign.dxf",
      );
    });

    test("generateUploadUrl hands out a URL and refuses a junk session", async () => {
      const t = setup();
      const url = await t.mutation(api.uploads.generateUploadUrl, {
        sessionId: SESSION,
      });
      expect(typeof url).toBe("string");
      await expectConvexError(
        t.mutation(api.uploads.generateUploadUrl, { sessionId: "bad!" }),
        "Session invalid",
      );
    });

    test("a .dxf on a non-CNC job is refused and deleted", async () => {
      const t = setup();
      await markSessionVerified(t);
      const dxf = await storeBlob(t, 2048, "application/octet-stream");
      await expectConvexError(
        t.action(api.quotes.submitQuote, {
          ...baseArgs(),
          files: [{ storageId: dxf, name: "sign.dxf" }],
        }),
        "sign.dxf is not a file type this job takes.",
      );
      expect(await blobExists(t, dxf)).toBe(false);
    });

    test("an oversized photo is refused and every upload in the set is deleted", async () => {
      const t = setup();
      await markSessionVerified(t);
      const ok = await storeBlob(t, 1024, "image/jpeg");
      const big = await storeBlob(t, 10 * 1024 * 1024 + 1, "image/jpeg");
      await expectConvexError(
        t.action(api.quotes.submitQuote, {
          ...baseArgs(),
          files: [
            { storageId: ok, name: "ok.jpg" },
            { storageId: big, name: "big.jpg" },
          ],
        }),
        "big.jpg is over 10 MB.",
      );
      expect(await blobExists(t, ok)).toBe(false);
      expect(await blobExists(t, big)).toBe(false);
    });

    test("a competitor PDF is saved with the competitor marker and linked in the owner email only", async () => {
      vi.stubEnv("RESEND_API_KEY", "test-resend-key-not-real");
      vi.stubEnv("RESEND_TEST_MODE", "false");
      const t = setup();
      await markSessionVerified(t);
      const photo = await storeBlob(t, 1024, "image/jpeg");
      const pdf = await storeBlob(t, 4096, "application/pdf");
      const res = await t.action(api.quotes.submitQuote, {
        ...baseArgs(),
        job: { ...baseArgs().job, compQuote: "4,800" },
        files: [
          { storageId: photo, name: "gate.jpg" },
          { storageId: pdf, name: "other-shop.pdf", kind: "competitor" },
        ],
      });
      const row = await t.run(async (ctx) =>
        ctx.db
          .query("quotes")
          .withIndex("by_requestId", (q) => q.eq("requestId", res.requestId))
          .unique(),
      );
      expect(row!.files).toEqual([
        {
          storageId: photo,
          name: "gate.jpg",
          contentType: expect.any(String),
          size: 1024,
        },
        {
          storageId: pdf,
          name: "other-shop.pdf",
          contentType: expect.any(String),
          size: 4096,
          kind: "competitor",
        },
      ]);
      const owner = sdkSendMock.mock.calls[0]![0];
      expect(String(owner.html)).toMatch(
        /Competitor quote<\/td>.*<a href="[^"]+"[^>]*>other-shop\.pdf<\/a>/,
      );
      expect(owner.text).toContain("Quote they got: $4,800");
      expect(owner.text).toMatch(/Competitor quote: other-shop\.pdf <\S+>/);
      // Kept out of the main files list.
      expect(owner.text).not.toMatch(/File: other-shop\.pdf/);
      expect(owner.text).toMatch(/File: gate\.jpg <\S+>/);
      const customer = sdkSendMock.mock.calls[1]![0];
      expect(String(customer.html)).not.toContain("Competitor quote");
      expect(String(customer.html)).not.toContain("other-shop.pdf");
    });

    test("a .dxf in the competitor slot is refused and deleted", async () => {
      const t = setup();
      await markSessionVerified(t);
      const photo = await storeBlob(t, 1024, "image/jpeg");
      const dxf = await storeBlob(t, 2048, "application/octet-stream");
      await expectConvexError(
        t.action(api.quotes.submitQuote, {
          ...baseArgs(),
          job: { type: "CNC plasma cutting / signs", desc: "Ranch sign." },
          files: [
            { storageId: photo, name: "sketch.jpg" },
            { storageId: dxf, name: "bid.dxf", kind: "competitor" },
          ],
        }),
        "bid.dxf is not a photo or PDF.",
      );
      expect(await blobExists(t, photo)).toBe(false);
      expect(await blobExists(t, dxf)).toBe(false);
    });

    // Issue #21: the browser uploads before it calls submitQuote, so every
    // check that throws ahead of the insert used to leave the files behind.
    test("a field the form refuses deletes the uploads, while an accepted submission keeps them", async () => {
      const t = setup();
      await markSessionVerified(t);
      const photo = await storeBlob(t, 1024, "image/jpeg");
      const bid = await storeBlob(t, 2048, "application/pdf");
      await expectConvexError(
        t.action(api.quotes.submitQuote, {
          ...baseArgs(),
          phone: "555-012",
          files: [
            { storageId: photo, name: "gate.jpg" },
            { storageId: bid, name: "other-shop.pdf", kind: "competitor" },
          ],
        }),
        "Enter a 10-digit number.",
      );
      expect(await blobExists(t, photo)).toBe(false);
      expect(await blobExists(t, bid)).toBe(false);

      // The same files on a submission that lands stay in storage, and the
      // row that now owns them points at them.
      const kept = await storeBlob(t, 1024, "image/jpeg");
      await t.action(api.quotes.submitQuote, {
        ...baseArgs(),
        files: [{ storageId: kept, name: "gate.jpg" }],
      });
      expect(await blobExists(t, kept)).toBe(true);
      const row = await t.run(async (ctx) => ctx.db.query("quotes").first());
      expect(row?.files?.[0]?.storageId).toBe(kept);
    });

    test("a refused verification deletes the uploads", async () => {
      // No markSessionVerified and no token: the gate the quote form hits
      // most often in practice.
      const t = setup();
      const photo = await storeBlob(t, 1024, "image/jpeg");
      await expectConvexError(
        t.action(api.quotes.submitQuote, {
          ...baseArgs(),
          files: [{ storageId: photo, name: "gate.jpg" }],
        }),
        "Verification failed.",
      );
      expect(await blobExists(t, photo)).toBe(false);
    });
  });

  test("long fields are clipped to the stored caps", async () => {
    const t = setup();
    await markSessionVerified(t);
    const res = await t.action(api.quotes.submitQuote, {
      ...baseArgs(),
      name: "N".repeat(300),
      job: {
        type: "Repair",
        desc: "d".repeat(4000),
        location: "L".repeat(600),
      },
    });
    const row = await t.run(async (ctx) =>
      ctx.db
        .query("quotes")
        .withIndex("by_requestId", (q) => q.eq("requestId", res.requestId))
        .unique(),
    );
    expect(row!.name).toHaveLength(120);
    expect(row!.job.desc).toHaveLength(4000);
    expect(row!.job.location).toHaveLength(300);
  });
});

describe("email sending (Resend component and SDK mocked)", () => {
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "test-resend-key-not-real");
    // Leave test mode so recipients are the real addresses, not the sink.
    vi.stubEnv("RESEND_TEST_MODE", "false");
  });

  test("sends the owner notification and the customer confirmation", async () => {
    const t = setup();
    await markSessionVerified(t);
    const res = await t.action(api.quotes.submitQuote, baseArgs());

    expect(sendEmailManuallyMock).toHaveBeenCalledTimes(2);
    expect(sdkSendMock).toHaveBeenCalledTimes(2);

    const ownerCall = sdkSendMock.mock.calls[0]![0];
    expect(ownerCall.to).toBe(OWNER_EMAIL);
    expect(ownerCall.from).toBe("TSWS Website <quotes@tidwellwelding.com>");
    expect(ownerCall.subject).toContain(res.requestId);
    expect(ownerCall.subject).toContain("Jane Walker");
    expect(ownerCall.replyTo).toEqual([CUSTOMER_EMAIL]);
    expect(ownerCall.html).toContain("Jane Walker");
    expect(ownerCall.text).toContain(res.requestId);
    // The component wrapper's tracking id rides along for idempotency.
    expect(ownerCall.headers).toEqual({ "Idempotency-Key": "mock-email-id" });

    const customerCall = sdkSendMock.mock.calls[1]![0];
    expect(customerCall.to).toBe(CUSTOMER_EMAIL);
    expect(customerCall.subject).toBe(
      `Request ${res.requestId} received — Tidwell Specialty Welding`,
    );
    expect(customerCall.replyTo).toBeUndefined();
  });

  test("test mode redirects every send to the Resend sink address", async () => {
    vi.stubEnv("RESEND_TEST_MODE", "");
    const t = setup();
    await markSessionVerified(t);
    await t.action(api.quotes.submitQuote, baseArgs());
    expect(sdkSendMock).toHaveBeenCalledTimes(2);
    expect(sdkSendMock.mock.calls[0]![0].to).toBe("delivered@resend.dev");
    expect(sdkSendMock.mock.calls[1]![0].to).toBe("delivered@resend.dev");
  });

  test("no customer email and no replyTo when the submitter gave no address", async () => {
    const t = setup();
    await markSessionVerified(t);
    const { email: _omit, ...rest } = baseArgs();
    await t.action(api.quotes.submitQuote, rest);

    expect(sdkSendMock).toHaveBeenCalledTimes(1);
    const ownerCall = sdkSendMock.mock.calls[0]![0];
    expect(ownerCall.to).toBe(OWNER_EMAIL);
    expect(ownerCall.replyTo).toBeUndefined();
  });

  test("a failed owner email does not fail the submission", async () => {
    const t = setup();
    await markSessionVerified(t);
    sdkSendMock.mockRejectedValue(new Error("resend down"));
    const res = await t.action(api.quotes.submitQuote, baseArgs());
    expect(res.ok).toBe(true);
    // Both sends were still attempted.
    expect(sdkSendMock).toHaveBeenCalledTimes(2);
  });

  test("skips email entirely when RESEND_API_KEY is unset", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const t = setup();
    await markSessionVerified(t);
    const res = await t.action(api.quotes.submitQuote, baseArgs());
    expect(res.ok).toBe(true);
    expect(sendEmailManuallyMock).not.toHaveBeenCalled();
    expect(sdkSendMock).not.toHaveBeenCalled();
  });
});

describe("rate limiting", () => {
  test("6th submission from one session hits the per-session limit with the in-voice error", async () => {
    const t = setup();
    await markSessionVerified(t);
    for (let i = 0; i < 5; i++) {
      const res = await t.action(api.quotes.submitQuote, baseArgs());
      expect(res.ok).toBe(true);
    }
    await expectConvexError(
      t.action(api.quotes.submitQuote, baseArgs()),
      "Slow down. Call Eric instead: (817) 894-6357.",
    );
    const rows = await t.run(async (ctx) => ctx.db.query("quotes").collect());
    expect(rows).toHaveLength(5);
  });
});
