/**
 * THROWAWAY: issue #10 spike. The current renderer re-renders the whole
 * document up to 13 times to resolve filler rows. These variants keep
 * @react-pdf/renderer and only change how many renders the search costs.
 */
import { it } from "vitest";
import { LOGO_BYTES } from "../convex/invoiceLogo";
import type { InvoicePdfInput } from "../convex/invoicePdf";
import { renderInvoicePdf } from "../convex/invoicePdf";
import { invoiceWith, manyLines, measure, report, type Stats } from "./harness";

const MAX_FILLER_ROWS = 12;

/** Same cheap page count the production renderer uses internally. */
function pageCountOf(bytes: Uint8Array): number {
  const text = Buffer.from(bytes).toString("latin1");
  let max = 0;
  for (const [, count] of text.matchAll(/\/Count\s+(\d+)/g)) {
    max = Math.max(max, Number(count));
  }
  return max || 1;
}

async function render(input: InvoicePdfInput, fillerRows: number) {
  const bytes = await renderInvoicePdf({ ...input, fillerRows });
  return { bytes, pages: pageCountOf(bytes) };
}

/** Current behaviour, for reference: 1 + up to 12 renders. */
async function linearSearch(input: InvoicePdfInput): Promise<Uint8Array> {
  const bare = await render(input, 0);
  let best = bare;
  for (let rows = 1; rows <= MAX_FILLER_ROWS; rows += 1) {
    const candidate = await render(input, rows);
    if (candidate.pages > bare.pages) break;
    best = candidate;
  }
  return best.bytes;
}

/**
 * Page count is monotone non-decreasing in filler rows, so the largest filler
 * that still fits can be found by bisection: 1 + ceil(log2(13)) = 5 renders.
 */
async function binarySearch(input: InvoicePdfInput): Promise<Uint8Array> {
  const bare = await render(input, 0);
  let lo = 0;
  let hi = MAX_FILLER_ROWS;
  let best = bare;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = await render(input, mid);
    if (candidate.pages > bare.pages) {
      hi = mid - 1;
    } else {
      lo = mid;
      best = candidate;
    }
  }
  return best.bytes;
}

/**
 * Probe the maximum first. On any invoice that already fills a page the whole
 * filler range fits, so this answers in 2 renders and falls back to bisection
 * only on short invoices.
 */
async function probeMaxThenBisect(input: InvoicePdfInput): Promise<Uint8Array> {
  const bare = await render(input, 0);
  const full = await render(input, MAX_FILLER_ROWS);
  if (full.pages === bare.pages) return full.bytes;
  let lo = 0;
  let hi = MAX_FILLER_ROWS - 1;
  let best = bare;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = await render(input, mid);
    if (candidate.pages > bare.pages) hi = mid - 1;
    else {
      lo = mid;
      best = candidate;
    }
  }
  return best.bytes;
}

it("filler search strategies", async () => {
  const rows: Stats[] = [];
  for (const count of [7, 40, 100]) {
    const input = {
      ...invoiceWith(manyLines(count)),
      logoPngBytes: LOGO_BYTES,
    };
    rows.push(
      await measure(`react-pdf single render only (${count} lines)`, () =>
        renderInvoicePdf({ ...input, fillerRows: 0 }),
      ),
    );
    rows.push(
      await measure(
        `react-pdf linear filler search = today (${count} lines)`,
        () => linearSearch(input),
      ),
    );
    rows.push(
      await measure(`react-pdf bisected filler search (${count} lines)`, () =>
        binarySearch(input),
      ),
    );
    rows.push(
      await measure(`react-pdf probe-max then bisect (${count} lines)`, () =>
        probeMaxThenBisect(input),
      ),
    );
  }
  report(rows);
});
