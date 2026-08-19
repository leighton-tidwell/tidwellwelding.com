import { RateLimiter, HOUR, MINUTE } from "@convex-dev/rate-limiter";
import { ConvexError } from "convex/values";
import { components } from "./_generated/api";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  quoteSubmitPerSession: { kind: "fixed window", rate: 5, period: HOUR },
  quoteSubmitGlobal: { kind: "fixed window", rate: 30, period: HOUR },
  estimateDraftPerSession: { kind: "fixed window", rate: 6, period: HOUR },
  estimateDraftGlobal: { kind: "fixed window", rate: 60, period: HOUR },
  chatMessagePerMinute: { kind: "token bucket", rate: 10, period: MINUTE },
  chatMessagePerSession: { kind: "fixed window", rate: 20, period: HOUR },
  chatMessageGlobal: { kind: "fixed window", rate: 200, period: HOUR },
  chatThreadPerSession: { kind: "fixed window", rate: 6, period: HOUR },
  chatThreadGlobal: { kind: "fixed window", rate: 120, period: HOUR },
});

type LimiterCtx = Parameters<typeof rateLimiter.limit>[0];

function throwSlowDown(): never {
  throw new ConvexError("Slow down. Call Eric instead: (817) 894-6357.");
}

export async function limitQuoteSubmit(ctx: LimiterCtx, sessionId: string) {
  const perSession = await rateLimiter.limit(ctx, "quoteSubmitPerSession", {
    key: sessionId,
  });
  if (!perSession.ok) throwSlowDown();
  const global = await rateLimiter.limit(ctx, "quoteSubmitGlobal");
  if (!global.ok) throwSlowDown();
}

export async function limitEstimateDraft(ctx: LimiterCtx, sessionId: string) {
  const perSession = await rateLimiter.limit(ctx, "estimateDraftPerSession", {
    key: sessionId,
  });
  if (!perSession.ok) throwSlowDown();
  const global = await rateLimiter.limit(ctx, "estimateDraftGlobal");
  if (!global.ok) throwSlowDown();
}

export async function limitChatThread(ctx: LimiterCtx, sessionId: string) {
  const perSession = await rateLimiter.limit(ctx, "chatThreadPerSession", {
    key: sessionId,
  });
  if (!perSession.ok) throwSlowDown();
  const global = await rateLimiter.limit(ctx, "chatThreadGlobal");
  if (!global.ok) throwSlowDown();
}

export async function limitChatMessage(ctx: LimiterCtx, sessionId: string) {
  const perMinute = await rateLimiter.limit(ctx, "chatMessagePerMinute", {
    key: sessionId,
  });
  if (!perMinute.ok) throwSlowDown();
  const perSession = await rateLimiter.limit(ctx, "chatMessagePerSession", {
    key: sessionId,
  });
  if (!perSession.ok) throwSlowDown();
  const global = await rateLimiter.limit(ctx, "chatMessageGlobal");
  if (!global.ok) throwSlowDown();
}

/** Reject junk session ids before they become rate-limiter keys. */
export function assertSessionId(sessionId: string) {
  if (
    typeof sessionId !== "string" ||
    sessionId.length < 8 ||
    sessionId.length > 64 ||
    !/^[A-Za-z0-9_-]+$/.test(sessionId)
  ) {
    throw new ConvexError("Session invalid. Reload the page and try again.");
  }
}
