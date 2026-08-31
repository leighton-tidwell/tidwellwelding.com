import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { EMAIL, LEGAL_NAME, PHONE_DISPLAY, SITE_URL } from "../src/lib/business";
import { formatMoney, formatRate } from "./invoiceMath";
import {
  buildInvoiceLayout,
  renderInvoicePdf,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  RED,
  WHITE,
  type InvoicePdfInput,
} from "./invoicePdf";

/** All text drawn on a page, in draw order. */
function textsOf(page: { texts: { text: string }[] }): string[] {
  return page.texts.map((t) => t.text);
}

/** A real 48x48 RGB PNG, so embedPng() decodes actual image data. */
const LOGO_PNG_BASE64 =
  "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";

function makePng(): Uint8Array {
  const binary = atob(LOGO_PNG_BASE64);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

const REFERENCE: InvoicePdfInput = {
  number: "1042",
  issuedAt: Date.UTC(2026, 7, 14),
  terms: "Net 30",
  customer: { name: "Bar 7 Ranch" },
  lineItems: [
    { qty: 1, unit: "ea", description: "Gate", rateCents: 299900, taxable: true },
  ],
  discountCents: 0,
  taxRateBasisPoints: 825,
  paymentsCents: 0,
};

/** The owner's real invoice, used as the end-to-end arithmetic fixture. */
const REFERENCE_INVOICE: InvoicePdfInput = {
  number: "1042",
  issuedAt: Date.UTC(2026, 7, 14),
  dueAt: Date.UTC(2026, 8, 13),
  terms: "Net 30",
  jobPo: "PO-8871",
  customer: {
    name: "Bar 7 Ranch",
    company: "Bar 7 Ranch LLC",
    contact: "Dale Whitfield",
    phone: "(817) 555-0142",
    email: "dale@bar7.com",
    address: "1200 FM 51, Granbury TX 76048",
  },
  lineItems: [
    { qty: 1, unit: "ea", description: "Custom ranch entry gate", rateCents: 299900, taxable: true },
    { qty: 25, unit: "hr", description: "Onsite fabrication and welding labor", rateCents: 17500, taxable: true },
    { qty: 1, unit: "lot", description: "Consumables and shielding gas", rateCents: 4408, taxable: true },
    { qty: 1, unit: "ea", description: "Structural steel materials", rateCents: 112460, taxable: true },
    { qty: 1, unit: "ea", description: "Powder coat finish", rateCents: 15000, taxable: true },
    { qty: 1, unit: "ea", description: "Mobilization", rateCents: 5000, taxable: true },
    { qty: 1, unit: "ea", description: "Gate hardware and latch set", rateCents: 5000, taxable: true },
  ],
  discountCents: 0,
  taxRateBasisPoints: 825,
  paymentsCents: 0,
  notes: "Gate hung and aligned; owner walked the job and approved on completion.",
};

describe("renderInvoicePdf", () => {
  it("emits loadable PDF bytes", async () => {
    const bytes = await renderInvoicePdf(REFERENCE);

    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.byteLength).toBeGreaterThan(1000);

    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it("draws the header: INVOICE in red plus the business block from business.ts", () => {
    const [page] = buildInvoiceLayout(REFERENCE).pages;
    const texts = textsOf(page);

    expect(texts).toContain("INVOICE");
    const heading = page.texts.find((t) => t.text === "INVOICE")!;
    expect(heading.color).toEqual(RED);
    expect(heading.size).toBeGreaterThanOrEqual(28);

    expect(texts).toContain(LEGAL_NAME);
    expect(texts).toContain("Eric Tidwell, Owner");
    expect(texts).toContain(PHONE_DISPLAY);
    expect(texts).toContain(EMAIL);
    expect(texts).toContain(SITE_URL.replace("https://", ""));
  });

  it("draws the bill-to and invoice-meta blocks side by side", () => {
    const [page] = buildInvoiceLayout({
      ...REFERENCE,
      dueAt: Date.UTC(2026, 8, 13),
      jobPo: "PO-8871",
      customer: {
        name: "Bar 7 Ranch",
        company: "Bar 7 Ranch LLC",
        contact: "Dale Whitfield",
        phone: "(817) 555-0142",
        email: "dale@bar7.com",
        address: "1200 FM 51, Granbury TX",
      },
    }).pages;
    const texts = textsOf(page);

    for (const label of [
      "BILL TO",
      "CONTACT",
      "JOB / PO #",
      "INVOICE #",
      "DATE",
      "DUE DATE",
      "TERMS",
    ]) {
      expect(texts).toContain(label);
    }

    expect(texts).toContain("Bar 7 Ranch LLC");
    expect(texts).toContain("Dale Whitfield");
    expect(texts).toContain("1200 FM 51, Granbury TX");
    expect(texts).toContain("PO-8871");
    expect(texts).toContain("1042");
    expect(texts).toContain("Net 30");
    expect(texts).toContain("(817) 555-0142 · dale@bar7.com");
    expect(texts).toContain("Aug 14, 2026");
    expect(texts).toContain("Sep 13, 2026");

    // Left block sits left of the right block.
    const billTo = page.texts.find((t) => t.text === "BILL TO")!;
    const invoiceNo = page.texts.find((t) => t.text === "INVOICE #")!;
    expect(billTo.x).toBeLessThan(invoiceNo.x);
  });

  it("draws a black table header with white column titles", () => {
    const [page] = buildInvoiceLayout(REFERENCE).pages;
    const titles = ["QTY/HRS", "DESCRIPTION OF WORK/MATERIALS", "RATE", "TAX", "AMOUNT"];

    for (const title of titles) {
      const cell = page.texts.find((t) => t.text === title)!;
      expect(cell, title).toBeDefined();
      expect(cell.color).toEqual(WHITE);
    }

    const header = page.texts.find((t) => t.text === "QTY/HRS")!;
    // A black bar spans the content width behind the titles.
    const bar = page.rects.find(
      (r) =>
        r.color.r === 0 &&
        r.color.g === 0 &&
        r.color.b === 0 &&
        r.y <= header.y &&
        r.y + r.height >= header.y &&
        r.width > 400,
    );
    expect(bar).toBeDefined();
  });

  it("renders each line's qty, description, rate, taxability and amount", () => {
    const [page] = buildInvoiceLayout({
      ...REFERENCE,
      lineItems: [
        { qty: 25, unit: "hr", description: "Onsite fabrication labor", rateCents: 17500, taxable: true },
        { qty: 1, unit: "lot", description: "Consumables", rateCents: 4408, taxable: false },
      ],
    }).pages;
    const texts = textsOf(page);

    expect(texts).toContain("25");
    expect(texts).toContain("Onsite fabrication labor");
    expect(texts).toContain(formatRate(17500, "hr"));
    expect(texts).toContain("Yes");
    expect(texts).toContain(formatMoney(437500));

    expect(texts).toContain("Consumables");
    expect(texts).toContain(formatRate(4408, "lot"));
    expect(texts).toContain("No");
    expect(texts).toContain(formatMoney(4408));
  });

  it("wraps a long description onto multiple lines inside the column", () => {
    const long =
      "Fabricate and install heavy-duty ranch entry gate with powder-coated finish, " +
      "including custom scrollwork, latch hardware, and onsite alignment of both posts";
    const [page] = buildInvoiceLayout({
      ...REFERENCE,
      lineItems: [{ qty: 1, unit: "ea", description: long, rateCents: 299900, taxable: true }],
    }).pages;

    const descX = page.texts.find((t) => t.text === "DESCRIPTION OF WORK/MATERIALS")!.x;
    const wrapped = page.texts.filter((t) => t.x === descX && long.includes(t.text));

    expect(wrapped.length).toBeGreaterThan(1);
    // Reassembles to the original, so nothing was dropped.
    expect(wrapped.map((t) => t.text).join(" ")).toBe(long);
    // Successive lines step downward.
    for (let i = 1; i < wrapped.length; i++) {
      expect(wrapped[i].y).toBeLessThan(wrapped[i - 1].y);
    }
  });

  it("stacks the totals bottom-right and shows the tax rate as a percentage", () => {
    const [page] = buildInvoiceLayout({
      ...REFERENCE,
      discountCents: 5000,
      paymentsCents: 100000,
    }).pages;
    const texts = textsOf(page);

    for (const label of [
      "SUBTOTAL",
      "DISCOUNT",
      "TAX RATE",
      "SALES TAX",
      "PAYMENTS",
      "BALANCE DUE",
    ]) {
      expect(texts).toContain(label);
    }
    expect(texts).toContain("8.25%");

    const subtotal = page.texts.find((t) => t.text === "SUBTOTAL")!;
    expect(subtotal.x).toBeGreaterThan(PAGE_WIDTH / 2);
    expect(subtotal.y).toBeLessThan(PAGE_HEIGHT / 2);
  });

  it("prints BALANCE DUE in white on a solid red bar", () => {
    const [page] = buildInvoiceLayout(REFERENCE).pages;
    const label = page.texts.find((t) => t.text === "BALANCE DUE")!;

    expect(label.color).toEqual(WHITE);

    const bar = page.rects.find(
      (r) =>
        r.color.r === RED.r &&
        r.color.g === RED.g &&
        r.color.b === RED.b &&
        r.height > 10 &&
        r.y <= label.y &&
        r.y + r.height >= label.y,
    );
    expect(bar).toBeDefined();
  });

  it("renders the reference invoice's balance due as $9,518.08", () => {
    const [page] = buildInvoiceLayout(REFERENCE_INVOICE).pages;
    const texts = textsOf(page);

    expect(texts).toContain("$9,518.08");
    expect(texts).toContain("8.25%");
    // Every description made it onto the page.
    for (const line of REFERENCE_INVOICE.lineItems) {
      expect(texts).toContain(line.description);
    }
  });

  it("paginates many line items onto a second page", async () => {
    const many: InvoicePdfInput = {
      ...REFERENCE,
      lineItems: Array.from({ length: 20 }, (_, i) => ({
        qty: 1,
        unit: "ea" as const,
        description: `Fabricated bracket assembly number ${i + 1}`,
        rateCents: 12500,
        taxable: true,
      })),
    };

    const layout = buildInvoiceLayout(many);
    expect(layout.pages.length).toBe(2);

    // Nothing runs off the bottom of a page.
    for (const p of layout.pages) {
      for (const t of p.texts) expect(t.y).toBeGreaterThan(0);
    }

    // Every description is drawn exactly once across all pages.
    const all = layout.pages.flatMap(textsOf);
    for (const line of many.lineItems) {
      expect(all.filter((t) => t === line.description)).toHaveLength(1);
    }

    const doc = await PDFDocument.load(await renderInvoicePdf(many));
    expect(doc.getPageCount()).toBe(2);
  });

  it("carries the table header onto the continuation page", () => {
    const layout = buildInvoiceLayout({
      ...REFERENCE,
      lineItems: Array.from({ length: 20 }, (_, i) => ({
        qty: 1,
        unit: "ea" as const,
        description: `Bracket ${i + 1}`,
        rateCents: 12500,
        taxable: true,
      })),
    });

    expect(textsOf(layout.pages[1])).toContain("QTY/HRS");
  });

  it("puts the totals and footer only on the last page", () => {
    const layout = buildInvoiceLayout({
      ...REFERENCE,
      notes: "Second visit to re-hang the gate.",
      lineItems: Array.from({ length: 20 }, (_, i) => ({
        qty: 1,
        unit: "ea" as const,
        description: `Bracket ${i + 1}`,
        rateCents: 12500,
        taxable: true,
      })),
    });

    const first = textsOf(layout.pages[0]);
    const last = textsOf(layout.pages[1]);

    expect(first).not.toContain("BALANCE DUE");
    expect(first).not.toContain("Thank you for your business.");
    expect(last).toContain("BALANCE DUE");
    expect(last).toContain("Thank you for your business.");
    expect(last).toContain("NOTES / WORK PERFORMED");
  });

  it("renders the footer small print", () => {
    const [page] = buildInvoiceLayout(REFERENCE).pages;
    const joined = textsOf(page).join(" ");

    expect(joined).toContain("Thank you for your business.");
    expect(joined).toContain(
      `Make checks payable to ${LEGAL_NAME}. Customer is responsible for ` +
        "approved labor, materials, applicable taxes, and agreed travel or " +
        "mobilization charges.",
    );
  });

  it("renders the notes text in the notes box", () => {
    const [page] = buildInvoiceLayout({
      ...REFERENCE,
      notes: "Welded new hinge plates and re-squared the frame.",
    }).pages;
    const joined = textsOf(page).join(" ");

    expect(joined).toContain("NOTES / WORK PERFORMED");
    expect(joined).toContain("Welded new hinge plates and re-squared the frame.");
  });

  it("embeds the logo, producing a meaningfully larger file", async () => {
    const plain = await renderInvoicePdf(REFERENCE);
    const withLogo = await renderInvoicePdf({
      ...REFERENCE,
      logoPngBytes: makePng(),
    });

    expect(withLogo.byteLength).toBeGreaterThan(plain.byteLength + 200);
    const doc = await PDFDocument.load(withLogo);
    expect(doc.getPageCount()).toBe(1);
  });

  it("renders US Letter pages", async () => {
    const doc = await PDFDocument.load(await renderInvoicePdf(REFERENCE));
    const { width, height } = doc.getPage(0).getSize();

    expect(Math.round(width)).toBe(612);
    expect(Math.round(height)).toBe(792);
  });
});
