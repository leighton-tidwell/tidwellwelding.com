"use node";

import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { LEGAL_NAME } from "../src/lib/business";
import { formatPhone } from "./emailTemplates";
import {
  computeInvoiceTotals,
  formatMoney,
  formatRate,
  type InvoiceLine,
  lineAmountCents,
} from "./invoiceMath";
import {
  base,
  cell,
  emailLinesFor,
  formatDate,
  GREY,
  Letterhead,
  MetaLine,
  type MetaValue,
  NoteLines,
  RED,
  renderWithFiller,
  SHADE,
} from "./pdfLayout";

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
  /**
   * Blank rows drawn under the last entry. Resolved by measurement in
   * renderInvoicePdf rather than set by callers.
   */
  fillerRows?: number;
  /** Skip filler entirely. Used to measure the document's natural length. */
  suppressFillerRows?: boolean;
};

const styles = StyleSheet.create({
  cQty: cell(72),
  cDesc: cell(),
  cRate: cell(96),
  cTax: cell(76),
  cAmount: cell(96, true),

  // Foot: notes beside totals ----------------------------------------------
  foot: { flexDirection: "row", marginTop: 12, gap: 12 },
  notes: { flex: 1 },

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
  balanceLabel: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
  },
  balanceValue: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
  },
});

const FOOTER_SMALL_PRINT =
  `Make checks payable to ${LEGAL_NAME}. Customer is responsible for approved ` +
  "labor, materials, applicable taxes, and agreed travel or mobilization charges.";

function formatPercent(basisPoints: number): string {
  return `${(basisPoints / 100).toFixed(2).replace(/\.00$/, "")}%`;
}

/** Whole numbers print bare; part-hours keep their decimals. */
function formatQty(qty: number): string {
  return Number.isInteger(qty) ? String(qty) : String(qty);
}

function InvoiceDocument({ input }: { input: InvoicePdfInput }) {
  const totals = computeInvoiceTotals({
    lines: input.lineItems,
    discountCents: input.discountCents,
    taxRateBasisPoints: input.taxRateBasisPoints,
    paymentsCents: input.paymentsCents,
  });

  const { customer } = input;
  const emailLines = emailLinesFor(customer.email);

  const leftFields: Array<[string, MetaValue]> = [
    ["BILL TO", customer.company ?? customer.name],
    // Blank rather than echoing the company: this row names a person, and
    // repeating the business name reads as a data-entry mistake.
    ["CONTACT", customer.contact ?? ""],
    ["PHONE", customer.phone ? formatPhone(customer.phone) : ""],
    ["EMAIL", emailLines],
  ];
  const rightFields: Array<[string, string]> = [
    ["INVOICE #", input.number],
    ["DATE", formatDate(input.issuedAt)],
    ["JOB / PO #", input.jobPo ?? ""],
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

  const fillerCount = input.fillerRows ?? 0;
  const noteLineCount = 5;
  const noteText = input.notes ?? "";

  return (
    <Document>
      <Page size="LETTER" style={base.page}>
        <Letterhead title="INVOICE" logoPngBytes={input.logoPngBytes} />

        {/* Paired by row, not by column, so a taller left cell (two contact
            lines) stretches its right-hand neighbour and the rules line up. */}
        <View>
          {leftFields.map(([label, value], i) => {
            const right = rightFields[i];
            return (
              <View key={label} style={base.metaRow}>
                <MetaLine label={label} value={value} />
                {right && <MetaLine label={right[0]} value={right[1]} />}
              </View>
            );
          })}
          <View style={base.metaRow}>
            <MetaLine label="ADDRESS" value={customer.address ?? ""} />
          </View>
        </View>

        <View style={base.table}>
          {/* `fixed` repeats the head on every page react-pdf creates. */}
          <View style={base.tHead} fixed>
            <View style={styles.cQty}>
              <Text style={base.tHeadText}>QTY / HRS</Text>
            </View>
            <View style={styles.cDesc}>
              <Text style={base.tHeadText}>
                DESCRIPTION OF WORK / MATERIALS
              </Text>
            </View>
            <View style={styles.cRate}>
              <Text style={base.tHeadText}>RATE</Text>
            </View>
            <View style={styles.cTax}>
              <Text style={base.tHeadText}>TAX</Text>
            </View>
            <View style={styles.cAmount}>
              <Text style={base.tHeadText}>AMOUNT</Text>
            </View>
          </View>

          {input.lineItems.map((line, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static PDF render, rows never reorder.
            <View style={base.tRow} key={`line-${i}`} wrap={false}>
              <View style={styles.cQty}>
                <Text style={base.cellCentre}>{formatQty(line.qty)}</Text>
              </View>
              <View style={styles.cDesc}>
                <Text style={base.cellText}>{line.description}</Text>
              </View>
              <View style={styles.cRate}>
                <Text style={base.cellCentre}>
                  {formatRate(line.rateCents, line.unit)}
                </Text>
              </View>
              <View style={styles.cTax}>
                <Text style={base.cellCentre}>
                  {line.taxable ? "Yes" : "No"}
                </Text>
              </View>
              <View style={styles.cAmount}>
                <Text style={base.cellCentre}>
                  {formatMoney(lineAmountCents(line))}
                </Text>
              </View>
            </View>
          ))}

          {Array.from({ length: fillerCount }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: blank filler rows; position is the identity.
            <View style={base.tRow} key={`filler-${i}`} wrap={false}>
              <View style={styles.cQty}>
                <Text style={base.cellCentre}> </Text>
              </View>
              <View style={styles.cDesc}>
                <Text style={base.cellText}> </Text>
              </View>
              <View style={styles.cRate}>
                <Text style={base.cellCentre}> </Text>
              </View>
              <View style={styles.cTax}>
                <Text style={base.cellCentre}> </Text>
              </View>
              <View style={styles.cAmount}>
                <Text style={base.cellCentre}> </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.foot} wrap={false}>
          <View style={styles.notes}>
            <View style={base.notesHead}>
              <Text style={base.notesHeadText}>NOTES / WORK PERFORMED</Text>
            </View>
            <NoteLines text={noteText} lines={noteLineCount} />
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

        <View style={base.footer}>
          <Text style={base.thanks}>Thank you for your business.</Text>
          <Text style={base.smallPrint}>{FOOTER_SMALL_PRINT}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(
  input: InvoicePdfInput,
): Promise<Uint8Array> {
  return renderWithFiller(
    (fillerRows) => <InvoiceDocument input={{ ...input, fillerRows }} />,
    { fillerRows: input.fillerRows, suppress: input.suppressFillerRows },
  );
}
