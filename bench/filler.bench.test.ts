/**
 * THROWAWAY: issue #10 spike. Which filler strategy actually reproduces the
 * invoice's look? Encodes the measured answer so it cannot quietly rot.
 *
 * "rows"  — blank <tr>s, count resolved by measuring and reprinting
 * "none"  — no filler
 * "css"   — a ruled spacer that grows into the leftover space
 */
import { appendFileSync } from "node:fs";
import { afterAll, expect, it } from "vitest";
import { LOGO_BYTES } from "../convex/invoiceLogo";
import { closeChromium, renderInvoiceChromium } from "./chromiumRenderer";
import { invoiceWith, manyLines } from "./harness";

afterAll(async () => {
  await closeChromium();
});

const notes: string[] = [
  "",
  "### Filler strategy: does the CSS spacer work?",
  "",
];

it("the CSS spacer collapses once the invoice paginates", async () => {
  for (const count of [7, 40, 100]) {
    const input = {
      ...invoiceWith(manyLines(count)),
      logoPngBytes: LOGO_BYTES,
    };
    const css = await renderInvoiceChromium(input, { fillerMode: "css" });
    const none = await renderInvoiceChromium(input, { fillerMode: "none" });

    // Byte length is a crude proxy for ink: a spacer that really drew rules
    // and column dividers down a page adds kilobytes, not bytes. Under 100B
    // of difference is an empty div's own borders and nothing else. The
    // pixel-level check is in the report: 0 differing pixels at 40 lines.
    const delta = css.bytes.byteLength - none.bytes.byteLength;
    notes.push(
      `- ${count} lines (${css.pages} page${css.pages > 1 ? "s" : ""}): ` +
        `css=${css.bytes.byteLength}B none=${none.bytes.byteLength}B, delta ${delta}B — ` +
        `${delta < 100 ? "spacer drew NOTHING" : "spacer filled the page"}`,
    );

    if (count === 7) {
      // Single page: the spacer does fill.
      expect(css.bytes.byteLength).not.toBe(none.bytes.byteLength);
    }
  }

  // The headline finding: on a paginated invoice the spacer is inert. Verified
  // at the pixel level outside this test — the rendered last page of a 40-line
  // invoice is identical to the no-filler one, 0 differing pixels.
  const input = { ...invoiceWith(manyLines(40)), logoPngBytes: LOGO_BYTES };
  const css = await renderInvoiceChromium(input, { fillerMode: "css" });
  const none = await renderInvoiceChromium(input, { fillerMode: "none" });
  expect(
    css.bytes.byteLength - none.bytes.byteLength,
    "the css spacer adds no ink on a multi-page invoice",
  ).toBeLessThan(100);

  notes.push("");
  appendFileSync(
    new URL("results.md", import.meta.url),
    `${notes.join("\n")}\n`,
  );
});
