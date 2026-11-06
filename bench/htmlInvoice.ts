/**
 * THROWAWAY candidate for the issue #10 spike: the invoice as HTML + CSS,
 * printed by Chromium.
 *
 * The point of this candidate is that the four layout constraints stop being
 * code we own and become CSS the browser engine already implements:
 *
 *   - repeated column headings -> `<thead>` / `display: table-header-group`
 *   - rows never split         -> `break-inside: avoid` on `tr`
 *   - totals/notes/footer kept -> `break-inside: avoid` on the foot block
 *   - US Letter                -> `@page { size: letter }`
 *   - long unbroken tokens     -> `overflow-wrap: anywhere`
 *
 * There is no MAX_TOKEN constant, no hyphenation callback, no hand-measured
 * row height and no page arithmetic anywhere in this file.
 */

import {
  computeInvoiceTotals,
  formatMoney,
  formatRate,
  lineAmountCents,
} from "../convex/invoiceMath";
import type { InvoicePdfInput } from "../convex/invoicePdf";
import {
  EMAIL,
  LEGAL_NAME,
  PHONE_DISPLAY,
  SITE_URL,
} from "../src/lib/business";

const RED = "#C90314";
const GREY = "#6B6B6B";
const SHADE = "#EFEFEF";
const HAIRLINE = "#C8C8C8";

const FOOTER_SMALL_PRINT =
  `Make checks payable to ${LEGAL_NAME}. Customer is responsible for approved ` +
  "labor, materials, applicable taxes, and agreed travel or mobilization charges.";

