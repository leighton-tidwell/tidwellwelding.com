/**
 * THROWAWAY: issue #10 spike. Does the Chromium/HTML candidate actually hold
 * the invoice's layout constraints?
 *
 * Structure (page count, repeated headings, what appears once) is read back
 * out of the PDF. Overflow behaviour is measured in the DOM under print media
 * emulation, because that is Chromium's own layout rather than our inference
 * from glyph positions.
 */
import { appendFileSync } from "node:fs";
import { afterAll, expect, it } from "vitest";
import { LOGO_BYTES } from "../convex/invoiceLogo";
import { countPages } from "../convex/pdfText";
import {
  closeChromium,
  measureLayout,
  renderInvoiceChromium,
} from "./chromiumRenderer";
import { invoiceWith, manyLines } from "./harness";
import { extractRunsByPage, pageText, squash } from "./pdfTextCmap";

afterAll(async () => {
  await closeChromium();
});

const out: string[] = ["", "### Chromium/HTML candidate fidelity", ""];
const log = (s: string) => out.push(`- ${s}`);
const flush = () =>
  appendFileSync(new URL("results.md", import.meta.url), `${out.join("\n")}\n`);

const LONG_TOKEN = `PN${"7".repeat(98)}`;
const LONG_COMPANY =
  "Bishop Fabrication and Structural Steel Erection Services of North Central Texas LLC";

it("page structure: size, pagination, repeated headings", async () => {
  for (const count of [0, 7, 40, 100]) {
    const input = {
      ...invoiceWith(manyLines(count)),
      logoPngBytes: LOGO_BYTES,
    };
    const r = await renderInvoiceChromium(input);
    const byPage = await extractRunsByPage(r.bytes);
    const pages = await countPages(r.bytes);
    const whole = pageText(byPage.flat());
    const has = (needle: string) => whole.includes(squash(needle));
    const onPages = (needle: string) =>
      byPage.filter((runs) => pageText(runs).includes(squash(needle))).length;

    const heading = onPages("QTY / HRS");
    log(
      `${count} lines: ${pages} pages, heading on ${heading}/${pages}, ` +
        `totals on ${onPages("BALANCE DUE")}, footer on ${onPages("Thank you for your business.")}, ` +
        `filler=${r.fillerRows}, prints=${r.prints}`,
    );

    // Column headings repeat on every page.
    expect(heading, `${count} lines: heading must be on every page`).toBe(
      pages,
    );
    // Totals and footer appear exactly once, like the react-pdf original.
    expect(onPages("BALANCE DUE")).toBe(1);
    expect(onPages("Thank you for your business.")).toBe(1);
    // No line item is lost.
    if (count > 0) expect(has(`Line item number ${count}`)).toBe(true);
  }

  const { PDFDocument } = await import("pdf-lib");
  const letter = await renderInvoiceChromium({
    ...invoiceWith(manyLines(7)),
    logoPngBytes: LOGO_BYTES,
  });
  const size = (await PDFDocument.load(letter.bytes)).getPage(0).getSize();
  log(`page size ${Math.round(size.width)}x${Math.round(size.height)} pt`);
  expect(Math.round(size.width)).toBe(612);
  expect(Math.round(size.height)).toBe(792);
  flush();
});

it("overflow: long tokens and long names stay inside their boxes", async () => {
  const geometry = await measureLayout({
    ...invoiceWith(manyLines(3)),
    logoPngBytes: LOGO_BYTES,
  });
  log(
    `table ${geometry.tableWidthPt}pt wide, description column ${geometry.descColumnWidthPt}pt`,
  );
  // The react-pdf design: 516pt content width, 176pt description column.
  // border-collapse absorbs a hairline, so allow a point either way.
  expect(geometry.tableWidthPt).toBe(516);
  expect(Math.abs(geometry.descColumnWidthPt - 176)).toBeLessThanOrEqual(2);

  // A 100-character part number must break inside its own column.
  const token = await measureLayout({
    ...invoiceWith([
      {
        qty: 1,
        unit: "ea" as const,
        description: LONG_TOKEN,
        rateCents: 5000,
        taxable: true,
      },
    ]),
    logoPngBytes: LOGO_BYTES,
  });
  log(
    `100-char part number: ${token.overflowingDescCells} cells overflow, ` +
      `${token.escapingDescCells} cells with ink outside the column (0/0 is correct)`,
  );
  expect(token.overflowingDescCells).toBe(0);
  expect(token.escapingDescCells).toBe(0);

  // A long company name must be clipped, not allowed to displace the grid.
  const name = await measureLayout({
    ...invoiceWith(manyLines(3)),
    customer: { ...invoiceWith([]).customer, company: LONG_COMPANY },
    logoPngBytes: LOGO_BYTES,
  });
  log(
    `long company name: ${name.metaValuesClipped} value(s) clipped to one line, ` +
      `${name.metaValuesOverflowingGrid} overflowing the grid (1/0 is correct)`,
  );
  expect(name.metaValuesClipped).toBeGreaterThan(0);
  expect(name.metaValuesOverflowingGrid).toBe(0);
  flush();
});

it("accents and a long name still render, on one page", async () => {
  const r = await renderInvoiceChromium({
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
  });
  const whole = pageText((await extractRunsByPage(r.bytes)).flat());
  log(
    `accented company name kept: ${whole.includes(squash("Fabricación Zürich"))}`,
  );
  expect(whole.includes(squash("Fabricación Zürich"))).toBe(true);
  expect(await countPages(r.bytes)).toBe(1);
  out.push("");
  flush();
});
