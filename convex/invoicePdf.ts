/**
 * Invoice PDF rendering. Pure: no Convex imports, no ctx, no filesystem — so a
 * test can call it directly and a Convex action can wrap it later.
 *
 * The layout is built as plain data (`buildInvoiceLayout`) and only then handed
 * to pdf-lib (`renderInvoicePdf`). Splitting it that way means the geometry is
 * assertable in a test without needing a PDF text-extraction dependency.
 */

import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";
import { EMAIL, LEGAL_NAME, PHONE_DISPLAY, SITE_URL } from "../src/lib/business";
import {
  computeInvoiceTotals,
  formatMoney,
  formatRate,
  type InvoiceLine,
} from "./invoiceMath";

export type InvoicePdfInput = {
  number: string;
  issuedAt: number;
  dueAt?: number;
  terms: string;
  jobPo?: string;
  customer: {
    name: string;
    company?: string;
    contact?: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  lineItems: InvoiceLine[];
  discountCents: number;
  taxRateBasisPoints: number;
  paymentsCents: number;
  notes?: string;
  logoPngBytes?: Uint8Array;
};

export type RGB = { r: number; g: number; b: number };

/** The owner's brand red, #C90314. */
export const RED: RGB = { r: 0xc9 / 255, g: 0x03 / 255, b: 0x14 / 255 };
export const BLACK: RGB = { r: 0, g: 0, b: 0 };
export const WHITE: RGB = { r: 1, g: 1, b: 1 };
export const GREY: RGB = { r: 0.42, g: 0.42, b: 0.42 };

export type Align = "left" | "center" | "right";

/** `x` is the anchor: the left edge, centre, or right edge per `align`. The
 * renderer resolves it against real font metrics. */
export type DrawText = {
  text: string;
  x: number;
  y: number;
  size: number;
  color: RGB;
  bold?: boolean;
  align?: Align;
};

export type DrawRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  color: RGB;
};

export type LayoutPage = {
  texts: DrawText[];
  rects: DrawRect[];
};

export type InvoiceLayout = {
  width: number;
  height: number;
  pages: LayoutPage[];
  /** Where the logo goes, when the caller supplies one. */
  logoBox: { x: number; y: number; width: number; height: number };
};

export const PAGE_WIDTH = 612;
export const PAGE_HEIGHT = 792;
const MARGIN = 48;
const RIGHT = PAGE_WIDTH - MARGIN;
/** Lowest y a table row may occupy; below this sit the totals and footer. */
const TABLE_FLOOR = 300;

export async function renderInvoicePdf(
  input: InvoicePdfInput,
): Promise<Uint8Array> {
  const layout = buildInvoiceLayout(input);
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const logo = input.logoPngBytes
    ? await doc.embedPng(input.logoPngBytes)
    : undefined;

  for (const [index, spec] of layout.pages.entries()) {
    const page = doc.addPage([layout.width, layout.height]);

    for (const rect of spec.rects) {
      page.drawRectangle({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        color: rgb(rect.color.r, rect.color.g, rect.color.b),
      });
    }

    if (logo && index === 0) {
      const box = layout.logoBox;
      // Preserve the logo's aspect ratio inside its box.
      const scale = Math.min(
        box.width / logo.width,
        box.height / logo.height,
      );
      const width = logo.width * scale;
      const height = logo.height * scale;
      page.drawImage(logo, {
        x: box.x,
        y: box.y + (box.height - height) / 2,
        width,
        height,
      });
    }

    for (const item of spec.texts) {
      const font: PDFFont = item.bold ? bold : regular;
      page.drawText(item.text, {
        x: resolveX(item, font),
        y: item.y,
        size: item.size,
        font,
        color: rgb(item.color.r, item.color.g, item.color.b),
      });
    }
  }

  return doc.save();
}

function resolveX(item: DrawText, font: PDFFont): number {
  if (!item.align || item.align === "left") return item.x;
  const width = font.widthOfTextAtSize(item.text, item.size);
  return item.align === "right" ? item.x - width : item.x - width / 2;
}

