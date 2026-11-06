/** THROWAWAY: issue #10 spike — how many renders the filler search costs. */

import { appendFileSync } from "node:fs";
import { it } from "vitest";
import { renderInvoicePdf } from "../convex/invoicePdf";
import { countPages } from "../convex/pdfText";
import { invoiceWith, manyLines } from "./harness";

it("filler row -> page count", async () => {
  const out: string[] = ["", "### page counts by filler rows", ""];
  for (const count of [0, 7, 40, 100]) {
    const input = invoiceWith(manyLines(count));
    const pages: number[] = [];
    for (let rows = 0; rows <= 12; rows += 1) {
      pages.push(
        await countPages(
          await renderInvoicePdf({ ...input, fillerRows: rows }),
        ),
      );
    }
    out.push(`- ${count} lines: ${pages.join(",")}`);
  }
  out.push("");
  appendFileSync(new URL("results.md", import.meta.url), out.join("\n"));
});
