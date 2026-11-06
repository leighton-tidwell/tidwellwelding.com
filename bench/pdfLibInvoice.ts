/**
 * THROWAWAY candidate for the issue #10 spike: the same invoice composed
 * directly with pdf-lib instead of @react-pdf/renderer.
 *
 * This is a measurement artefact, not a production renderer. It reproduces the
 * four layout constraints the issue names — US Letter, column headings
 * repeated on every page, filler rows under the last entry, and the
 * notes/totals/footer block kept together — so that the timing comparison is
 * against something that could plausibly ship. It does NOT reproduce every
 * pixel of the react-pdf layout, and it has no tests; see docs/pdf-renderer-spike.md.
 */
import {
  PDFDocument,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  rgb,
  StandardFonts,
} from "pdf-lib";
import {
  computeInvoiceTotals,
  formatMoney,
  formatRate,
} from "../convex/invoiceMath";
import type { InvoicePdfInput } from "../convex/invoicePdf";
import {
  EMAIL,
  LEGAL_NAME,
  PHONE_DISPLAY,
  SITE_URL,
} from "../src/lib/business";

const LETTER = { w: 612, h: 792 };
const PAD_X = 48;
const PAD_TOP = 40;
const PAD_BOTTOM = 40;
const CONTENT_W = LETTER.w - PAD_X * 2;

const RED = rgb(0xc9 / 255, 0x03 / 255, 0x14 / 255);
const BLACK = rgb(0, 0, 0);
const WHITE = rgb(1, 1, 1);
const GREY = rgb(0x6b / 255, 0x6b / 255, 0x6b / 255);
const SHADE = rgb(0xef / 255, 0xef / 255, 0xef / 255);
const HAIRLINE = rgb(0xc8 / 255, 0xc8 / 255, 0xc8 / 255);

const COL_QTY = 72;
const COL_RATE = 96;
const COL_TAX = 76;
const COL_AMOUNT = 96;
const COL_DESC = CONTENT_W - COL_QTY - COL_RATE - COL_TAX - COL_AMOUNT;

const ROW_MIN_H = 26;
const CELL_PAD_Y = 6;
const CELL_PAD_X = 7;
const BODY_SIZE = 8.5;
const LINE_H = 11;
const HEAD_H = 15;
const MAX_TOKEN = 24;
const MAX_FILLER_ROWS = 12;

type Fonts = { regular: PDFFont; bold: PDFFont };

/** Greedy wrap, splitting tokens with no break point the way the react-pdf
 * hyphenation callback does. */
function wrap(
  text: string,
  font: PDFFont,
  size: number,
  width: number,
): string[] {
  if (text.trim() === "") return [" "];
  const words: string[] = [];
  for (const raw of text.split(/\s+/)) {
    if (raw.length <= MAX_TOKEN) {
      words.push(raw);
      continue;
    }
    for (let i = 0; i < raw.length; i += MAX_TOKEN) {
      words.push(raw.slice(i, i + MAX_TOKEN));
    }
  }
  const out: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line === "" ? word : `${line} ${word}`;
    if (font.widthOfTextAtSize(next, size) <= width) {
      line = next;
    } else {
      if (line !== "") out.push(line);
      line = word;
    }
  }
  if (line !== "") out.push(line);
  return out.length > 0 ? out : [" "];
}

type Row = {
  qty: string;
  desc: string[];
  rate: string;
  tax: string;
  amount: string;
  height: number;
};

function box(
  page: PDFPage,
  x: number,
  y: number,
  w: number,
  h: number,
  color: ReturnType<typeof rgb>,
): void {
  page.drawRectangle({ x, y, width: w, height: h, color });
}

function hline(page: PDFPage, x: number, y: number, w: number): void {
  page.drawLine({
    start: { x, y },
    end: { x: x + w, y },
    thickness: 0.6,
    color: HAIRLINE,
  });
}

function vline(page: PDFPage, x: number, y: number, h: number): void {
  page.drawLine({
    start: { x, y },
    end: { x, y: y + h },
    thickness: 0.6,
    color: HAIRLINE,
  });
}

function centred(
  page: PDFPage,
  text: string,
  x: number,
  w: number,
  y: number,
  font: PDFFont,
  size: number,
  color = BLACK,
): void {
  const tw = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: x + (w - tw) / 2, y, size, font, color });
}

