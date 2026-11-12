import { describe, expect, it } from "vitest";
import {
  type PackingSlipPdfInput,
  renderPackingSlipPdf,
} from "./packingSlipPdf";
import { countPages, extractText } from "./pdfText";

const SLIP: PackingSlipPdfInput = {
  number: "PS-110926",
  shippedAt: Date.UTC(2026, 10, 9, 17),
  customer: {
    name: "Ryerson Inc",
    contact: "Dale Bishop",
    phone: "8175550142",
  },
  shipToName: "Voltagrid",
  shipToAddress: "4801 Glen Rose Highway, Granbury TX 76048",
  poNumber: "4701230782",
  jobProject: "Ryerson",
  shippedVia: "Truck",
  packages: "15",
  lineItems: [
    { partNumber: "1512-2914", description: "", qty: 84, unit: "ea" },
    { partNumber: "1512-5557", description: "", qty: 19, unit: "ea" },
    { partNumber: "1512-2928", description: "", qty: 40, unit: "ea" },
    { partNumber: "1512-5551", description: "", qty: 20, unit: "ea" },
  ],
  notes: "Welded corners each item",
};

describe("the packing slip PDF", () => {
  it("prints Eric's sample slip on one page with every field", async () => {
    const bytes = await renderPackingSlipPdf(SLIP);
    expect(await countPages(bytes)).toBe(1);
    const text = await extractText(bytes);
    for (const expected of [
      "PACKING SLIP",
      "PS-110926",
      "Nov 9, 2026",
      "Ryerson Inc",
      "Voltagrid",
      "4801 Glen Rose Highway, Granbury TX 76048",
      "4701230782",
      "Truck",
      "TOTAL PACKAGES",
      "1512-2914",
      "1512-5551",
      "Welded corners each item",
      "RECEIVED BY",
      "(817) 555-0142",
    ]) {
      expect(text, `missing: ${expected}`).toContain(expected);
    }
  });

  it("carries no money", async () => {
    const text = await extractText(await renderPackingSlipPdf(SLIP));
    expect(text).not.toMatch(/\$|BALANCE|TOTAL DUE/);
  });

  it("fits at least eleven single-line rows on one page", async () => {
    const lineItems = Array.from({ length: 11 }, (_, i) => ({
      partNumber: `P-${i}`,
      description: "Frame",
      qty: 1,
      unit: "ea",
    }));
    const bytes = await renderPackingSlipPdf({ ...SLIP, lineItems });
    expect(await countPages(bytes)).toBe(1);
  });

  it("paginates forty lines without losing one", async () => {
    const lineItems = Array.from({ length: 40 }, (_, i) => ({
      partNumber: `PART-${i + 1}`,
      description: "Frame",
      qty: 1,
      unit: "ea",
    }));
    const bytes = await renderPackingSlipPdf({ ...SLIP, lineItems });
    expect(await countPages(bytes)).toBeGreaterThan(1);
    const text = await extractText(bytes);
    for (let i = 1; i <= 40; i += 1) expect(text).toContain(`PART-${i}`);
  });
});
