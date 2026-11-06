import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InvoicePdfInput } from "./invoicePdf";

/**
 * How many times resolving the filler rows renders the document.
 *
 * Every other test in this suite reads the finished PDF back, which is the
 * right way to assert what the document says. It cannot assert what the
 * document costs: the filler search used to re-render the whole invoice once
 * per candidate count, and the invoices that fill a page -- the slow ones --
 * never hit the loop's early exit, so each one paid all thirteen renders.
 * Nothing about the output changed when that was fixed, so the only honest
 * test of the fix counts the renders.
 *
 * Wall-clock time is deliberately not asserted: it swings with CI hardware.
 */

const renders = { count: 0 };

vi.mock("@react-pdf/renderer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@react-pdf/renderer")>();
  return {
    ...actual,
    renderToBuffer: (...args: Parameters<typeof actual.renderToBuffer>) => {
      renders.count += 1;
      return actual.renderToBuffer(...args);
    },
  };
});

const { renderInvoicePdf } = await import("./invoicePdf");

function invoiceOf(lines: number): InvoicePdfInput {
  return {
    number: "TSWS-000001",
    issuedAt: Date.UTC(2026, 7, 26, 17),
    terms: "Due upon receipt",
    customer: {
      name: "Bishop Fabrication",
      address: "4100 County Road 1004, Joshua TX 76058",
    },
    lineItems: Array.from({ length: lines }, (_, i) => ({
      qty: i + 1,
      unit: "ea",
      description: `Line item number ${i + 1} with a reasonable description`,
      rateCents: 1000 + i * 37,
      taxable: true,
    })),
    discountCents: 0,
    taxRateBasisPoints: 825,
    paymentsCents: 0,
  };
}

async function rendersToResolve(input: InvoicePdfInput): Promise<number> {
  renders.count = 0;
  await renderInvoicePdf(input);
  return renders.count;
}

beforeEach(() => {
  renders.count = 0;
});

describe("the cost of resolving filler rows", () => {
  // Bounds are the exact costs, not comfortable ceilings: slack is room for
  // the linear scan to creep back without any test noticing.
  it("settles a three-page invoice in two renders", async () => {
    // Its line items already fill the page, so the largest filler count fits
    // and probing that count first answers the question outright: one render
    // to measure the document bare, one to confirm the maximum.
    expect(await rendersToResolve(invoiceOf(40))).toBe(2);
  });

  it("settles a five-page invoice in two renders", async () => {
    // The cost does not grow with the document: more line items only make it
    // more certain that every filler count fits.
    expect(await rendersToResolve(invoiceOf(100))).toBe(2);
  });

  it("bisects, rather than walks, when the largest filler does not fit", async () => {
    // A short invoice has room for only some of the filler, so the boundary
    // has to be found. Bisecting the eleven counts below the maximum takes at
    // most four probes, so six renders in all -- never the twelve a walk cost.
    expect(await rendersToResolve(invoiceOf(1))).toBeLessThanOrEqual(6);
  });
});
