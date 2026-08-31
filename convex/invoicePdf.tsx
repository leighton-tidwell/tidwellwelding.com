"use node";

import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import React from "react";
import {
  EMAIL,
  LEGAL_NAME,
  PHONE_DISPLAY,
  SITE_URL,
} from "../src/lib/business";
import {
  computeInvoiceTotals,
  formatMoney,
  formatRate,
  type InvoiceLine,
} from "./invoiceMath";

/**
 * Invoice PDF rendering.
 *
 * Laid out with @react-pdf/renderer rather than hand-computed coordinates: the
 * flexbox engine wraps long text inside its column, sizes rows to their
 * content, and paginates on its own. The previous coordinate-based renderer
 * could not break an unbroken token (a part number or a URL), so such a
 * description printed straight across the RATE and AMOUNT columns.
 */

export type { InvoiceLine };

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
  /** PNG or JPEG bytes. Named for history; either format works. */
  logoPngBytes?: Uint8Array;
};

/**
 * Break words that have no natural break point. A part number or a URL has no
 * spaces, so without this the layout engine keeps it whole and lets it run
 * across the neighbouring columns — the exact defect this renderer replaced.
 *
 * Only genuinely long tokens are split. Returning chunks for a short word (say
 * "$175.00/hr") makes the engine drop the trailing piece, so the threshold sits
 * well above any rate or amount the invoice prints.
 */
const MAX_TOKEN = 24;

Font.registerHyphenationCallback((word) => {
  if (word.length <= MAX_TOKEN) return [word];
  const parts: string[] = [];
  for (let i = 0; i < word.length; i += MAX_TOKEN) {
    parts.push(word.slice(i, i + MAX_TOKEN));
  }
  return parts;
});

/** The shop's brand red. */
const RED = "#C90314";
const BLACK = "#000000";
const GREY = "#6B6B6B";
const SHADE = "#EFEFEF";
const HAIRLINE = "#C8C8C8";

/**
 * Filler rows keep a short invoice looking like a form rather than stopping
 * dead under the last entry. The count is budgeted against the space actually
 * left on the page: a description that wraps to two lines costs two rows'
 * worth of height, so counting entries instead of height overfills the sheet
 * and pushes the totals onto a second page.
 */
const ROWS_PER_PAGE = 11;

/** A description roughly this long wraps to another line in its column. */
const CHARS_PER_DESC_LINE = 46;

function rowsConsumed(description: string): number {
  return Math.max(1, Math.ceil(description.length / CHARS_PER_DESC_LINE));
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 48,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: BLACK,
    display: "flex",
    flexDirection: "column",
  },

  // Header ------------------------------------------------------------------
  header: { flexDirection: "row", justifyContent: "space-between" },
  logo: { width: 140, height: 62, objectFit: "contain" },
  headerRight: { alignItems: "flex-end", maxWidth: 300 },
  invoiceWord: {
    fontSize: 30,
    fontFamily: "Helvetica-Bold",
    color: RED,
    letterSpacing: 1,
    marginBottom: 10,
  },
  bizName: { fontFamily: "Helvetica-Bold", fontSize: 9.5, marginBottom: 2 },
  bizLine: { color: GREY, fontSize: 8.5, marginBottom: 1.5 },
  rule: { height: 2, backgroundColor: RED, marginTop: 10, marginBottom: 12 },

  // Meta grid ---------------------------------------------------------------
  metaRow: { flexDirection: "row", gap: 16 },
  metaCol: { flex: 1 },
  metaLine: {
    flexDirection: "row",
    borderBottomWidth: 0.6,
    borderColor: HAIRLINE,
    height: 21,
    alignItems: "center",
    overflow: "hidden",
  },
  metaLabel: {
    width: 88,
    alignSelf: "stretch",
    justifyContent: "center",
    backgroundColor: SHADE,
    paddingHorizontal: 7,
  },
  metaLabelText: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: GREY },
  metaValue: { flex: 1, paddingHorizontal: 9, paddingVertical: 5 },
  metaValueText: { fontSize: 8.5, maxLines: 1, textOverflow: "ellipsis" },

  // Line item table ---------------------------------------------------------
  table: { marginTop: 12, borderWidth: 0.6, borderColor: HAIRLINE },
  tHead: { flexDirection: "row", backgroundColor: BLACK },
  tHeadText: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    textAlign: "center",
  },
  tRow: {
    flexDirection: "row",
    borderTopWidth: 0.6,
    borderColor: HAIRLINE,
    minHeight: 26,
    alignItems: "center",
  },
  cQty: {
    width: 72,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRightWidth: 0.6,
    borderColor: HAIRLINE,
    alignSelf: "stretch",
    justifyContent: "center",
  },
  cDesc: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 7,
    borderRightWidth: 0.6,
    borderColor: HAIRLINE,
    alignSelf: "stretch",
    justifyContent: "center",
  },
  cRate: {
    width: 96,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRightWidth: 0.6,
    borderColor: HAIRLINE,
    alignSelf: "stretch",
    justifyContent: "center",
  },
  cTax: {
    width: 76,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRightWidth: 0.6,
    borderColor: HAIRLINE,
    alignSelf: "stretch",
    justifyContent: "center",
  },
  cAmount: {
    width: 96,
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignSelf: "stretch",
    justifyContent: "center",
  },
  cellCentre: { fontSize: 8.5, textAlign: "center" },
  cellText: { fontSize: 8.5 },

  // Foot: notes beside totals ----------------------------------------------
  foot: { flexDirection: "row", marginTop: 12, gap: 12 },
  notes: { flex: 1 },
  notesHead: { backgroundColor: SHADE, paddingVertical: 4, paddingHorizontal: 7 },
  notesHeadText: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: RED },
  notesBody: { paddingTop: 4 },
  notesLine: {
    borderBottomWidth: 0.6,
    borderColor: HAIRLINE,
    minHeight: 12,
    justifyContent: "flex-end",
    paddingBottom: 1,
  },
  notesText: { fontSize: 8 },

  totals: { width: 246 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3.5,
    paddingHorizontal: 10,
  },
  totalRowShaded: { backgroundColor: SHADE },
  totalLabel: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: GREY },
  totalValue: { fontSize: 9 },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: RED,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 4,
  },
  balanceLabel: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: "#FFFFFF" },
  balanceValue: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#FFFFFF" },

  // Footer ------------------------------------------------------------------
  // In normal flow, not absolutely positioned: an absolute footer sitting in
  // the page's bottom padding counts as overflow and forces an extra page.
  footer: { marginTop: "auto", paddingTop: 16, textAlign: "center" },
  thanks: {
    fontSize: 10.5,
    fontFamily: "Helvetica-Bold",
    color: RED,
    marginBottom: 5,
  },
  smallPrint: { fontSize: 7, color: GREY, lineHeight: 1.4 },
});

