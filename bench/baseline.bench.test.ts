/** THROWAWAY: issue #10 spike baseline. Excluded from `make test`. */
import { it } from "vitest";
import { renderInvoicePdf } from "../convex/invoicePdf";
import { invoiceWith, manyLines, measure, report, type Stats } from "./harness";

it("baseline: @react-pdf/renderer", async () => {
  const rows: Stats[] = [];
  for (const count of [7, 40, 100]) {
    const input = invoiceWith(manyLines(count));
    rows.push(
      await measure(`react-pdf full renderInvoicePdf (${count} lines)`, () =>
        renderInvoicePdf(input),
      ),
    );
    rows.push(
      await measure(
        `react-pdf single pass, fillerRows=0 (${count} lines)`,
        () => renderInvoicePdf({ ...input, fillerRows: 0 }),
      ),
    );
  }
  report(rows);
});
