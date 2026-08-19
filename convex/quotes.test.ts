import rateLimiterComponent from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
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
    constructor(_component: unknown, _options: unknown) {}
    sendEmailManually = sendEmailManuallyMock;
  },
}));
const sdkSendMock = vi.hoisted(() => vi.fn());
vi.mock("resend", () => ({
  Resend: class {
    constructor(_apiKey?: string) {}
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
  sdkSendMock.mockResolvedValue({ data: { id: "mock-provider-id" }, error: null });
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
      t.action(api.quotes.submitQuote, { ...baseArgs(), email: "not-an-email" }),
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

  test("long fields are clipped to the stored caps", async () => {
    const t = setup();
    await markSessionVerified(t);
    const res = await t.action(api.quotes.submitQuote, {
      ...baseArgs(),
      name: "N".repeat(300),
      job: { type: "Repair", desc: "d".repeat(4000), location: "L".repeat(600) },
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

    const ownerCall = sdkSendMock.mock.calls[0][0];
    expect(ownerCall.to).toBe(OWNER_EMAIL);
    expect(ownerCall.from).toBe("TSWS Website <quotes@tidwellwelding.com>");
    expect(ownerCall.subject).toContain(res.requestId);
    expect(ownerCall.subject).toContain("Jane Walker");
    expect(ownerCall.replyTo).toEqual([CUSTOMER_EMAIL]);
    expect(ownerCall.html).toContain("Jane Walker");
    expect(ownerCall.text).toContain(res.requestId);
    // The component wrapper's tracking id rides along for idempotency.
    expect(ownerCall.headers).toEqual({ "Idempotency-Key": "mock-email-id" });

    const customerCall = sdkSendMock.mock.calls[1][0];
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
    expect(sdkSendMock.mock.calls[0][0].to).toBe("delivered@resend.dev");
    expect(sdkSendMock.mock.calls[1][0].to).toBe("delivered@resend.dev");
  });

  test("no customer email and no replyTo when the submitter gave no address", async () => {
    const t = setup();
    await markSessionVerified(t);
    const { email: _omit, ...rest } = baseArgs();
    await t.action(api.quotes.submitQuote, rest);

    expect(sdkSendMock).toHaveBeenCalledTimes(1);
    const ownerCall = sdkSendMock.mock.calls[0][0];
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
