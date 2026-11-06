/** THROWAWAY: issue #10 spike — the headline 100-line comparison. */
import { it } from "vitest";
import { LOGO_BYTES } from "../convex/invoiceLogo";
import { renderInvoicePdf } from "../convex/invoicePdf";
import { invoiceWith, manyLines, measure, report, type Stats } from "./harness";
import { renderInvoicePdfLib } from "./pdfLibInvoice";

it("headline 100 lines", async () => {
  const input = { ...invoiceWith(manyLines(100)), logoPngBytes: LOGO_BYTES };
  const rows: Stats[] = [
    await measure("HEADLINE today: react-pdf + linear filler search", () =>
      renderInvoicePdf(input),
    ),
    await measure("HEADLINE pdf-lib direct composition", () =>
      renderInvoicePdfLib(input),
    ),
  ];
  report(rows);
});
