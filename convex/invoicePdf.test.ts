import { describe, expect, it } from "vitest";
import { renderInvoicePdf, type InvoicePdfInput } from "./invoicePdf";
import { countPages, extractText, extractTextRuns } from "./pdfText";

/**
 * These tests read the text back out of the rendered PDF rather than inspecting
 * the layout module's own draw calls. A test that asserts on draw-ops only
 * proves the module agrees with itself; this fails when the document is wrong.
 */

const CUSTOMER = {
  name: "Bishop Fabrication",
  company: "Bishop Fabrication LLC",
  contact: "Dale Bishop",
  phone: "(972) 999-7505",
  email: "dale@bishopfab.com",
  address: "4100 County Road 1004, Joshua TX 76058",
};

/** The owner's real invoice: seven lines, balance $9,518.08. */
const REFERENCE: InvoicePdfInput = {
  number: "TSWS-082626",
  issuedAt: Date.UTC(2026, 7, 26, 17),
  terms: "Due upon receipt",
  jobPo: "Dual Swing Gate",
  customer: CUSTOMER,
  lineItems: [
    {
      qty: 1,
      unit: "ea",
      description:
        "LiftMaster LA400UL, dual-swing operator with solar panel and battery kit",
      rateCents: 299900,
      taxable: true,
    },
    {
      qty: 25,
      unit: "hr",
      description: "Fabrication, installation and mobilization labor",
      rateCents: 17500,
      taxable: true,
    },
    {
      qty: 1,
      unit: "lot",
      description: "Fuel - mobilization surcharge",
      rateCents: 4408,
      taxable: true,
    },
    {
      qty: 1,
      unit: "ea",
      description: "Steel tubing, metal and fabrication consumables",
      rateCents: 112460,
      taxable: true,
    },
    {
      qty: 1,
      unit: "ea",
      description: "Paint and finishing supplies",
      rateCents: 15000,
      taxable: true,
    },
    {
      qty: 1,
      unit: "ea",
      description: "Concrete",
      rateCents: 5000,
      taxable: true,
    },
    {
      qty: 1,
      unit: "ea",
      description: "Plasma-cutting consumables",
      rateCents: 5000,
      taxable: true,
    },
  ],
  discountCents: 0,
  taxRateBasisPoints: 825,
  paymentsCents: 0,
  notes:
    "Gate hung and aligned; owner walked the job and approved on completion.",
};

function manyLines(count: number, prefix = "Line item number") {
  return Array.from({ length: count }, (_, i) => ({
    qty: 1,
    unit: "ea" as const,
    description: `${prefix} ${i + 1}`,
    rateCents: 5000,
    taxable: true,
  }));
}

describe("the reference invoice", () => {
  it("is a real single-page PDF", async () => {
    const bytes = await renderInvoicePdf(REFERENCE);

    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.byteLength).toBeGreaterThan(1000);
    expect(await countPages(bytes)).toBe(1);
  });

  it("shows the arithmetic the owner's paper invoice shows", async () => {
    const text = await extractText(await renderInvoicePdf(REFERENCE));

    expect(text).toContain("$8,792.68"); // subtotal
    expect(text).toContain("8.25%"); // tax rate
    expect(text).toContain("$725.40"); // sales tax
    expect(text).toContain("$9,518.08"); // balance due
  });

  it("carries every line item's description and amount", async () => {
    const text = await extractText(await renderInvoicePdf(REFERENCE));

    for (const line of REFERENCE.lineItems) {
      // Wrapping inserts line breaks, so compare on a distinctive fragment.
      const fragment = line.description.split(",")[0].split(" - ")[0];
      expect(text, `missing: ${line.description}`).toContain(fragment);
    }
    expect(text).toContain("$2,999.00");
    expect(text).toContain("$4,375.00");
    expect(text).toContain("$1,124.60");
  });

  it("prints the hourly unit only on hourly lines", async () => {
    const text = await extractText(await renderInvoicePdf(REFERENCE));

    // Hourly lines carry their unit; a flat per-item price does not. The
    // layout engine breaks a run after the slash, so the rate arrives as
    // "$175.00/" followed by "hr" — collapse the gap before asserting.
    const joined = text.replace(/\/ /g, "/");
    expect(joined).toContain("$175.00/hr");
    expect(joined).not.toContain("/ea");
  });

  it("labels every field of the header grid", async () => {
    const text = await extractText(await renderInvoicePdf(REFERENCE));

    for (const label of [
      "INVOICE",
      "BILL TO",
      "CONTACT",
      "PHONE / EMAIL",
      "JOB / PO #",
      "INVOICE #",
      "DATE",
      "DUE DATE",
      "TERMS",
    ]) {
      expect(text, `missing label: ${label}`).toContain(label);
    }

    expect(text).toContain("Bishop Fabrication LLC");
    expect(text).toContain("(972) 999-7505");
    expect(text).toContain("TSWS-082626");
    expect(text).toContain("Dual Swing Gate");
  });

  it("carries the business details from src/lib/business.ts", async () => {
    const text = await extractText(await renderInvoicePdf(REFERENCE));

    expect(text).toContain("Tidwell Specialty Welding Services");
    expect(text).toContain("(817) 894-6357");
    expect(text).toContain("eric@tidwellwelding.com");
  });

  it("shows the totals block, notes box and footer", async () => {
    const text = await extractText(await renderInvoicePdf(REFERENCE));

    for (const label of [
      "SUBTOTAL",
      "DISCOUNT",
      "TAX RATE",
      "SALES TAX",
      "PAYMENTS",
      "BALANCE DUE",
      "NOTES / WORK PERFORMED",
      "Thank you for your business.",
    ]) {
      expect(text, `missing: ${label}`).toContain(label);
    }
    expect(text).toContain("Gate hung and aligned");
  });
});