/** HTML-escape a value coming from the database. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(ms: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(ms));
}

function formatPercent(basisPoints: number): string {
  return `${(basisPoints / 100).toFixed(2).replace(/\.00$/, "")}%`;
}

const CSS = `
  /* Every dimension is in pt, not px. CSS pt is 1/72in, the same unit the
     PDF uses, so these numbers are the react-pdf design's numbers unchanged.
     In px the sheet is 816 wide rather than 612 and the whole invoice comes
     out a quarter too small. */
  @page { size: letter; margin: 40pt 48pt; }

  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  html { height: 100%; }
  body {
    font-family: Helvetica, Arial, sans-serif;
    font-size: 9pt;
    color: #000;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Header ---------------------------------------------------------------- */
  .header { display: flex; justify-content: space-between; align-items: flex-start; }
  .logo { width: 140pt; height: 62pt; object-fit: contain; }
  .header-right { text-align: right; max-width: 300pt; }
  .invoice-word {
    font-size: 30pt; font-weight: bold; color: ${RED};
    letter-spacing: 1pt; margin-bottom: 10pt; line-height: 1;
  }
  .biz-name { font-weight: bold; font-size: 9.5pt; margin-bottom: 2pt; }
  .biz-line { color: ${GREY}; font-size: 8.5pt; margin-bottom: 1.5pt; }
  .rule { height: 2pt; background: ${RED}; margin: 10pt 0 12pt; }

  /* Meta grid ------------------------------------------------------------- */
  .meta { display: flex; gap: 16pt; }
  .meta-col { flex: 1; min-width: 0; }
  .meta-line {
    display: flex; align-items: stretch;
    border-bottom: 0.6pt solid ${HAIRLINE}; height: 21pt; overflow: hidden;
  }
  .meta-label {
    width: 88pt; flex: none; background: ${SHADE};
    padding: 0 7pt; display: flex; align-items: center;
    font-size: 6.5pt; font-weight: bold; color: ${GREY};
  }
  /* One line, clipped with an ellipsis: a long company name must never
     displace the grid. The react-pdf original sets maxLines + textOverflow. */
  .meta-value {
    flex: 1; min-width: 0; padding: 0 9pt; display: flex; align-items: center;
    font-size: 8.5pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  /* Line item table ------------------------------------------------------- */
  table.items {
    width: 100%; margin-top: 12pt;
    border: 0.6pt solid ${HAIRLINE};
    border-collapse: collapse; table-layout: fixed;
  }
  /* The whole reason this candidate exists: the browser repeats a header
     group on every page it paginates onto, with no work from us. */
  table.items thead { display: table-header-group; break-inside: avoid; }
  table.items thead th {
    background: #000; color: #fff;
    font-size: 6.5pt; font-weight: bold; text-align: center;
    padding: 4pt 2pt;
  }
  table.items tr { break-inside: avoid; }
  table.items td {
    border-top: 0.6pt solid ${HAIRLINE};
    border-right: 0.6pt solid ${HAIRLINE};
    padding: 6pt 4pt; font-size: 8.5pt; text-align: center;
    height: 26pt; vertical-align: middle;
  }
  table.items td:last-child { border-right: none; }
  td.desc {
    text-align: left; padding: 6pt 7pt;
    /* A 100-character part number breaks inside its own column instead of
       running across RATE and AMOUNT. */
    overflow-wrap: anywhere;
  }
  tr.filler td { height: 26pt; }

  /* Option 4, rejected — see FillerMode. Two separate problems, both real:
     1. It only fills on a single-page invoice. Once the document paginates
        the spacer collapses and the result equals no filler at all.
     2. Even where it does fill, the rules cannot match the table. Borders are
        snapped to device pixels; gradient stops are not, so a 0.6pt rule
        anti-aliases away to nothing. It only becomes visible at ~1.5pt, by
        which point it is visibly heavier than the 0.6pt hairlines above it.
     The 1.5pt below is the thinnest value that renders at all. */
  body.filler-css { display: flex; flex-direction: column; min-height: 100%; }
  body.filler-css .spacer {
    flex: 1 1 auto;
    min-height: 0;
    border-left: 0.6pt solid ${HAIRLINE};
    border-right: 0.6pt solid ${HAIRLINE};
    border-bottom: 0.6pt solid ${HAIRLINE};
    /* Four vertical column dividers plus the 26pt horizontal rules, drawn as
       background layers. Note what this costs: the column geometry (72/248/
       344/420pt) and the row pitch now exist in two places — the table's own
       widths, and here. */
    background-image:
      linear-gradient(${HAIRLINE}, ${HAIRLINE}),
      linear-gradient(${HAIRLINE}, ${HAIRLINE}),
      linear-gradient(${HAIRLINE}, ${HAIRLINE}),
      linear-gradient(${HAIRLINE}, ${HAIRLINE}),
      repeating-linear-gradient(
        to bottom,
        ${HAIRLINE} 0pt 1.5pt,
        transparent 1.5pt 26pt
      );
    background-size: 0.6pt 100%, 0.6pt 100%, 0.6pt 100%, 0.6pt 100%, 100% 100%;
    background-position: 72pt 0, 248pt 0, 344pt 0, 420pt 0, 0 0;
    background-repeat: no-repeat, no-repeat, no-repeat, no-repeat, repeat;
  }
  body:not(.filler-css) .spacer { display: none; }

  /* Foot: notes beside totals, kept whole ---------------------------------- */
  .foot-block { break-inside: avoid; margin-top: 12pt; }
  .foot { display: flex; gap: 12pt; align-items: flex-start; }
  .notes { flex: 1; min-width: 0; }
  .notes-head { background: ${SHADE}; padding: 4pt 7pt; }
  .notes-head span { font-size: 6.5pt; font-weight: bold; color: ${RED}; }
  .notes-body { padding-top: 4pt; }
  .notes-line {
    border-bottom: 0.6pt solid ${HAIRLINE}; min-height: 12pt;
    display: flex; align-items: flex-end; padding-bottom: 1pt;
    font-size: 8pt; overflow-wrap: anywhere;
  }

  .totals { width: 246pt; flex: none; }
  .total-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 3.5pt 10pt;
  }
  .total-row.shaded { background: ${SHADE}; }
  .total-label { font-size: 7.5pt; font-weight: bold; color: ${GREY}; }
  .total-value { font-size: 9pt; }
  .balance {
    display: flex; justify-content: space-between; align-items: center;
    background: ${RED}; padding: 8pt 10pt; margin-top: 4pt;
  }
  .balance-label { font-size: 9.5pt; font-weight: bold; color: #fff; }
  .balance-value { font-size: 12pt; font-weight: bold; color: #fff; }

  /* Footer: once, under the foot block, same as the react-pdf original ----- */
  .footer { padding-top: 10pt; text-align: center; }
  .thanks { font-size: 10pt; font-weight: bold; color: ${RED}; margin-bottom: 3pt; }
  .small-print { font-size: 6.5pt; color: ${GREY}; line-height: 1.3; }
`;

/**
 * How the blank ruled area under the last line item is produced.
 *
 * - "rows": blank <tr>s, count resolved by measuring and reprinting. Needs a
 *   DOM between prints, so on a stateless endpoint it costs a round trip per
 *   attempt. This is what the react-pdf renderer does today, expensively.
 * - "none": no filler at all. One print, nothing to measure.
 * - "css": a ruled spacer that grows to fill whatever space is left on the
 *   last page. One print, nothing to measure — but MEASURED AND REJECTED. It
 *   fills on a single-page invoice and does nothing at all once the document
 *   paginates: against a 40-line invoice its last page is pixel-identical to
 *   "none" (0 differing pixels). `min-height: 100%` on the flex body resolves
 *   against the flow, not against the last page box. Kept here as the
 *   evidence for that, not as a usable option.
 */
export type FillerMode = "rows" | "none" | "css";

export function invoiceHtml(
  input: InvoicePdfInput,
  fillerMode: FillerMode = "rows",
): string {
  const totals = computeInvoiceTotals({
    lines: input.lineItems,
    discountCents: input.discountCents,
    taxRateBasisPoints: input.taxRateBasisPoints,
    paymentsCents: input.paymentsCents,
  });

  const { customer } = input;
  const contactLine = [customer.phone, customer.email]
    .filter(Boolean)
    .join(" · ");

  const leftFields: Array<[string, string]> = [
    ["BILL TO", customer.company ?? customer.name],
    ["CONTACT", customer.contact ?? ""],
    ["PHONE / EMAIL", contactLine],
    ["JOB / PO #", input.jobPo ?? ""],
  ];
  const rightFields: Array<[string, string]> = [
    ["INVOICE #", input.number],
    ["DATE", formatDate(input.issuedAt)],
    [
      "DUE DATE",
      input.dueAt === undefined ? input.terms : formatDate(input.dueAt),
    ],
    ["TERMS", input.terms],
  ];

  const signed = (cents: number) =>
    cents > 0 ? `-${formatMoney(cents)}` : formatMoney(0);
  const totalRows: Array<[string, string]> = [
    ["SUBTOTAL", formatMoney(totals.subtotalCents)],
    ["DISCOUNT", signed(totals.discountCents)],
    ["TAX RATE", formatPercent(input.taxRateBasisPoints)],
    ["SALES TAX", formatMoney(totals.taxCents)],
    ["PAYMENTS", signed(input.paymentsCents)],
  ];

  const metaCol = (fields: Array<[string, string]>) =>
    `<div class="meta-col">${fields
      .map(
        ([label, value]) =>
          `<div class="meta-line"><div class="meta-label">${esc(label)}</div>` +
          `<div class="meta-value">${esc(value)}</div></div>`,
      )
      .join("")}</div>`;

  const logo = input.logoPngBytes
    ? `<img class="logo" alt="" src="data:image/png;base64,${Buffer.from(
        input.logoPngBytes,
      ).toString("base64")}">`
    : `<div class="logo"></div>`;

  const rows = input.lineItems
    .map(
      (line) =>
        `<tr><td>${esc(String(line.qty))}</td>` +
        `<td class="desc">${esc(line.description)}</td>` +
        `<td>${esc(formatRate(line.rateCents, line.unit))}</td>` +
        `<td>${line.taxable ? "Yes" : "No"}</td>` +
        `<td>${esc(formatMoney(lineAmountCents(line)))}</td></tr>`,
    )
    .join("");

  // Filler rows are injected by the renderer after measuring the printed
  // layout, so this template carries none.
  const noteText = input.notes ?? "";
  const noteLines = Array.from(
    { length: 5 },
    (_, i) => `<div class="notes-line">${i === 0 ? esc(noteText) : ""}</div>`,
  ).join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Invoice ${esc(
    input.number,
  )}</title><style>${CSS}</style></head>
<body class="${fillerMode === "css" ? "filler-css" : ""}">
  <div class="header">
    ${logo}
    <div class="header-right">
      <div class="invoice-word">INVOICE</div>
      <div class="biz-name">${esc(LEGAL_NAME)}</div>
      <div class="biz-line">Eric Tidwell, Owner</div>
      <div class="biz-line">${esc(PHONE_DISPLAY)}</div>
      <div class="biz-line">${esc(EMAIL)}</div>
      <div class="biz-line">${esc(SITE_URL.replace(/^https?:\/\//, ""))}</div>
    </div>
  </div>
  <div class="rule"></div>
  <div class="meta">${metaCol(leftFields)}${metaCol(rightFields)}</div>

  <table class="items">
    <thead><tr>
      <th style="width:72pt">QTY / HRS</th>
      <th>DESCRIPTION OF WORK / MATERIALS</th>
      <th style="width:96pt">RATE</th>
      <th style="width:76pt">TAX</th>
      <th style="width:96pt">AMOUNT</th>
    </tr></thead>
    <tbody id="rows">${rows}</tbody>
  </table>

  <div class="spacer"></div>

  <div class="foot-block">
    <div class="foot">
      <div class="notes">
        <div class="notes-head"><span>NOTES / WORK PERFORMED</span></div>
        <div class="notes-body">${noteLines}</div>
      </div>
      <div class="totals">
        ${totalRows
          .map(
            ([label, value], i) =>
              `<div class="total-row${i % 2 === 0 ? " shaded" : ""}">` +
              `<span class="total-label">${esc(label)}</span>` +
              `<span class="total-value">${esc(value)}</span></div>`,
          )
          .join("")}
        <div class="balance">
          <span class="balance-label">BALANCE DUE</span>
          <span class="balance-value">${esc(
            formatMoney(totals.balanceCents),
          )}</span>
        </div>
      </div>
    </div>
    <div class="footer">
      <div class="thanks">Thank you for your business.</div>
      <div class="small-print">${esc(FOOTER_SMALL_PRINT)}</div>
    </div>
  </div>
</body></html>`;
}