const FOOTER_SMALL_PRINT =
  `Make checks payable to ${LEGAL_NAME}. Customer is responsible for approved ` +
  "labor, materials, applicable taxes, and agreed travel or mobilization charges.";

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

/** Whole numbers print bare; part-hours keep their decimals. */
function formatQty(qty: number): string {
  return Number.isInteger(qty) ? String(qty) : String(qty);
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaLine}>
      <View style={styles.metaLabel}>
        <Text style={styles.metaLabelText}>{label}</Text>
      </View>
      <View style={styles.metaValue}>
        <Text style={styles.metaValueText}>{value}</Text>
      </View>
    </View>
  );
}

function InvoiceDocument({ input }: { input: InvoicePdfInput }) {
  const totals = computeInvoiceTotals({
    lines: input.lineItems,
    discountCents: input.discountCents,
    taxRateBasisPoints: input.taxRateBasisPoints,
    paymentsCents: input.paymentsCents,
  });

  const { customer } = input;
  const contactLine = [customer.phone, customer.email].filter(Boolean).join(" · ");

  const leftFields: Array<[string, string]> = [
    ["BILL TO", customer.company ?? customer.name],
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

  // Zeros print as $0.00, never -$0.00 — the paper form lists these rows even
  // when they are empty, so the reader can see nothing was left out.
  const signed = (cents: number) =>
    cents > 0 ? `-${formatMoney(cents)}` : formatMoney(0);

  const totalRows: Array<[string, string]> = [
    ["SUBTOTAL", formatMoney(totals.subtotalCents)],
    ["DISCOUNT", signed(totals.discountCents)],
    ["TAX RATE", formatPercent(input.taxRateBasisPoints)],
    ["SALES TAX", formatMoney(totals.taxCents)],
    ["PAYMENTS", signed(input.paymentsCents)],
  ];

  // Budget by height, not by entry count, and only fill the last page.
  const usedRows = input.lineItems.reduce(
    (sum, line) => sum + rowsConsumed(line.description),
    0,
  );
  const rowsOnLastPage =
    usedRows <= ROWS_PER_PAGE ? usedRows : usedRows % ROWS_PER_PAGE;
  const fillerCount = Math.max(0, ROWS_PER_PAGE - rowsOnLastPage);
  const noteLineCount = 6;
  const noteText = input.notes ?? "";

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header} fixed={false}>
          {input.logoPngBytes ? (
            /* react-pdf's Image is a PDF drawing primitive, not an HTML img:
               its props type has no alt, so the a11y rule does not apply. */
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image style={styles.logo} src={Buffer.from(input.logoPngBytes)} />
          ) : (
            <View style={styles.logo} />
          )}
          <View style={styles.headerRight}>
            <Text style={styles.invoiceWord}>INVOICE</Text>
            <Text style={styles.bizName}>{LEGAL_NAME}</Text>
            <Text style={styles.bizLine}>Eric Tidwell, Owner</Text>
            <Text style={styles.bizLine}>{PHONE_DISPLAY}</Text>
            <Text style={styles.bizLine}>{EMAIL}</Text>
            <Text style={styles.bizLine}>
              {SITE_URL.replace(/^https?:\/\//, "")}
            </Text>
          </View>
        </View>

        <View style={styles.rule} />

        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            {leftFields.map(([label, value]) => (
              <MetaLine key={label} label={label} value={value} />
            ))}
          </View>
          <View style={styles.metaCol}>
            {rightFields.map(([label, value]) => (
              <MetaLine key={label} label={label} value={value} />
            ))}
          </View>
        </View>

        <View style={styles.table}>
          {/* `fixed` repeats the head on every page react-pdf creates. */}
          <View style={styles.tHead} fixed>
            <View style={styles.cQty}>
              <Text style={styles.tHeadText}>QTY / HRS</Text>
            </View>
            <View style={styles.cDesc}>
              <Text style={styles.tHeadText}>DESCRIPTION OF WORK / MATERIALS</Text>
            </View>
            <View style={styles.cRate}>
              <Text style={styles.tHeadText}>RATE</Text>
            </View>
            <View style={styles.cTax}>
              <Text style={styles.tHeadText}>TAX</Text>
            </View>
            <View style={styles.cAmount}>
              <Text style={styles.tHeadText}>AMOUNT</Text>
            </View>
          </View>

          {input.lineItems.map((line, i) => (
            <View style={styles.tRow} key={`line-${i}`} wrap={false}>
              <View style={styles.cQty}>
                <Text style={styles.cellCentre}>{formatQty(line.qty)}</Text>
              </View>
              <View style={styles.cDesc}>
                <Text style={styles.cellText}>{line.description}</Text>
              </View>
              <View style={styles.cRate}>
                <Text style={styles.cellCentre}>
                  {formatRate(line.rateCents, line.unit)}
                </Text>
              </View>
              <View style={styles.cTax}>
                <Text style={styles.cellCentre}>{line.taxable ? "Yes" : "No"}</Text>
              </View>
              <View style={styles.cAmount}>
                <Text style={styles.cellCentre}>
                  {formatMoney(totals.lineAmountsCents[i])}
                </Text>
              </View>
            </View>
          ))}

          {Array.from({ length: fillerCount }, (_, i) => (
            <View style={styles.tRow} key={`filler-${i}`} wrap={false}>
              <View style={styles.cQty}>
                <Text style={styles.cellCentre}> </Text>
              </View>
              <View style={styles.cDesc}>
                <Text style={styles.cellText}> </Text>
              </View>
              <View style={styles.cRate}>
                <Text style={styles.cellCentre}> </Text>
              </View>
              <View style={styles.cTax}>
                <Text style={styles.cellCentre}> </Text>
              </View>
              <View style={styles.cAmount}>
                <Text style={styles.cellCentre}> </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.foot} wrap={false}>
          <View style={styles.notes}>
            <View style={styles.notesHead}>
              <Text style={styles.notesHeadText}>NOTES / WORK PERFORMED</Text>
            </View>
            <View style={styles.notesBody}>
              {Array.from({ length: noteLineCount }, (_, i) => (
                <View style={styles.notesLine} key={`note-${i}`}>
                  {i === 0 && noteText ? (
                    <Text style={styles.notesText}>{noteText}</Text>
                  ) : (
                    <Text style={styles.notesText}> </Text>
                  )}
                </View>
              ))}
            </View>
          </View>

          <View style={styles.totals}>
            {totalRows.map(([label, value], i) => (
              <View
                key={label}
                style={
                  i % 2 === 0
                    ? [styles.totalRow, styles.totalRowShaded]
                    : styles.totalRow
                }
              >
                <Text style={styles.totalLabel}>{label}</Text>
                <Text style={styles.totalValue}>{value}</Text>
              </View>
            ))}
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>BALANCE DUE</Text>
              <Text style={styles.balanceValue}>
                {formatMoney(totals.balanceCents)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.thanks}>Thank you for your business.</Text>
          <Text style={styles.smallPrint}>{FOOTER_SMALL_PRINT}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(
  input: InvoicePdfInput,
): Promise<Uint8Array> {
  const buffer = await renderToBuffer(<InvoiceDocument input={input} />);
  return new Uint8Array(buffer);
}