describe("long and awkward text", () => {
  it("keeps an unbroken 100-character part number inside its column", async () => {
    // This is the case that broke the hand-rolled renderer: no spaces to wrap
    // on, so the text ran straight through the RATE and AMOUNT columns.
    const bytes = await renderInvoicePdf({
      ...REFERENCE,
      lineItems: [
        {
          qty: 1,
          unit: "ea",
          description:
            "Part ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789012345678901234567890123456789",
          rateCents: 299900,
          taxable: true,
        },
      ],
    });

    const runs = await extractTextRuns(bytes);

    // The part number must arrive as several short runs, not one long one.
    // (The footer's small print is legitimately long and full-width, so this
    // looks only at runs carrying the part number itself.)
    const partRuns = runs.filter((r) => /ABCDEF|\d{6,}/.test(r));
    expect(partRuns.length).toBeGreaterThan(1);
    for (const run of partRuns) {
      expect(run.length, `run too wide for the column: ${run}`).toBeLessThan(
        30,
      );
    }

    // The price is still present and legible as its own run.
    expect(runs.some((r) => r.includes("$2,999.00"))).toBe(true);
  });

  it("breaks a long URL rather than overprinting the price", async () => {
    const bytes = await renderInvoicePdf({
      ...REFERENCE,
      lineItems: [
        {
          qty: 1,
          unit: "ea",
          description:
            "See https://www.example.com/some/really/deep/path/that/never/ends/index.html",
          rateCents: 5000,
          taxable: true,
        },
      ],
    });

    const runs = await extractTextRuns(bytes);

    // The URL is broken into column-width pieces rather than one long run.
    const urlRuns = runs.filter(
      (r) => r.includes("example.com") || r.includes("//"),
    );
    expect(urlRuns.length).toBeGreaterThan(0);
    for (const run of urlRuns) {
      expect(run.length, `run too wide for the column: ${run}`).toBeLessThan(
        40,
      );
    }
    expect(runs.some((r) => r.includes("$50.00"))).toBe(true);
  });

  it("renders accented characters without dropping them", async () => {
    const text = await extractText(
      await renderInvoicePdf({
        ...REFERENCE,
        lineItems: [
          {
            qty: 1,
            unit: "ea",
            description: "Fabricacion e instalacion de puerta",
            rateCents: 5000,
            taxable: true,
          },
        ],
        customer: { ...CUSTOMER, company: "Fabricación Zürich" },
      }),
    );

    expect(text).toContain("Fabricación Zürich");
  });

  it("keeps a very long customer name from displacing the grid", async () => {
    const bytes = await renderInvoicePdf({
      ...REFERENCE,
      customer: {
        ...CUSTOMER,
        company:
          "Bishop Fabrication and Structural Steel Erection Services of North Central Texas LLC",
      },
    });

    // Still one page, and the right-hand column's labels survive.
    expect(await countPages(bytes)).toBe(1);
    const text = await await extractText(bytes);
    expect(text).toContain("INVOICE #");
    expect(text).toContain("TERMS");
  });

  it("handles a large amount without truncating the digits", async () => {
    const text = await extractText(
      await renderInvoicePdf({
        ...REFERENCE,
        lineItems: [
          {
            qty: 1,
            unit: "ea",
            description: "Structural package",
            rateCents: 12345678,
            taxable: true,
          },
        ],
      }),
    );

    expect(text).toContain("$123,456.78");
  });
});

