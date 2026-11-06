/** THROWAWAY: issue #10 spike — pdf-lib candidate timing and sanity checks. */
import { expect, it } from "vitest";
import { LOGO_BYTES } from "../convex/invoiceLogo";
import { countPages, extractText } from "../convex/pdfText";
import { invoiceWith, manyLines, measure, report, type Stats } from "./harness";
import { renderInvoicePdfLib } from "./pdfLibInvoice";

it("pdf-lib candidate keeps the layout constraints", async () => {
  const input = { ...invoiceWith(manyLines(100)), logoPngBytes: LOGO_BYTES };
  const bytes = await renderInvoicePdfLib(input);
  const pages = await countPages(bytes);
  const text = await extractText(bytes);
  expect(text).toContain("Line item number 1");
  expect(text).toContain("Line item number 100");
  expect(text).toContain("BALANCE DUE");
  // Column headings repeated: one "QTY / HRS" per page.
  const heads = text.split("QTY / HRS").length - 1;
  console.log(`pages=${pages} headings=${heads} bytes=${bytes.byteLength}`);
  expect(heads).toBe(pages);
});

it("pdf-lib candidate timing", async () => {
  const rows: Stats[] = [];
  for (const count of [7, 40, 100]) {
    const input = {
      ...invoiceWith(manyLines(count)),
      logoPngBytes: LOGO_BYTES,
    };
    rows.push(
      await measure(`pdf-lib direct composition (${count} lines)`, () =>
        renderInvoicePdfLib(input),
      ),
    );
  }
  report(rows);
});
