/**
 * THROWAWAY benchmark harness for the issue #10 PDF renderer spike.
 * Not part of the test suite (see vitest.bench.config.mts).
 */
import { appendFileSync } from "node:fs";
import type { InvoiceLine } from "../convex/invoiceMath";
import type { InvoicePdfInput } from "../convex/invoicePdf";

const CUSTOMER = {
  name: "Bishop Fabrication",
  company: "Bishop Fabrication LLC",
  contact: "Dale Bishop",
  phone: "(972) 999-7505",
  email: "dale@bishopfab.com",
  address: "4100 County Road 1004, Joshua TX 76058",
};

/** Same shape the test suite benchmarks: `manyLines(n)` in invoicePdf.test.ts. */
export function manyLines(count: number): InvoiceLine[] {
  return Array.from({ length: count }, (_, i) => ({
    qty: 1,
    unit: "ea" as const,
    description: `Line item number ${i + 1}`,
    rateCents: 10000,
    taxable: true,
  }));
}

export function invoiceWith(lineItems: InvoiceLine[]): InvoicePdfInput {
  return {
    number: "TSWS-082626",
    issuedAt: Date.UTC(2026, 7, 26, 17),
    terms: "Due upon receipt",
    jobPo: "Dual Swing Gate",
    customer: CUSTOMER,
    lineItems,
    discountCents: 0,
    taxRateBasisPoints: 825,
    paymentsCents: 0,
    notes:
      "Gate operator installed and tested; customer walked through operation.",
  };
}

export type Stats = {
  label: string;
  runs: number;
  min: number;
  median: number;
  mean: number;
  max: number;
  bytes: number;
  rssDeltaMb: number;
};

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return Number.NaN;
  const pos = (sorted.length - 1) * q;
  const low = sorted[Math.floor(pos)] ?? Number.NaN;
  const high = sorted[Math.ceil(pos)] ?? Number.NaN;
  return low + (high - low) * (pos - Math.floor(pos));
}

/**
 * Times `fn` `runs` times after `warmup` untimed runs, and reports the spread.
 * A single best number hides the variance that matters on CI hardware.
 */
export async function measure(
  label: string,
  fn: () => Promise<Uint8Array>,
  { runs = 7, warmup = 2 } = {},
): Promise<Stats> {
  for (let i = 0; i < warmup; i += 1) await fn();
  const rssBefore = process.memoryUsage().rss;
  const times: number[] = [];
  let bytes = 0;
  let peakRss = rssBefore;
  for (let i = 0; i < runs; i += 1) {
    const t0 = performance.now();
    const out = await fn();
    times.push(performance.now() - t0);
    bytes = out.byteLength;
    peakRss = Math.max(peakRss, process.memoryUsage().rss);
  }
  const sorted = [...times].sort((a, b) => a - b);
  return {
    label,
    runs,
    min: sorted[0] ?? Number.NaN,
    median: quantile(sorted, 0.5),
    mean: times.reduce((a, b) => a + b, 0) / times.length,
    max: sorted[sorted.length - 1] ?? Number.NaN,
    bytes,
    rssDeltaMb: (peakRss - rssBefore) / 1024 / 1024,
  };
}

/**
 * Appends a Markdown table to bench/results.md (and stdout). Vitest swallows
 * console output under the default reporter, so the file is the real output.
 */
export function report(rows: Stats[]): void {
  const fmt = (n: number) => n.toFixed(0);
  const lines = [
    "",
    `### ${new Date().toISOString()}`,
    "",
    "| approach | runs | min ms | median ms | mean ms | max ms | bytes | peak RSS delta MB |",
    "|---|---|---|---|---|---|---|---|",
    ...rows.map(
      (r) =>
        `| ${r.label} | ${r.runs} | ${fmt(r.min)} | ${fmt(r.median)} | ${fmt(r.mean)} | ${fmt(r.max)} | ${r.bytes} | ${r.rssDeltaMb.toFixed(1)} |`,
    ),
    "",
  ].join("\n");
  console.log(lines);
  appendFileSync(new URL("results.md", import.meta.url), lines);
}