function right(
  page: PDFPage,
  text: string,
  xRight: number,
  y: number,
  font: PDFFont,
  size: number,
  color = BLACK,
): void {
  const tw = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: xRight - tw, y, size, font, color });
}

function drawTableHead(page: PDFPage, top: number, fonts: Fonts): number {
  const y = top - HEAD_H;
  box(page, PAD_X, y, CONTENT_W, HEAD_H, BLACK);
  const cols: Array<[string, number, number]> = [
    ["QTY / HRS", PAD_X, COL_QTY],
    ["DESCRIPTION OF WORK / MATERIALS", PAD_X + COL_QTY, COL_DESC],
    ["RATE", PAD_X + COL_QTY + COL_DESC, COL_RATE],
    ["TAX", PAD_X + COL_QTY + COL_DESC + COL_RATE, COL_TAX],
    ["AMOUNT", PAD_X + COL_QTY + COL_DESC + COL_RATE + COL_TAX, COL_AMOUNT],
  ];
  for (const [label, x, w] of cols) {
    centred(page, label, x, w, y + 5, fonts.bold, 6.5, WHITE);
  }
  return y;
}

function drawRow(page: PDFPage, row: Row, top: number, fonts: Fonts): number {
  const y = top - row.height;
  hline(page, PAD_X, top, CONTENT_W);
  let x = PAD_X;
  for (const w of [COL_QTY, COL_DESC, COL_RATE, COL_TAX]) {
    x += w;
    vline(page, x, y, row.height);
  }
  const mid = y + row.height / 2 - BODY_SIZE / 2 + 1;
  centred(page, row.qty, PAD_X, COL_QTY, mid, fonts.regular, BODY_SIZE);
  const descTop = y + row.height - CELL_PAD_Y - BODY_SIZE;
  const descY =
    row.desc.length === 1
      ? mid
      : y +
        row.height / 2 +
        ((row.desc.length - 1) * LINE_H) / 2 -
        BODY_SIZE / 2;
  row.desc.forEach((line, i) => {
    page.drawText(line, {
      x: PAD_X + COL_QTY + CELL_PAD_X,
      y: (row.desc.length === 1 ? mid : descY) - i * LINE_H,
      size: BODY_SIZE,
      font: fonts.regular,
      color: BLACK,
    });
  });
  void descTop;
  centred(
    page,
    row.rate,
    PAD_X + COL_QTY + COL_DESC,
    COL_RATE,
    mid,
    fonts.regular,
    BODY_SIZE,
  );
  centred(
    page,
    row.tax,
    PAD_X + COL_QTY + COL_DESC + COL_RATE,
    COL_TAX,
    mid,
    fonts.regular,
    BODY_SIZE,
  );
  centred(
    page,
    row.amount,
    PAD_X + COL_QTY + COL_DESC + COL_RATE + COL_TAX,
    COL_AMOUNT,
    mid,
    fonts.regular,
    BODY_SIZE,
  );
  return y;
}

const HEADER_BLOCK_H = 230;
const FOOT_H = 124;
const FOOTER_H = 34;

function drawFoot(
  page: PDFPage,
  top: number,
  fonts: Fonts,
  notes: string,
  totalRows: Array<[string, string]>,
  balance: string,
): void {
  const gap = 12;
  const totalsW = 246;
  const notesW = CONTENT_W - totalsW - gap;
  // Notes column
  const headH = 14;
  box(page, PAD_X, top - headH, notesW, headH, SHADE);
  page.drawText("NOTES / WORK PERFORMED", {
    x: PAD_X + CELL_PAD_X,
    y: top - headH + 4,
    size: 6.5,
    font: fonts.bold,
    color: RED,
  });
  let ny = top - headH - 4;
  const noteLines = wrap(notes, fonts.regular, 8, notesW - 2);
  for (let i = 0; i < 5; i += 1) {
    ny -= 12;
    hline(page, PAD_X, ny, notesW);
    const line = noteLines[i];
    if (line && line.trim() !== "") {
      page.drawText(line, {
        x: PAD_X,
        y: ny + 2,
        size: 8,
        font: fonts.regular,
        color: BLACK,
      });
    }
  }
  // Totals column
  const tx = PAD_X + notesW + gap;
  let ty = top;
  totalRows.forEach(([label, value], i) => {
    const h = 16;
    ty -= h;
    if (i % 2 === 0) box(page, tx, ty, totalsW, h, SHADE);
    page.drawText(label, {
      x: tx + 10,
      y: ty + 5,
      size: 7.5,
      font: fonts.bold,
      color: GREY,
    });
    right(page, value, tx + totalsW - 10, ty + 4, fonts.regular, 9);
  });
  ty -= 4 + 28;
  box(page, tx, ty, totalsW, 28, RED);
  page.drawText("BALANCE DUE", {
    x: tx + 10,
    y: ty + 10,
    size: 9.5,
    font: fonts.bold,
    color: WHITE,
  });
  right(page, balance, tx + totalsW - 10, ty + 8, fonts.bold, 12);
}