describe("filling the page", () => {
  it("never adds filler rows that push the totals onto another page", async () => {
    // Eleven lines, several of which wrap: the old character-count estimate
    // computed a partial last row, then padded it out with blank rows until
    // the totals were forced onto a second, near-empty page.
    const lineItems = [
      ...REFERENCE.lineItems,
      {
        qty: 1,
        unit: "hr" as const,
        description: "",
        rateCents: 17500,
        taxable: true,
      },
      {
        qty: 1,
        unit: "hr" as const,
        description: "",
        rateCents: 17500,
        taxable: true,
      },
      {
        qty: 1,
        unit: "hr" as const,
        description: "",
        rateCents: 17500,
        taxable: true,
      },
      {
        qty: 1,
        unit: "hr" as const,
        description: "",
        rateCents: 17500,
        taxable: true,
      },
    ];

    // This content genuinely needs more than one page, so the guarantee is not
    // "one page" but "filler costs nothing": the same length either way.
    const withFiller = await renderInvoicePdf({ ...REFERENCE, lineItems });
    const bare = await renderInvoicePdf({
      ...REFERENCE,
      lineItems,
      suppressFillerRows: true,
    });

    expect(await countPages(withFiller)).toBe(await countPages(bare));
  }, 60_000);

  it("does not spill for the sake of filler at any line count", async () => {
    // Whatever the count, adding blank rows must never cost an extra page:
    // the page count has to match what the same invoice needs with no filler
    // at all.
    for (const count of [1, 5, 8, 9, 10, 11, 12]) {
      const lineItems = Array.from({ length: count }, (_, i) => ({
        qty: 1,
        unit: "ea" as const,
        description: `Fabrication and installation work, item number ${i + 1}`,
        rateCents: 5000,
        taxable: true,
      }));

      const withFiller = await renderInvoicePdf({ ...REFERENCE, lineItems });
      const bare = await renderInvoicePdf({
        ...REFERENCE,
        lineItems,
        suppressFillerRows: true,
      });

      expect(
        await countPages(withFiller),
        `${count} lines gained a page from filler`,
      ).toBe(await countPages(bare));
    }
  }, 120_000);

  it("fits at least eleven single-line rows on one page", async () => {
    // A form that breaks after seven short lines wastes most of a sheet.
    const bytes = await renderInvoicePdf({
      ...REFERENCE,
      lineItems: manyLines(11),
    });
    expect(await countPages(bytes)).toBe(1);
  });

  it("keeps the totals, notes and footer on the page with the last row", async () => {
    const text = await extractText(
      await renderInvoicePdf({ ...REFERENCE, lineItems: manyLines(11) }),
    );

    expect(text).toContain("Line item number 11");
    expect(text).toContain("BALANCE DUE");
    expect(text).toContain("NOTES / WORK PERFORMED");
    expect(text).toContain("Thank you for your business.");
  });

  it("draws empty filler rows so a short invoice still reads as a form", async () => {
    const bytes = await renderInvoicePdf({
      ...REFERENCE,
      lineItems: manyLines(2),
    });
    expect(await countPages(bytes)).toBe(1);
    // The table should still reach down toward the totals rather than stopping
    // right under the second row; that is a visual property, so the check here
    // is that the document stays one page and keeps its furniture.
    const text = await await extractText(bytes);
    expect(text).toContain("BALANCE DUE");
    expect(text).toContain("NOTES / WORK PERFORMED");
  });
});

