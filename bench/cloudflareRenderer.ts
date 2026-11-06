/**
 * THROWAWAY: issue #10 spike. The hosted leg of the Chromium candidate —
 * Cloudflare Browser Rendering's /pdf quick action — plus the degradation
 * chain that keeps invoice generation working when it is rate limited or down.
 *
 * Nothing here is wired into production. It exists so the spike can answer
 * "what happens on a 429?" with code and tests rather than with a paragraph.
 *
 * The transport is injected, so the retry, circuit-breaker and fallback
 * behaviour is testable with no network and no API token.
 */
import type { InvoicePdfInput } from "../convex/invoicePdf";
import { invoiceHtml } from "./htmlInvoice";

/** Letter, with the same margins the stylesheet's @page declares. */
const PDF_OPTIONS = {
  printBackground: true,
  preferCSSPageSize: true,
} as const;

export type RenderTransport = (request: {
  html: string;
  pdfOptions: Record<string, unknown>;
}) => Promise<TransportResult>;

export type TransportResult =
  | { ok: true; bytes: Uint8Array }
  | {
      ok: false;
      /** HTTP status when there was one. */
      status?: number;
      /** Seconds the server asked us to wait, from Retry-After. */
      retryAfterSeconds?: number;
      error: string;
    };

export type FallbackConfig = {
  /** Attempts against the hosted renderer, including the first. */
  maxAttempts: number;
  /** First backoff step; doubles each attempt, with jitter. */
  baseDelayMs: number;
  /** Never wait longer than this between attempts. */
  maxDelayMs: number;
  /**
   * Consecutive failures that trip the breaker. While it is open the hosted
   * renderer is skipped entirely, so a sustained outage costs no latency.
   */
  breakerThreshold: number;
  breakerCooldownMs: number;
};

export const DEFAULT_CONFIG: FallbackConfig = {
  maxAttempts: 3,
  baseDelayMs: 250,
  maxDelayMs: 2_000,
  breakerThreshold: 3,
  breakerCooldownMs: 60_000,
};

/**
 * Which failures are worth retrying.
 *
 * 429 is the rate limit and always worth retrying — Cloudflare publishes 600
 * req/min on Workers Paid, and 30 concurrent browsers, so a burst is the
 * realistic cause. 5xx and transport errors (timeouts, resets) are transient.
 * A 4xx that is not 429 means our request is wrong — a bad token, HTML over
 * the 50MB body limit — and retrying it just wastes the invoice's latency.
 */
export function isRetryable(result: TransportResult): boolean {
  if (result.ok) return false;
  const { status } = result;
  if (status === undefined) return true; // network/timeout
  if (status === 429) return true;
  return status >= 500;
}

export type RenderOutcome = {
  bytes: Uint8Array;
  /** Which renderer actually produced the bytes. */
  renderer: "cloudflare" | "fallback";
  attempts: number;
  /** Why we ended up on the fallback, when we did. */
  reason?: string;
  waitedMs: number;
};

/** Mutable breaker state; in production this would live on the deployment. */
export type BreakerState = {
  consecutiveFailures: number;
  openedAt?: number;
};

export function newBreaker(): BreakerState {
  return { consecutiveFailures: 0 };
}

function breakerOpen(
  state: BreakerState,
  config: FallbackConfig,
  now: number,
): boolean {
  if (state.openedAt === undefined) return false;
  if (now - state.openedAt >= config.breakerCooldownMs) return false;
  return true;
}

export type Deps = {
  transport: RenderTransport;
  /** The existing in-process renderer. Always available, never rate limited. */
  fallback: (input: InvoicePdfInput) => Promise<Uint8Array>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  /** Jitter factor in [0,1); injected so tests are deterministic. */
  random: () => number;
  breaker: BreakerState;
  config?: Partial<FallbackConfig>;
};

/**
 * Render through Cloudflare, degrading to the in-process renderer rather than
 * failing. An invoice that renders slowly is a far better outcome for the shop
 * than an invoice that does not render at all, so the fallback is
 * unconditional: every path returns bytes or throws only if BOTH renderers
 * fail.
 */
export async function renderInvoiceWithFallback(
  input: InvoicePdfInput,
  deps: Deps,
): Promise<RenderOutcome> {
  const config = { ...DEFAULT_CONFIG, ...deps.config };
  const { breaker } = deps;
  let waitedMs = 0;

  if (breakerOpen(breaker, config, deps.now())) {
    return {
      bytes: await deps.fallback(input),
      renderer: "fallback",
      attempts: 0,
      reason: "circuit breaker open",
      waitedMs,
    };
  }

  const html = invoiceHtml(input);
  let lastError = "unknown";

  for (let attempt = 1; attempt <= config.maxAttempts; attempt += 1) {
    const result = await deps.transport({ html, pdfOptions: PDF_OPTIONS });

    if (result.ok) {
      breaker.consecutiveFailures = 0;
      breaker.openedAt = undefined;
      return {
        bytes: result.bytes,
        renderer: "cloudflare",
        attempts: attempt,
        waitedMs,
      };
    }

    lastError = result.status
      ? `HTTP ${result.status}: ${result.error}`
      : result.error;

    if (!isRetryable(result)) break;
    if (attempt === config.maxAttempts) break;

    // Honour Retry-After when the server sends one; otherwise exponential
    // backoff with jitter, so concurrent invoices do not retry in lockstep.
    const backoff = Math.min(
      config.baseDelayMs * 2 ** (attempt - 1),
      config.maxDelayMs,
    );
    const jittered = backoff / 2 + backoff * 0.5 * deps.random();
    const wait =
      result.retryAfterSeconds !== undefined
        ? Math.min(result.retryAfterSeconds * 1000, config.maxDelayMs)
        : jittered;
    waitedMs += wait;
    await deps.sleep(wait);
  }

  breaker.consecutiveFailures += 1;
  if (breaker.consecutiveFailures >= config.breakerThreshold) {
    breaker.openedAt = deps.now();
  }

  return {
    bytes: await deps.fallback(input),
    renderer: "fallback",
    attempts: Math.min(config.maxAttempts, config.maxAttempts),
    reason: lastError,
    waitedMs,
  };
}

/**
 * The real transport. Not exercised in this spike — it needs an account id and
 * an API token with "Browser Run - Edit", and per AGENTS.md server secrets
 * live on the Convex deployment, so wiring one up is a decision for whoever
 * picks this up. Shape verified against Cloudflare's /pdf endpoint docs.
 */
export function cloudflareTransport(options: {
  accountId: string;
  apiToken: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): RenderTransport {
  const doFetch = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 30_000;

  return async ({ html, pdfOptions }) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await doFetch(
        `https://api.cloudflare.com/client/v4/accounts/${options.accountId}/browser-run/pdf`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${options.apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ html, pdfOptions }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        const retryAfter = response.headers.get("retry-after");
        return {
          ok: false,
          status: response.status,
          retryAfterSeconds:
            retryAfter && /^\d+$/.test(retryAfter)
              ? Number(retryAfter)
              : undefined,
          error: await response.text().catch(() => response.statusText),
        };
      }

      return {
        ok: true,
        bytes: new Uint8Array(await response.arrayBuffer()),
      };
    } catch (cause) {
      return {
        ok: false,
        error: cause instanceof Error ? cause.message : String(cause),
      };
    } finally {
      clearTimeout(timer);
    }
  };
}
