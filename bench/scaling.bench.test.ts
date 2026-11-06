/** THROWAWAY: issue #10 spike — how each approach scales with line count. */
import { it } from "vitest";
import { LOGO_BYTES } from "../convex/invoiceLogo";
import { renderInvoicePdf } from "../convex/invoicePdf";
import { invoiceWith, manyLines, measure, report, type Stats } from "./harness";
import { renderInvoicePdfLib } from "./pdfLibInvoice";

it("scaling", async () => {
  const rows: Stats[] = [];
  for (const count of [7, 40, 100, 250]) {
    const input = {
      ...invoiceWith(manyLines(count)),
      logoPngBytes: LOGO_BYTES,
    };
    rows.push(
      await measure(`scaling: react-pdf one render (${count})`, () =>
        renderInvoicePdf({ ...input, fillerRows: 0 }),
      ),
    );
    rows.push(
      await measure(`scaling: pdf-lib (${count})`, () =>
        renderInvoicePdfLib(input),
      ),
    );
  }
  report(rows);
});
