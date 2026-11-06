/** THROWAWAY: issue #10 spike — what the pdf-lib candidate does and does not do. */
import { appendFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { it } from "vitest";
import { LOGO_BYTES } from "../convex/invoiceLogo";
import { renderInvoicePdf } from "../convex/invoicePdf";
import { countPages, extractText, extractTextRuns } from "../convex/pdfText";
import { invoiceWith, manyLines } from "./harness";
import { renderInvoicePdfLib } from "./pdfLibInvoice";

const out: string[] = ["", "### pdf-lib candidate fidelity", ""];
function log(s: string) {
  out.push(`- ${s}`);
}

it("fidelity probes", async () => {
  // Page size
  for (const [name, render] of [
    ["react-pdf", renderInvoicePdf],
    ["pdf-lib", renderInvoicePdfLib],
  ] as const) {
    const bytes = await render({
      ...invoiceWith(manyLines(7)),
      logoPngBytes: LOGO_BYTES,
    });
    const doc = await PDFDocument.load(bytes);
    const { width, height } = doc.getPage(0).getSize();
    log(`${name}: page size ${width}x${height}, pages ${doc.getPageCount()}`);
  }

  // Repeated headings and page count agreement at several sizes
  for (const count of [0, 7, 40, 100]) {
    const input = {
      ...invoiceWith(manyLines(count)),
      logoPngBytes: LOGO_BYTES,
    };
    const a = await renderInvoicePdf(input);
    const b = await renderInvoicePdfLib(input);
    const ta = await extractText(a);
    const tb = await extractText(b);
    log(
      `${count} lines: react-pdf ${await countPages(a)} pages / ${
        ta.split("QTY / HRS").length - 1
      } headings; pdf-lib ${await countPages(b)} pages / ${
        tb.split("QTY / HRS").length - 1
      } headings`,
    );
  }

  // Long unbroken token
  const longToken = `PN${"7".repeat(98)}`;
  const tokenInput = {
    ...invoiceWith([
      {
        qty: 1,
        unit: "ea" as const,
        description: longToken,
        rateCents: 5000,
        taxable: true,
      },
    ]),
    logoPngBytes: LOGO_BYTES,
  };
  const runs = await extractTextRuns(await renderInvoicePdfLib(tokenInput));
  const wide = runs.filter((r) => r.includes("777") && r.length >= 40);
  log(
    `100-char part number: ${wide.length} runs >=40 chars (0 means it stayed in its column)`,
  );

  // Accented characters
  const accented = await extractText(
    await renderInvoicePdfLib({
      ...invoiceWith([
        {
          qty: 1,
          unit: "ea" as const,
          description: "Fabricacion e instalacion de puerta",
          rateCents: 5000,
          taxable: true,
        },
      ]),
      customer: {
        ...invoiceWith([]).customer,
        company: "Fabricación Zürich",
      },
      logoPngBytes: LOGO_BYTES,
    }),
  );
  log(
    `accented customer name present: ${accented.includes("Fabricación Zürich")}`,
  );

  out.push("");
  appendFileSync(new URL("results.md", import.meta.url), out.join("\n"));
});