function drawFooter(page: PDFPage, fonts: Fonts, smallPrint: string): void {
  const y = PAD_BOTTOM;
  const thanks = "Thank you for your business.";
  centred(page, thanks, PAD_X, CONTENT_W, y + 18, fonts.bold, 10, RED);
  const lines = wrap(smallPrint, fonts.regular, 6.5, CONTENT_W);
  lines.forEach((line, i) => {
    centred(
      page,
      line,
      PAD_X,
      CONTENT_W,
      y + 8 - i * 9,
      fonts.regular,
      6.5,
      GREY,
    );
  });
}

function drawHeader(
  page: PDFPage,
  fonts: Fonts,
  logo: PDFImage | undefined,
  input: InvoicePdfInput,
): number {
  let y = LETTER.h - PAD_TOP;
  if (logo) {
    const scale = Math.min(140 / logo.width, 62 / logo.height);
    page.drawImage(logo, {
      x: PAD_X,
      y: y - 62,
      width: logo.width * scale,
      height: logo.height * scale,
    });
  }
  const rightX = PAD_X + CONTENT_W;
  right(page, "INVOICE", rightX, y - 28, fonts.bold, 30, RED);
  let ry = y - 44;
  right(page, LEGAL_NAME, rightX, ry, fonts.bold, 9.5);
  for (const line of [
    "Eric Tidwell, Owner",
    PHONE_DISPLAY,
    EMAIL,
    SITE_URL.replace(/^https?:\/\//, ""),
  ]) {
    ry -= 10;
    right(page, line, rightX, ry, fonts.regular, 8.5, GREY);
  }
  y = Math.min(y - 72, ry - 10);
  box(page, PAD_X, y, CONTENT_W, 2, RED);
  y -= 12;

  // Meta grid: two columns of four label/value rows.
  const colW = (CONTENT_W - 16) / 2;
  const fmtDate = (ms: number) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(ms));
  const { customer } = input;
  const left: Array<[string, string]> = [
    ["BILL TO", customer.company ?? customer.name],
    ["CONTACT", customer.contact ?? ""],
    [
      "PHONE / EMAIL",
      [customer.phone, customer.email].filter(Boolean).join(" · "),
    ],
    ["JOB / PO #", input.jobPo ?? ""],
  ];
  const rightCol: Array<[string, string]> = [
    ["INVOICE #", input.number],
    ["DATE", fmtDate(input.issuedAt)],
    [
      "DUE DATE",
      input.dueAt === undefined ? input.terms : fmtDate(input.dueAt),
    ],
    ["TERMS", input.terms],
  ];
  const rowH = 21;
  for (const [i, col] of [left, rightCol].entries()) {
    const x = PAD_X + i * (colW + 16);
    let cy = y;
    for (const [label, value] of col) {
      cy -= rowH;
      box(page, x, cy, 88, rowH, SHADE);
      page.drawText(label, {
        x: x + 7,
        y: cy + 7,
        size: 6.5,
        font: fonts.bold,
        color: GREY,
      });
      page.drawText(value, {
        x: x + 97,
        y: cy + 6,
        size: 8.5,
        font: fonts.regular,
        color: BLACK,
      });
      hline(page, x, cy, colW);
    }
  }
  return y - rowH * 4 - 12;
}

