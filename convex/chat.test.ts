import rateLimiterComponent from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob([
  "./**/*.ts",
  "./**/*.js",
  "!./**/*.test.ts",
  "!./**/*.d.ts",
]);

const generateTextMock = vi.hoisted(() => vi.fn());
vi.mock("ai", () => ({ generateText: generateTextMock }));
vi.mock("@ai-sdk/anthropic", () => ({ anthropic: vi.fn(() => "mock-model") }));

const SESSION = "session-12345678";
const SLOW_DOWN = "Slow down. Call Eric instead: (817) 894-6357.";
const FALLBACK_REPLY =
  "Can't reach the assistant right now. Call or email Eric direct — he answers.";

function setup() {
  const t = convexTest(schema, modules);
  rateLimiterComponent.register(t);
  return t;
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
  generateTextMock.mockReset();
  // Turnstile dev mode, deterministic regardless of host env.
  vi.stubEnv("TURNSTILE_SECRET_KEY", "");
  vi.stubEnv("TURNSTILE_REQUIRED", "");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.mocked(console.warn).mockRestore();
  vi.mocked(console.error).mockRestore();
});

describe("startThread", () => {
  test("creates a thread row for the session with messageCount 0", async () => {
    const t = setup();
    const threadId = await t.mutation(api.chat.startThread, {
      sessionId: SESSION,
    });
    const row = await t.run(async (ctx) => ctx.db.get(threadId));
    expect(row).not.toBeNull();
    expect(row!.sessionId).toBe(SESSION);
    expect(row!.messageCount).toBe(0);
    expect(row!.createdAt).toBeGreaterThan(0);
  });

  test.each([
    ["short", "too short"],
    ["a".repeat(65), "too long"],
    ["bad session id!", "illegal characters"],
  ])("rejects junk sessionId %j (%s)", async (sessionId) => {
    const t = setup();
    await expectConvexError(
      t.mutation(api.chat.startThread, { sessionId }),
      "Session invalid",
    );
  });

  test("7th thread for one session hits the per-session limit with the in-voice error", async () => {
    const t = setup();
    for (let i = 0; i < 6; i++) {
      await t.mutation(api.chat.startThread, { sessionId: SESSION });
    }
    await expectConvexError(
      t.mutation(api.chat.startThread, { sessionId: SESSION }),
      SLOW_DOWN,
    );
    // A different session is unaffected by the per-session window.
    await expect(
      t.mutation(api.chat.startThread, { sessionId: "other-session-1" }),
    ).resolves.toBeTruthy();
  });
});