export function buildInvoiceLayout(input: InvoicePdfInput): InvoiceLayout {
  const texts: DrawText[] = [];
  const rects: DrawRect[] = [];

  // Header ------------------------------------------------------------------
  const logoBox = { x: MARGIN, y: PAGE_HEIGHT - 112, width: 170, height: 64 };

  texts.push({
    text: "INVOICE",
    x: RIGHT,
    y: PAGE_HEIGHT - 84,
    size: 34,
    color: RED,
    bold: true,
    align: "right",
  });

  const businessLines = [
    LEGAL_NAME,
    "Eric Tidwell, Owner",
    PHONE_DISPLAY,
    EMAIL,
    SITE_URL.replace(/^https?:\/\//, ""),
  ];
  businessLines.forEach((line, i) => {
    texts.push({
      text: line,
      x: RIGHT,
      y: PAGE_HEIGHT - 106 - i * 12,
      size: 9,
      color: i === 0 ? BLACK : GREY,
      bold: i === 0,
      align: "right",
    });
  });

  rects.push({
    x: MARGIN,
    y: PAGE_HEIGHT - 178,
    width: RIGHT - MARGIN,
    height: 2,
    color: RED,
  });

  // Bill-to / invoice-meta --------------------------------------------------
  const { customer } = input;
  const contactLine = [customer.phone, customer.email]
    .filter(Boolean)
    .join(" \u00b7 ");

  const leftFields: Array<[string, string | undefined]> = [
    ["BILL TO", customer.company ?? customer.name],
    ["CONTACT", customer.contact],
    ["", customer.address],
    ["", contactLine || undefined],
    ["JOB / PO #", input.jobPo],
  ];
  const rightFields: Array<[string, string | undefined]> = [
    ["INVOICE #", input.number],
    ["DATE", formatDate(input.issuedAt)],
    ["DUE DATE", input.dueAt === undefined ? undefined : formatDate(input.dueAt)],
    ["TERMS", input.terms],
  ];

  const metaTop = PAGE_HEIGHT - 200;
  let metaBottom = metaTop;

  for (const [column, fields] of [
    [MARGIN, leftFields],
    [MARGIN + 300, rightFields],
  ] as const) {
    let y = metaTop;
    for (const [label, value] of fields) {
      if (value === undefined) continue;
      if (label) {
        texts.push({
          text: label,
          x: column,
          y,
          size: 7.5,
          color: RED,
          bold: true,
        });
        y -= 11;
      }
      texts.push({ text: value, x: column, y, size: 9.5, color: BLACK });
      y -= 15;
    }
    metaBottom = Math.min(metaBottom, y);
  }

  // Line item table ---------------------------------------------------------
  const totals = computeInvoiceTotals({
    lines: input.lineItems,
    discountCents: input.discountCents,
    taxRateBasisPoints: input.taxRateBasisPoints,
    paymentsCents: input.paymentsCents,
  });

  const cols = {
    qty: MARGIN + 6,
    desc: MARGIN + 62,
    rate: MARGIN + 348,
    tax: MARGIN + 424,
    amount: RIGHT - 6,
  };
  const descWidth = cols.rate - cols.desc - 14;

  const pages: LayoutPage[] = [];
  let page: LayoutPage = { texts, rects };
  let y = metaBottom - 18;

  const drawTableHead = () => {
    page.rects.push({
      x: MARGIN,
      y: y - 5,
      width: RIGHT - MARGIN,
      height: 18,
      color: BLACK,
    });
    const head: Array<[string, number, Align]> = [
      ["QTY/HRS", cols.qty, "left"],
      ["DESCRIPTION OF WORK/MATERIALS", cols.desc, "left"],
      ["RATE", cols.rate, "left"],
      ["TAX", cols.tax, "left"],
      ["AMOUNT", cols.amount, "right"],
    ];
    for (const [text, x, align] of head) {
      page.texts.push({ text, x, y, size: 7.5, color: WHITE, bold: true, align });
    }
    y -= 22;
  };

  drawTableHead();

  input.lineItems.forEach((line, i) => {
    const wrapped = wrapText(line.description, descWidth, 9);
    const rowHeight = Math.max(wrapped.length * 11, 11) + 8;

    // Break before a row that would collide with the totals block. The floor is
    // uniform across pages because we cannot know which page ends up last.
    if (y - rowHeight < TABLE_FLOOR) {
      pages.push(page);
      page = { texts: [], rects: [] };
      y = PAGE_HEIGHT - MARGIN - 12;
      drawTableHead();
    }

    page.texts.push({ text: formatQty(line.qty), x: cols.qty, y, size: 9, color: BLACK });
    page.texts.push({
      text: formatRate(line.rateCents, line.unit),
      x: cols.rate,
      y,
      size: 9,
      color: BLACK,
    });
    page.texts.push({
      text: line.taxable ? "Yes" : "No",
      x: cols.tax,
      y,
      size: 9,
      color: BLACK,
    });
    page.texts.push({
      text: formatMoney(totals.lineAmountsCents[i]),
      x: cols.amount,
      y,
      size: 9,
      color: BLACK,
      align: "right",
    });

    wrapped.forEach((segment, j) => {
      page.texts.push({
        text: segment,
        x: cols.desc,
        y: y - j * 11,
        size: 9,
        color: BLACK,
      });
    });

    y -= Math.max(wrapped.length * 11, 11) + 8;
  });

  pages.push(page);

  // Totals, notes and footer sit at the foot of the final page --------------
  const totalsRight = RIGHT;
  const totalsLabelX = RIGHT - 150;
  let ty = 250;

  const rows: Array<[string, string]> = [
    ["SUBTOTAL", formatMoney(totals.subtotalCents)],
    ["DISCOUNT", `-${formatMoney(totals.discountCents)}`],
    ["TAX RATE", formatPercent(input.taxRateBasisPoints)],
    ["SALES TAX", formatMoney(totals.taxCents)],
    ["PAYMENTS", `-${formatMoney(input.paymentsCents)}`],
  ];

  for (const [label, value] of rows) {
    page.texts.push({ text: label, x: totalsLabelX, y: ty, size: 8.5, color: GREY, bold: true });
    page.texts.push({
      text: value,
      x: totalsRight,
      y: ty,
      size: 9.5,
      color: BLACK,
      align: "right",
    });
    ty -= 16;
  }

  // Balance due bar.
  const barY = ty - 12;
  page.rects.push({
    x: totalsLabelX - 14,
    y: barY - 6,
    width: totalsRight - totalsLabelX + 14,
    height: 26,
    color: RED,
  });
  page.texts.push({
    text: "BALANCE DUE",
    x: totalsLabelX,
    y: barY + 3,
    size: 9.5,
    color: WHITE,
    bold: true,
  });
  page.texts.push({
    text: formatMoney(totals.balanceCents),
    x: totalsRight - 8,
    y: barY + 2,
    size: 12,
    color: WHITE,
    bold: true,
    align: "right",
  });

  // Notes box.
  if (input.notes) {
    const noteWidth = 250;
    page.texts.push({
      text: "NOTES / WORK PERFORMED",
      x: MARGIN,
      y: 250,
      size: 7.5,
      color: RED,
      bold: true,
    });
    wrapText(input.notes, noteWidth, 8.5).forEach((segment, i) => {
      page.texts.push({
        text: segment,
        x: MARGIN,
        y: 235 - i * 11,
        size: 8.5,
        color: BLACK,
      });
    });
  }

  // Footer.
  const centre = PAGE_WIDTH / 2;
  page.texts.push({
    text: "Thank you for your business.",
    x: centre,
    y: 92,
    size: 11,
    color: RED,
    bold: true,
    align: "center",
  });
  wrapText(FOOTER_SMALL_PRINT, RIGHT - MARGIN, 7.5).forEach((segment, i) => {
    page.texts.push({
      text: segment,
      x: centre,
      y: 74 - i * 10,
      size: 7.5,
      color: GREY,
      align: "center",
    });
  });

  return {
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    pages,
    logoBox,
  };
}

export const FOOTER_SMALL_PRINT =
  `Make checks payable to ${LEGAL_NAME}. Customer is responsible for approved ` +
  "labor, materials, applicable taxes, and agreed travel or mobilization charges.";

/** 825 basis points to "8.25%", dropping trailing zeros ("8.5%", "8%"). */
function formatPercent(basisPoints: number): string {
  return `${Number((basisPoints / 100).toFixed(2))}%`;
}

/** Quantities print as integers when whole ("25"), else trimmed ("2.5"). */
function formatQty(qty: number): string {
  return Number.isInteger(qty) ? String(qty) : String(Number(qty.toFixed(2)));
}

/**
 * Greedy word wrap. Helvetica's average glyph is close to 0.5em; 0.52 keeps a
 * little slack so a wrapped line never bleeds past its column.
 */
const AVG_GLYPH_EM = 0.52;

export function wrapText(text: string, maxWidth: number, size: number): string[] {
  const perChar = size * AVG_GLYPH_EM;
  const maxChars = Math.max(Math.floor(maxWidth / perChar), 1);
  const lines: string[] = [];
  let current = "";

  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** UTC so a rendered invoice reads the same wherever it is generated. */
function formatDate(ms: number): string {
  const d = new Date(ms);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}
