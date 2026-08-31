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
/** Label-cell fill on the meta grid and alternating totals rows. */
export const SHADE: RGB = { r: 0.937, g: 0.937, b: 0.937 };
/** Table and grid rules. */
export const HAIRLINE: RGB = { r: 0.78, g: 0.78, b: 0.78 };

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

/** Shorten to fit a width, using the same 0.5em-per-char estimate as wrapText.
 * Cheap and slightly conservative, which is the right way to be wrong here. */
export function truncateToWidth(
  text: string,
  maxWidth: number,
  size: number,
): string {
  const perChar = size * 0.5;
  const maxChars = Math.floor(maxWidth / perChar);
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
}

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

/** PNG files start with the 8-byte signature; JPEG with FF D8 FF. */
async function embedLogo(doc: PDFDocument, bytes: Uint8Array) {
  const isPng =
    bytes.length > 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;
  return isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
}

export async function renderInvoicePdf(
  input: InvoicePdfInput,
): Promise<Uint8Array> {
  const layout = buildInvoiceLayout(input);
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  // The badge artwork ships as JPEG, but a PNG must keep working. Sniff the
  // magic bytes rather than trusting the field name.
  const logo = input.logoPngBytes
    ? await embedLogo(doc, input.logoPngBytes)
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
  // Drawn as a bordered grid with shaded label cells, matching the paper form
  // the owner already sends: label column on the left of each pair, value in a
  // wider cell beside it, hairline rules between every row.
  const { customer } = input;
  const contactLine = [customer.phone, customer.email]
    .filter(Boolean)
    .join(" \u00b7 ");

  const leftFields: Array<[string, string]> = [
    ["BILL TO", customer.company ?? customer.name],
    ["ADDRESS", customer.address ?? ""],
    ["CONTACT", customer.contact ?? customer.name],
    ["PHONE / EMAIL", contactLine],
    ["JOB / PO #", input.jobPo ?? ""],
  ];
  const rightFields: Array<[string, string]> = [
    ["INVOICE #", input.number],
    ["DATE", formatDate(input.issuedAt)],
    ["DUE DATE", input.dueAt === undefined ? input.terms : formatDate(input.dueAt)],
    ["TERMS", input.terms],
  ];

  const metaTop = PAGE_HEIGHT - 190;
  const metaRowHeight = 21;
  const halfWidth = (RIGHT - MARGIN) / 2;
  const labelWidth = 78;
  const metaRows = Math.max(leftFields.length, rightFields.length);

  for (const [colX, fields] of [
    [MARGIN, leftFields],
    [MARGIN + halfWidth + 8, rightFields],
  ] as const) {
    fields.forEach(([label, value], i) => {
      const rowY = metaTop - i * metaRowHeight;
      // Shaded label cell.
      rects.push({
        x: colX,
        y: rowY - 6,
        width: labelWidth,
        height: metaRowHeight,
        color: SHADE,
      });
      // Hairline under the whole row.
      rects.push({
        x: colX,
        y: rowY - 6,
        width: halfWidth - 8,
        height: 0.6,
        color: HAIRLINE,
      });
      texts.push({
        text: label,
        x: colX + 7,
        y: rowY + 1,
        size: 7,
        color: GREY,
        bold: true,
      });
      if (value) {
        // Values must not spill past their cell — a long address would run
        // straight into the right-hand column's labels.
        const cellWidth = halfWidth - 8 - labelWidth - 14;
        texts.push({
          text: truncateToWidth(value, cellWidth, 9),
          x: colX + labelWidth + 9,
          y: rowY + 1,
          size: 9,
          color: BLACK,
        });
      }
    });
    // Close the bottom of the column.
    rects.push({
      x: colX,
      y: metaTop - metaRows * metaRowHeight + 15,
      width: halfWidth - 8,
      height: 0.6,
      color: HAIRLINE,
    });
  }

  const metaBottom = metaTop - metaRows * metaRowHeight;

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

    // Rule under the row, as on the paper form.
    page.rects.push({
      x: MARGIN,
      y: y + 6,
      width: RIGHT - MARGIN,
      height: 0.6,
      color: HAIRLINE,
    });
  });

  // Empty ruled rows down to the totals block, so the table reads as a form
  // rather than stopping wherever the work happened to end.
  while (y - 20 > TABLE_FLOOR) {
    y -= 20;
    page.rects.push({
      x: MARGIN,
      y: y + 6,
      width: RIGHT - MARGIN,
      height: 0.6,
      color: HAIRLINE,
    });
  }

  pages.push(page);

  // Totals, notes and footer sit at the foot of the final page --------------
  const totalsRight = RIGHT;
  const totalsLabelX = RIGHT - 150;
  let ty = 250;

  // Every row is always shown, including zeros. His paper invoice lists
  // DISCOUNT and PAYMENTS at $0.00 rather than hiding them, so the customer can
  // see nothing was quietly left out. Zeros print as $0.00, never -$0.00.
  const signed = (cents: number) =>
    cents > 0 ? `-${formatMoney(cents)}` : formatMoney(0);

  const rows: Array<[string, string]> = [
    ["SUBTOTAL", formatMoney(totals.subtotalCents)],
    ["DISCOUNT", signed(totals.discountCents)],
    ["TAX RATE", formatPercent(input.taxRateBasisPoints)],
    ["SALES TAX", formatMoney(totals.taxCents)],
    ["PAYMENTS", signed(input.paymentsCents)],
  ];

  rows.forEach(([label, value], i) => {
    // Alternating shaded bands, as on the paper form.
    if (i % 2 === 0) {
      page.rects.push({
        x: totalsLabelX - 14,
        y: ty - 5,
        width: totalsRight - totalsLabelX + 14,
        height: 16,
        color: SHADE,
      });
    }
    page.texts.push({
      text: label,
      x: totalsRight - 92,
      y: ty,
      size: 8,
      color: GREY,
      bold: true,
      align: "right",
    });
    page.texts.push({
      text: value,
      x: totalsRight - 6,
      y: ty,
      size: 9,
      color: BLACK,
      align: "right",
    });
    ty -= 16;
  });

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

  // Notes box — always drawn, with ruled writing lines like the paper form so
  // the owner can add a note by hand on a printed copy.
  const noteWidth = 150;
  const noteLines = 7;
  const noteLineGap = 13;
  const noteTop = 250;

  page.rects.push({
    x: MARGIN,
    y: noteTop - 4,
    width: noteWidth,
    height: 17,
    color: SHADE,
  });
  page.texts.push({
    text: "NOTES / WORK PERFORMED",
    x: MARGIN + 6,
    y: noteTop + 1,
    size: 7,
    color: RED,
    bold: true,
  });

  const written = input.notes ? wrapText(input.notes, noteWidth - 8, 8) : [];
  for (let i = 0; i < noteLines; i += 1) {
    const lineY = noteTop - 10 - (i + 1) * noteLineGap;
    page.rects.push({
      x: MARGIN,
      y: lineY,
      width: noteWidth,
      height: 0.6,
      color: HAIRLINE,
    });
    if (written[i]) {
      page.texts.push({
        text: written[i],
        x: MARGIN + 4,
        y: lineY + 4,
        size: 8,
        color: BLACK,
      });
    }
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
