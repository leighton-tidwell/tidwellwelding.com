/**
 * THROWAWAY: issue #10 spike. Verifies the degradation chain for the hosted
 * Chromium candidate with a fake transport — no network, no API token, no
 * real waiting. These are the cases that decide whether "graceful fallback"
 * is real or just a comment.
 */
import { appendFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LOGO_BYTES } from "../convex/invoiceLogo";
import { type InvoicePdfInput, renderInvoicePdf } from "../convex/invoicePdf";
import { countPages } from "../convex/pdfText";
import {
  type BreakerState,
  DEFAULT_CONFIG,
  type Deps,
  isRetryable,
  newBreaker,
  renderInvoiceWithFallback,
  type TransportResult,
} from "./cloudflareRenderer";
import { invoiceWith, manyLines } from "./harness";

const INPUT = { ...invoiceWith(manyLines(7)), logoPngBytes: LOGO_BYTES };
const HOSTED_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"

const notes: string[] = ["", "### Fallback chain behaviour", ""];
const log = (s: string) => notes.push(`- ${s}`);

type FakeDeps = Deps & {
  calls: number;
  slept: number[];
  breaker: BreakerState;
  clock: number;
};

/** A deps bundle with no real clock, no real sleeping and a fixed jitter. */
function deps(
  responses: TransportResult[],
  overrides: Partial<Deps> = {},
): FakeDeps {
  const state: FakeDeps = {
    calls: 0,
    slept: [],
    breaker: overrides.breaker ?? newBreaker(),
    clock: 0,
    transport: async (): Promise<TransportResult> => {
      const next = responses[Math.min(state.calls, responses.length - 1)];
      state.calls += 1;
      if (next === undefined)
        throw new Error("fake transport: no response set");
      return next;
    },
    // The real in-process renderer: proves the fallback returns a real invoice.
    fallback: (input: InvoicePdfInput) =>
      renderInvoicePdf({ ...input, fillerRows: 0 }),
    sleep: async (ms: number) => {
      state.slept.push(ms);
      state.clock += ms;
    },
    now: () => state.clock,
    random: () => 0.5,
    ...overrides,
  };
  return state;
}

describe("retry classification", () => {
  it("retries rate limits, timeouts and 5xx; gives up on our own mistakes", () => {
    expect(isRetryable({ ok: false, status: 429, error: "slow down" })).toBe(
      true,
    );
    expect(isRetryable({ ok: false, status: 503, error: "unavailable" })).toBe(
      true,
    );
    expect(isRetryable({ ok: false, error: "socket hang up" })).toBe(true);
    expect(isRetryable({ ok: false, status: 401, error: "bad token" })).toBe(
      false,
    );
    expect(
      isRetryable({ ok: false, status: 413, error: "entity too large" }),
    ).toBe(false);
    expect(isRetryable({ ok: true, bytes: HOSTED_BYTES })).toBe(false);
  });
});

describe("hosted renderer succeeds", () => {
  it("uses Cloudflare and does not touch the fallback", async () => {
    const d = deps([{ ok: true, bytes: HOSTED_BYTES }]);
    const out = await renderInvoiceWithFallback(INPUT, d);
    expect(out.renderer).toBe("cloudflare");
    expect(out.attempts).toBe(1);
    expect(d.slept).toEqual([]);
    log("happy path: 1 call, no sleeping, no fallback");
  });
});

describe("rate limited", () => {
  it("honours Retry-After, then succeeds", async () => {
    const d = deps([
      { ok: false, status: 429, retryAfterSeconds: 1, error: "rate limited" },
      { ok: true, bytes: HOSTED_BYTES },
    ]);
    const out = await renderInvoiceWithFallback(INPUT, d);
    expect(out.renderer).toBe("cloudflare");
    expect(out.attempts).toBe(2);
    expect(d.slept).toEqual([1000]);
    log(
      "429 then 200: retried after the server's Retry-After (1000ms), no fallback",
    );
  });

  it("caps a hostile Retry-After at maxDelayMs", async () => {
    const d = deps([
      {
        ok: false,
        status: 429,
        retryAfterSeconds: 3600,
        error: "rate limited",
      },
      { ok: true, bytes: HOSTED_BYTES },
    ]);
    await renderInvoiceWithFallback(INPUT, d);
    expect(d.slept).toEqual([DEFAULT_CONFIG.maxDelayMs]);
    log(
      `Retry-After: 3600 capped to ${DEFAULT_CONFIG.maxDelayMs}ms — an invoice never hangs for an hour`,
    );
  });

  it("falls back to a real invoice when the rate limit persists", async () => {
    const d = deps([{ ok: false, status: 429, error: "rate limited" }]);
    const out = await renderInvoiceWithFallback(INPUT, d);
    expect(out.renderer).toBe("fallback");
    expect(d.calls).toBe(DEFAULT_CONFIG.maxAttempts);
    expect(out.reason).toContain("429");
    // The important part: the shop still gets a valid, complete invoice.
    expect(await countPages(out.bytes)).toBe(1);
    expect(Buffer.from(out.bytes.slice(0, 5)).toString()).toBe("%PDF-");
    log(
      `sustained 429: ${DEFAULT_CONFIG.maxAttempts} attempts with backoff, then a real ` +
        "react-pdf invoice — the download never fails",
    );
  });
});

describe("our own bad request", () => {
  it("does not burn retries on a 401", async () => {
    const d = deps([{ ok: false, status: 401, error: "bad token" }]);
    const out = await renderInvoiceWithFallback(INPUT, d);
    expect(out.renderer).toBe("fallback");
    expect(d.calls).toBe(1);
    expect(d.slept).toEqual([]);
    log("401: one call, no backoff, straight to the fallback");
  });
});

describe("circuit breaker", () => {
  it("stops calling a dead service, then probes again after the cooldown", async () => {
    const breaker = newBreaker();
    const dead: TransportResult[] = [{ ok: false, status: 503, error: "down" }];

    // Three failing invoices trip the breaker.
    for (let i = 0; i < DEFAULT_CONFIG.breakerThreshold; i += 1) {
      const d = deps(dead, { breaker });
      const out = await renderInvoiceWithFallback(INPUT, d);
      expect(out.renderer).toBe("fallback");
    }
    expect(breaker.openedAt).toBeDefined();

    // The next invoice skips the network entirely: zero calls, zero latency.
    const whileOpen = deps(dead, { breaker, now: () => breaker.openedAt ?? 0 });
    const fast = await renderInvoiceWithFallback(INPUT, whileOpen);
    expect(fast.renderer).toBe("fallback");
    expect(fast.reason).toBe("circuit breaker open");
    expect(whileOpen.calls).toBe(0);
    log(
      `breaker trips after ${DEFAULT_CONFIG.breakerThreshold} failed invoices: later invoices ` +
        "skip the network, so an outage costs no added latency",
    );

    // After the cooldown it probes the service again.
    const after = deps([{ ok: true, bytes: HOSTED_BYTES }], {
      breaker,
      now: () => (breaker.openedAt ?? 0) + DEFAULT_CONFIG.breakerCooldownMs + 1,
    });
    const recovered = await renderInvoiceWithFallback(INPUT, after);
    expect(recovered.renderer).toBe("cloudflare");
    expect(after.calls).toBe(1);
    log(
      `after the ${DEFAULT_CONFIG.breakerCooldownMs / 1000}s cooldown the hosted renderer is ` +
        "retried and recovers on its own",
    );

    notes.push("");
    appendFileSync(
      new URL("results.md", import.meta.url),
      `${notes.join("\n")}\n`,
    );
  });
});
