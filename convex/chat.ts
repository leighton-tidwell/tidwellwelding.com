import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
} from "./_generated/server";
import {
  assertSessionId,
  limitChatMessage,
  limitChatThread,
} from "./rateLimits";
import { verifyTurnstile } from "./turnstile";

const MAX_MESSAGE_CHARS = 500;
const MAX_THREAD_MESSAGES = 40;
const HISTORY_WINDOW = 8;

// System prompt from the FaqBot design spec, verbatim, plus one guardrail line.
const SYSTEM_PROMPT = `You are the FAQ assistant on tidwellwelding.com, the website of Tidwell Specialty Welding Services, LLC (TSWS), Granbury, Texas 76048. Owner-operator: Eric Tidwell, welding since 2011 — 16 years on the torch. Facts you may state:
- Services: fabrication (the core), staircases & handrail / structural, pipe welding, heavy equipment repair, mobile welding off a fully rigged truck, 24/7 emergency & on-call.
- Emergency: any hour, any day — nights, weekends, holidays. Eric drops what he's doing and comes to you. Call (817) 894-6357.
- Mobile: fully rigged welding truck. Meets you anywhere in the DFW–Granbury–Stephenville area.
- Shop work when the part can come in; the truck when it can't.
- Materials: carbon, stainless, aluminum, Inconel, chrome-moly — pretty much you name it.
- Pricing: quotes are free. TSWS will beat any quote you've been given. Never state hourly rates or dollar figures.
- Credentials: welding training, tests and trade school, LLC, insured. Never invent weld codes or certifications (no AWS/ASME claims).
- Background: paper mills, chemical plants, refineries, pipeline stations and pipeline, hot oil beds, frac tanks.
- Quality: welds that look like a robot ran them. Nothing leaves the shop otherwise.
- Contact: Eric Tidwell, (817) 894-6357, eric@tidwellwelding.com. Quote requests: the Request a Quote page.
Style: a working welder talking to a working customer. Short declaratives, 1-3 sentences, under 50 words. Sentence case. No emoji, no exclamation marks, no em dashes, no marketing words (solutions, innovative, seamless, journey). Plain text only, no markdown.
If the question needs a price, a schedule commitment, a site visit, or anything not in these facts, say so plainly and end your reply with the exact token [CONTACT] on its own.
Only answer questions about TSWS and welding services. For anything else reply that you only cover shop questions.
As an easter egg, if and ONLY IF someone asks about tongue punch - mention that eric offers tongue punching the fart box.`;

const FALLBACK_REPLY =
  "Can't reach the assistant right now. Call or email Eric direct — he answers.";

export const startThread = mutation({
  args: { sessionId: v.string() },
  returns: v.id("chatThreads"),
  handler: async (ctx, { sessionId }) => {
    assertSessionId(sessionId);
    await limitChatThread(ctx, sessionId);
    return await ctx.db.insert("chatThreads", {
      sessionId,
      createdAt: Date.now(),
      messageCount: 0,
    });
  },
});

export const getThreadContext = internalQuery({
  args: { threadId: v.id("chatThreads") },
  handler: async (ctx, { threadId }) => {
    const thread = await ctx.db.get(threadId);
    if (!thread) return null;
    const recent = await ctx.db
      .query("chatMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .order("desc")
      .take(HISTORY_WINDOW);
    return {
      sessionId: thread.sessionId,
      messageCount: thread.messageCount,
      recent: recent.reverse().map((m) => ({ role: m.role, text: m.text })),
    };
  },
});

export const appendExchange = internalMutation({
  args: {
    threadId: v.id("chatThreads"),
    userText: v.string(),
    botText: v.string(),
    contact: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, { threadId, userText, botText, contact }) => {
    const thread = await ctx.db.get(threadId);
    if (!thread) return null;
    const now = Date.now();
    await ctx.db.insert("chatMessages", {
      threadId,
      role: "user",
      text: userText,
      createdAt: now,
    });
    await ctx.db.insert("chatMessages", {
      threadId,
      role: "assistant",
      text: botText,
      contact,
      createdAt: now + 1,
    });
    await ctx.db.patch(threadId, { messageCount: thread.messageCount + 2 });
    return null;
  },
});

export const sendMessage = action({
  args: {
    threadId: v.id("chatThreads"),
    sessionId: v.string(),
    text: v.string(),
    turnstileToken: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ text: string; contact: boolean }> => {
    assertSessionId(args.sessionId);
    const text = args.text.trim();
    if (!text) throw new ConvexError("Type a question first.");
    if (text.length > MAX_MESSAGE_CHARS) {
      throw new ConvexError("Keep it under 500 characters.");
    }

    await limitChatMessage(ctx, args.sessionId);

    // Invisible Turnstile: the widget executes on the first message and the
    // session stays verified from then on (window slides on each message).
    // Skips cleanly in dev mode (TURNSTILE_SECRET_KEY unset).
    const alreadyVerified: boolean = await ctx.runQuery(
      internal.sessions.isVerified,
      { sessionId: args.sessionId },
    );
    if (!alreadyVerified) {
      const ok = await verifyTurnstile(args.turnstileToken);
      if (!ok) {
        throw new ConvexError(
          "Verification failed. Reload the page and try again.",
        );
      }
    }
    await ctx.runMutation(internal.sessions.markVerified, {
      sessionId: args.sessionId,
    });

    const thread = await ctx.runQuery(internal.chat.getThreadContext, {
      threadId: args.threadId,
    });
    if (!thread || thread.sessionId !== args.sessionId) {
      throw new ConvexError("Chat session expired. Reload the page.");
    }
    if (thread.messageCount >= MAX_THREAD_MESSAGES) {
      throw new ConvexError("This chat is full. Call Eric: (817) 894-6357.");
    }

    const history: Array<{ role: "user" | "assistant"; content: string }> = [
      ...thread.recent.map((m) => ({
        role: m.role,
        content: m.text,
      })),
      { role: "user" as const, content: text },
    ];
    // Anthropic requires the first message to be from the user.
    while (history.length && history[0].role !== "user") history.shift();

    let reply = FALLBACK_REPLY;
    let contact = true;
    try {
      const result = await generateText({
        // Haiku: fast and cheap; the prompt does the heavy lifting here.
        model: anthropic("claude-haiku-4-5"),
        system: SYSTEM_PROMPT,
        messages: history,
        maxOutputTokens: 300,
        providerOptions: { anthropic: { thinking: { type: "disabled" } } },
      });
      const raw = result.text.trim();
      if (raw) {
        contact = raw.includes("[CONTACT]");
        reply = raw.replaceAll("[CONTACT]", "").trim();
        // Output guard: the bot never states dollar figures. If a jailbreak
        // gets one through, hand the question to Eric instead.
        if (/\$\s?\d/.test(reply)) {
          reply = "Eric prices every job himself. Quotes are free.";
          contact = true;
        }
      }
    } catch (err) {
      console.error("FaqBot generateText failed", err);
    }

    await ctx.runMutation(internal.chat.appendExchange, {
      threadId: args.threadId,
      userText: text,
      botText: reply,
      contact,
    });

    return { text: reply, contact };
  },
});
