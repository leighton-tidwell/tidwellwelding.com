/** THROWAWAY: issue #10 spike — Chromium/HTML candidate timing. */
import { afterAll, it } from "vitest";
import { LOGO_BYTES } from "../convex/invoiceLogo";
import { renderInvoicePdf } from "../convex/invoicePdf";
import {
  closeChromium,
  renderInvoiceChromium,
  warmChromium,
} from "./chromiumRenderer";
import { invoiceWith, manyLines, measure, report, type Stats } from "./harness";

afterAll(async () => {
  await closeChromium();
});

it("chromium timing", async () => {
  const rows: Stats[] = [];

  // Cold: a browser launch per render. This is the number that matters if the
  // hosted path gets a fresh browser for every invoice.
  const coldInput = {
    ...invoiceWith(manyLines(100)),
    logoPngBytes: LOGO_BYTES,
  };
  rows.push(
    await measure(
      "chromium COLD launch+render (100 lines)",
      async () => {
        await closeChromium();
        const r = await renderInvoiceChromium(coldInput);
        return r.bytes;
      },
      { runs: 3, warmup: 1 },
    ),
  );

  // Warm: browser reused, which is what Cloudflare recommends and what a
  // long-lived process would do.
  await warmChromium();
  for (const count of [7, 40, 100, 250]) {
    const input = {
      ...invoiceWith(manyLines(count)),
      logoPngBytes: LOGO_BYTES,
    };
    rows.push(
      await measure(
        `chromium warm, one print (${count} lines)`,
        async () =>
          (await renderInvoiceChromium(input, { fillerRows: 0 })).bytes,
      ),
    );
    rows.push(
      await measure(
        `chromium warm, full filler resolve (${count} lines)`,
        async () => (await renderInvoiceChromium(input)).bytes,
      ),
    );
    rows.push(
      await measure(`react-pdf today, for reference (${count} lines)`, () =>
        renderInvoicePdf(input),
      ),
    );
  }

  report(rows);
});