describe("multiple pages", () => {
  it("paginates forty line items without losing one", async () => {
    const bytes = await renderInvoicePdf({
      ...REFERENCE,
      lineItems: manyLines(40),
    });

    expect(await countPages(bytes)).toBeGreaterThan(1);

    const text = await await extractText(bytes);
    for (let i = 1; i <= 40; i += 1) {
      expect(text, `line ${i} missing`).toContain(`Line item number ${i}`);
    }
  });

  it("repeats the column headings on every page", async () => {
    const bytes = await renderInvoicePdf({
      ...REFERENCE,
      lineItems: manyLines(40),
    });
    const runs = await extractTextRuns(bytes);

    const headingCount = runs.filter((r) => r.includes("QTY / HRS")).length;
    expect(headingCount).toBeGreaterThanOrEqual(2);
  });

  it("prints the totals once, on the final page", async () => {
    const bytes = await renderInvoicePdf({
      ...REFERENCE,
      lineItems: manyLines(40),
    });
    const runs = await extractTextRuns(bytes);

    expect(runs.filter((r) => r.includes("BALANCE DUE")).length).toBe(1);
    expect(
      runs.filter((r) => r.includes("$9,518.08")).length,
    ).toBeLessThanOrEqual(1);
  });

  it("survives a hundred line items", async () => {
    const bytes = await renderInvoicePdf({
      ...REFERENCE,
      lineItems: manyLines(100),
    });

    expect(await countPages(bytes)).toBeGreaterThanOrEqual(3);
    const text = await await extractText(bytes);
    expect(text).toContain("Line item number 1 ");
    expect(text).toContain("Line item number 100");
    expect(text).toContain("BALANCE DUE");
  });
});

describe("edge cases", () => {
  it("renders an invoice with no line items at all", async () => {
    const bytes = await renderInvoicePdf({ ...REFERENCE, lineItems: [] });

    expect(await countPages(bytes)).toBe(1);
    const text = await await extractText(bytes);
    expect(text).toContain("BALANCE DUE");
    expect(text).toContain("$0.00");
  });

  it("renders with no notes, keeping the notes box as blank ruled lines", async () => {
    const bytes = await renderInvoicePdf({ ...REFERENCE, notes: undefined });

    expect(await countPages(bytes)).toBe(1);
    expect(await extractText(bytes)).toContain("NOTES / WORK PERFORMED");
  });

  it("shows a discount and payments when they carry a value", async () => {
    const text = await extractText(
      await renderInvoicePdf({
        ...REFERENCE,
        discountCents: 5000,
        paymentsCents: 250000,
      }),
    );

    expect(text).toContain("-$50.00");
    expect(text).toContain("-$2,500.00");
  });

  it("never prints a negative zero", async () => {
    const text = await extractText(
      await renderInvoicePdf({
        ...REFERENCE,
        discountCents: 0,
        paymentsCents: 0,
      }),
    );

    expect(text).not.toContain("-$0.00");
    expect(text).toContain("$0.00");
  });

  it("marks a non-taxable line as No and excludes it from the tax", async () => {
    const text = await extractText(
      await renderInvoicePdf({
        ...REFERENCE,
        lineItems: [
          {
            qty: 1,
            unit: "hr",
            description: "Exempt labor",
            rateCents: 100000,
            taxable: false,
          },
          {
            qty: 1,
            unit: "ea",
            description: "Taxable materials",
            rateCents: 100000,
            taxable: true,
          },
        ],
      }),
    );

    expect(text).toContain("No");
    // Tax on $1,000 only, not $2,000.
    expect(text).toContain("$82.50");
  });

  it("embeds the shop logo", async () => {
    const { LOGO_BYTES } = await import("./invoiceLogo");
    const withLogo = await renderInvoicePdf({
      ...REFERENCE,
      logoPngBytes: LOGO_BYTES,
    });
    const without = await renderInvoicePdf(REFERENCE);

    expect(withLogo.byteLength).toBeGreaterThan(without.byteLength + 1000);
  });

  it("renders US Letter pages", async () => {
    const bytes = await renderInvoicePdf(REFERENCE);
    const pdf = Buffer.from(bytes).toString("latin1");
    // 612 x 792 points.
    expect(pdf).toMatch(/MediaBox\s*\[\s*0\s+0\s+612\s+792\s*\]/);
  });
});