describe("sendMessage validation", () => {
  test("rejects messages over 500 characters before doing any work", async () => {
    const t = setup();
    const threadId = await t.mutation(api.chat.startThread, {
      sessionId: SESSION,
    });
    await expectConvexError(
      t.action(api.chat.sendMessage, {
        threadId,
        sessionId: SESSION,
        text: "x".repeat(501),
      }),
      "Keep it under 500 characters.",
    );
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  test("rejects blank messages", async () => {
    const t = setup();
    const threadId = await t.mutation(api.chat.startThread, {
      sessionId: SESSION,
    });
    await expectConvexError(
      t.action(api.chat.sendMessage, {
        threadId,
        sessionId: SESSION,
        text: "   \n  ",
      }),
      "Type a question first.",
    );
  });

  test("rejects an invalid sessionId", async () => {
    const t = setup();
    const threadId = await t.mutation(api.chat.startThread, {
      sessionId: SESSION,
    });
    await expectConvexError(
      t.action(api.chat.sendMessage, {
        threadId,
        sessionId: "nope",
        text: "Do you weld aluminum?",
      }),
      "Session invalid",
    );
  });

  test("rejects a sessionId that does not own the thread", async () => {
    const t = setup();
    const threadId = await t.mutation(api.chat.startThread, {
      sessionId: SESSION,
    });
    generateTextMock.mockResolvedValue({ text: "hi" });
    await expectConvexError(
      t.action(api.chat.sendMessage, {
        threadId,
        sessionId: "someone-elses-session",
        text: "Do you weld aluminum?",
      }),
      "Chat session expired.",
    );
  });

  test("rejects once the thread holds 40 messages", async () => {
    const t = setup();
    const threadId = await t.mutation(api.chat.startThread, {
      sessionId: SESSION,
    });
    await t.run(async (ctx) => ctx.db.patch(threadId, { messageCount: 40 }));
    await expectConvexError(
      t.action(api.chat.sendMessage, {
        threadId,
        sessionId: SESSION,
        text: "One more question.",
      }),
      "This chat is full. Call Eric: (817) 894-6357.",
    );
    expect(generateTextMock).not.toHaveBeenCalled();
  });
});

describe("sendMessage replies", () => {
  test("returns the model reply, persists the exchange, and bumps messageCount", async () => {
    const t = setup();
    const threadId = await t.mutation(api.chat.startThread, {
      sessionId: SESSION,
    });
    generateTextMock.mockResolvedValue({ text: "Yes. Carbon and stainless." });

    const res = await t.action(api.chat.sendMessage, {
      threadId,
      sessionId: SESSION,
      text: "  Do you weld stainless?  ",
    });
    expect(res).toEqual({ text: "Yes. Carbon and stainless.", contact: false });

    const { thread, messages } = await t.run(async (ctx) => ({
      thread: await ctx.db.get(threadId),
      messages: await ctx.db
        .query("chatMessages")
        .withIndex("by_thread", (q) => q.eq("threadId", threadId))
        .collect(),
    }));
    expect(thread!.messageCount).toBe(2);
    expect(messages).toHaveLength(2);
    const user = messages.find((m) => m.role === "user")!;
    const bot = messages.find((m) => m.role === "assistant")!;
    expect(user.text).toBe("Do you weld stainless?"); // trimmed
    expect(bot.text).toBe("Yes. Carbon and stainless.");
    expect(bot.contact).toBe(false);

    // The model saw the system prompt and the user's trimmed message.
    const callArgs = generateTextMock.mock.calls[0][0];
    expect(callArgs.system).toContain("FAQ assistant on tidwellwelding.com");
    expect(callArgs.messages.at(-1)).toEqual({
      role: "user",
      content: "Do you weld stainless?",
    });
  });

  test("[CONTACT] token sets the contact flag and is stripped from the text", async () => {
    const t = setup();
    const threadId = await t.mutation(api.chat.startThread, {
      sessionId: SESSION,
    });
    generateTextMock.mockResolvedValue({
      text: "That needs Eric's eyes on it.\n[CONTACT]",
    });

    const res = await t.action(api.chat.sendMessage, {
      threadId,
      sessionId: SESSION,
      text: "Can you come out Saturday for a pipeline tie-in?",
    });
    expect(res.contact).toBe(true);
    expect(res.text).toBe("That needs Eric's eyes on it.");
    expect(res.text).not.toContain("[CONTACT]");

    const bot = await t.run(async (ctx) =>
      (
        await ctx.db
          .query("chatMessages")
          .withIndex("by_thread", (q) => q.eq("threadId", threadId))
          .collect()
      ).find((m) => m.role === "assistant"),
    );
    expect(bot!.contact).toBe(true);
  });

  test("a dollar figure in the reply is replaced by the pricing hand-off", async () => {
    const t = setup();
    const threadId = await t.mutation(api.chat.startThread, {
      sessionId: SESSION,
    });
    generateTextMock.mockResolvedValue({
      text: "Usually runs about $500 for that.",
    });

    const res = await t.action(api.chat.sendMessage, {
      threadId,
      sessionId: SESSION,
      text: "How much for a handrail?",
    });
    expect(res.text).toBe("Eric prices every job himself. Quotes are free.");
    expect(res.contact).toBe(true);
    expect(res.text).not.toContain("$500");
  });

  test("spaced dollar figures ($ 500) are caught by the post-filter too", async () => {
    const t = setup();
    const threadId = await t.mutation(api.chat.startThread, {
      sessionId: SESSION,
    });
    generateTextMock.mockResolvedValue({ text: "Roughly $ 500 out the door." });

    const res = await t.action(api.chat.sendMessage, {
      threadId,
      sessionId: SESSION,
      text: "Ballpark a gate for me",
    });
    expect(res.text).toBe("Eric prices every job himself. Quotes are free.");
    expect(res.contact).toBe(true);
  });

  test("model failure returns the fallback reply with contact:true and still logs the exchange", async () => {
    const t = setup();
    const threadId = await t.mutation(api.chat.startThread, {
      sessionId: SESSION,
    });
    generateTextMock.mockRejectedValue(new Error("upstream 529"));

    const res = await t.action(api.chat.sendMessage, {
      threadId,
      sessionId: SESSION,
      text: "Are you insured?",
    });
    expect(res).toEqual({ text: FALLBACK_REPLY, contact: true });

    const { thread, messages } = await t.run(async (ctx) => ({
      thread: await ctx.db.get(threadId),
      messages: await ctx.db
        .query("chatMessages")
        .withIndex("by_thread", (q) => q.eq("threadId", threadId))
        .collect(),
    }));
    expect(thread!.messageCount).toBe(2);
    expect(messages.find((m) => m.role === "assistant")!.text).toBe(
      FALLBACK_REPLY,
    );
  });

  test("empty model reply falls back with contact:true", async () => {
    const t = setup();
    const threadId = await t.mutation(api.chat.startThread, {
      sessionId: SESSION,
    });
    generateTextMock.mockResolvedValue({ text: "   " });

    const res = await t.action(api.chat.sendMessage, {
      threadId,
      sessionId: SESSION,
      text: "Hello?",
    });
    expect(res).toEqual({ text: FALLBACK_REPLY, contact: true });
  });

  test("sendMessage marks the session verified (turnstile dev mode)", async () => {
    const t = setup();
    const threadId = await t.mutation(api.chat.startThread, {
      sessionId: SESSION,
    });
    generateTextMock.mockResolvedValue({ text: "Sure." });
    await t.action(api.chat.sendMessage, {
      threadId,
      sessionId: SESSION,
      text: "Do you do mobile work?",
    });
    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("verifiedSessions")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", SESSION))
        .collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].expiresAt).toBeGreaterThan(Date.now());
  });
});

describe("sendMessage rate limiting", () => {
  test("11th message inside a minute hits the token bucket with the in-voice error", async () => {
    const t = setup();
    const threadId = await t.mutation(api.chat.startThread, {
      sessionId: SESSION,
    });
    generateTextMock.mockResolvedValue({ text: "Yep." });

    for (let i = 0; i < 10; i++) {
      const res = await t.action(api.chat.sendMessage, {
        threadId,
        sessionId: SESSION,
        text: `Question number ${i}`,
      });
      expect(res.text).toBe("Yep.");
    }
    await expectConvexError(
      t.action(api.chat.sendMessage, {
        threadId,
        sessionId: SESSION,
        text: "One too many",
      }),
      SLOW_DOWN,
    );
    // The rejected message was never sent to the model or stored.
    expect(generateTextMock).toHaveBeenCalledTimes(10);
    const thread = await t.run(async (ctx) => ctx.db.get(threadId));
    expect(thread!.messageCount).toBe(20);
  });
});