export async function renderInvoicePdfLib(
  input: InvoicePdfInput,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  const logo = input.logoPngBytes
    ? await doc.embedPng(input.logoPngBytes)
    : undefined;

  const totals = computeInvoiceTotals({
    lines: input.lineItems,
    discountCents: input.discountCents,
    taxRateBasisPoints: input.taxRateBasisPoints,
    paymentsCents: input.paymentsCents,
  });
  const signed = (cents: number) =>
    cents > 0 ? `-${formatMoney(cents)}` : formatMoney(0);
  const totalRows: Array<[string, string]> = [
    ["SUBTOTAL", formatMoney(totals.subtotalCents)],
    ["DISCOUNT", signed(totals.discountCents)],
    [
      "TAX RATE",
      `${(input.taxRateBasisPoints / 100).toFixed(2).replace(/\.00$/, "")}%`,
    ],
    ["SALES TAX", formatMoney(totals.taxCents)],
    ["PAYMENTS", signed(input.paymentsCents)],
  ];

  const rows: Row[] = input.lineItems.map((line, i) => {
    const desc = wrap(
      line.description,
      fonts.regular,
      BODY_SIZE,
      COL_DESC - CELL_PAD_X * 2,
    );
    return {
      qty: String(line.qty),
      desc,
      rate: formatRate(line.rateCents, line.unit),
      tax: line.taxable ? "Yes" : "No",
      amount: formatMoney(totals.lineAmountsCents[i]),
      height: Math.max(ROW_MIN_H, desc.length * LINE_H + CELL_PAD_Y * 2),
    };
  });

  const blank: Row = {
    qty: " ",
    desc: [" "],
    rate: " ",
    tax: " ",
    amount: " ",
    height: ROW_MIN_H,
  };

  /**
   * Lay the rows out, then take the most filler rows that still fit without
   * adding a page. Unlike the react-pdf path this is pure arithmetic over the
   * measured row heights, so it costs no extra renders.
   */
  const layout = (fillerRows: number) => {
    const all = [...rows, ...Array.from({ length: fillerRows }, () => blank)];
    const pages: Row[][] = [];
    let current: Row[] = [];
    // Header plus meta grid, measured against the react-pdf output.
    let top = LETTER.h - PAD_TOP - HEADER_BLOCK_H;
    const bottomLimit = PAD_BOTTOM + FOOTER_H;
    top -= HEAD_H;
    for (const row of all) {
      if (top - row.height < bottomLimit) {
        pages.push(current);
        current = [];
        top = LETTER.h - PAD_TOP - HEAD_H;
      }
      current.push(row);
      top -= row.height;
    }
    pages.push(current);
    const footFits = top - FOOT_H - 12 >= bottomLimit;
    return { pages, footFits };
  };

  let chosen = layout(0);
  const basePages = chosen.pages.length + (chosen.footFits ? 0 : 1);
  for (let f = 1; f <= MAX_FILLER_ROWS; f += 1) {
    const candidate = layout(f);
    const pages = candidate.pages.length + (candidate.footFits ? 0 : 1);
    if (pages > basePages) break;
    chosen = candidate;
  }

  for (const [i, pageRows] of chosen.pages.entries()) {
    const page = doc.addPage([LETTER.w, LETTER.h]);
    let top =
      i === 0 ? drawHeader(page, fonts, logo, input) : LETTER.h - PAD_TOP;
    top = drawTableHead(page, top, fonts);
    for (const row of pageRows) top = drawRow(page, row, top, fonts);
    hline(page, PAD_X, top, CONTENT_W);
    const last = i === chosen.pages.length - 1;
    if (last) {
      if (chosen.footFits) {
        drawFoot(
          page,
          top - 12,
          fonts,
          input.notes ?? "",
          totalRows,
          formatMoney(totals.balanceCents),
        );
      } else {
        drawFooter(page, fonts, FOOTER_SMALL_PRINT);
        const extra = doc.addPage([LETTER.w, LETTER.h]);
        drawFoot(
          extra,
          LETTER.h - PAD_TOP,
          fonts,
          input.notes ?? "",
          totalRows,
          formatMoney(totals.balanceCents),
        );
        drawFooter(extra, fonts, FOOTER_SMALL_PRINT);
        return doc.save();
      }
    }
    drawFooter(page, fonts, FOOTER_SMALL_PRINT);
  }
  return doc.save();
}

const FOOTER_SMALL_PRINT =
  `Make checks payable to ${LEGAL_NAME}. Customer is responsible for approved ` +
  "labor, materials, applicable taxes, and agreed travel or mobilization charges.";
