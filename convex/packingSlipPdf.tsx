"use node";

import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { PHONE_DISPLAY } from "../src/lib/business";
import { formatPhone } from "./emailTemplates";
import {
  base,
  cell,
  formatDate,
  HAIRLINE,
  Letterhead,
  MetaLine,
  NoteLines,
  renderWithFiller,
} from "./pdfLayout";

export type PackingSlipLine = {
  partNumber: string;
  description: string;
  qty: number;
  unit: string;
};

export type PackingSlipPdfInput = {
  number: string;
  shippedAt: number;
  customer: { name: string; contact?: string; phone?: string };
  shipToName: string;
  shipToAddress?: string;
  poNumber?: string;
  jobProject?: string;
  shippedVia?: string;
  tracking?: string;
  packages?: string;
  lineItems: PackingSlipLine[];
  notes?: string;
  logoPngBytes?: Uint8Array;
  /** Blank rows under the last line; resolved by measurement when unset. */
  fillerRows?: number;
};

const styles = StyleSheet.create({
  cItem: cell(36),
  cPart: cell(110),
  cDesc: cell(),
  cQty: cell(60),
  cUnit: cell(60, true),

  foot: { marginTop: 12 },
  signRow: { flexDirection: "row", gap: 16, marginTop: 22 },
  signLine: {
    borderBottomWidth: 0.6,
    borderColor: HAIRLINE,
    height: 22,
  },
  signLabel: { fontSize: 6.5, fontFamily: "Helvetica-Bold", marginTop: 3 },
});

function contactLine(customer: PackingSlipPdfInput["customer"]): string {
  return [customer.contact, customer.phone && formatPhone(customer.phone)]
    .filter(Boolean)
    .join(" · ");
}

function PackingSlipDocument({ input }: { input: PackingSlipPdfInput }) {
  const rows: Array<[[string, string], [string, string]]> = [
    [
      ["CUSTOMER", input.customer.name],
      ["PACKING SLIP #", input.number],
    ],
    [
      ["SHIP TO", input.shipToName],
      ["SHIP DATE", formatDate(input.shippedAt)],
    ],
    [
      ["CONTACT", contactLine(input.customer)],
      ["PO #", input.poNumber ?? ""],
    ],
    [
      ["SHIPPED VIA", input.shippedVia ?? ""],
      ["JOB / PROJECT #", input.jobProject ?? ""],
    ],
    [
      ["TRACKING / BOL #", input.tracking ?? ""],
      ["TOTAL PACKAGES", input.packages ?? ""],
    ],
  ];
  const fillerCount = input.fillerRows ?? 0;

  return (
    <Document>
      <Page size="LETTER" style={base.page}>
        <Letterhead title="PACKING SLIP" logoPngBytes={input.logoPngBytes} />

        <View>
          {rows.map(([left, right]) => (
            <View key={left[0]} style={base.metaRow}>
              <MetaLine label={left[0]} value={left[1]} />
              <MetaLine label={right[0]} value={right[1]} />
            </View>
          ))}
          <View style={base.metaRow}>
            <MetaLine label="DELIVER TO" value={input.shipToAddress ?? ""} />
          </View>
        </View>

        <View style={base.table}>
          <View style={base.tHead} fixed>
            {(
              [
                [styles.cItem, "ITEM"],
                [styles.cPart, "PART / STOCK #"],
                [styles.cDesc, "DESCRIPTION"],
                [styles.cQty, "QTY"],
                [styles.cUnit, "UOM"],
              ] as const
            ).map(([style, label]) => (
              <View key={label} style={style}>
                <Text style={base.tHeadText}>{label}</Text>
              </View>
            ))}
          </View>

          {[
            ...input.lineItems,
            ...Array.from({ length: fillerCount }, () => null),
          ].map((line, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static PDF render, rows never reorder.
            <View style={base.tRow} key={`line-${i}`} wrap={false}>
              <View style={styles.cItem}>
                <Text style={base.cellCentre}>{line ? i + 1 : " "}</Text>
              </View>
              <View style={styles.cPart}>
                <Text style={base.cellText}>{line?.partNumber || " "}</Text>
              </View>
              <View style={styles.cDesc}>
                <Text style={base.cellText}>{line?.description || " "}</Text>
              </View>
              <View style={styles.cQty}>
                <Text style={base.cellCentre}>{line ? line.qty : " "}</Text>
              </View>
              <View style={styles.cUnit}>
                <Text style={base.cellCentre}>{line?.unit || " "}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.foot} wrap={false}>
          <View style={base.notesHead}>
            <Text style={base.notesHeadText}>NOTES / INSTRUCTIONS</Text>
          </View>
          <NoteLines text={input.notes ?? ""} lines={3} />

          <View style={styles.signRow}>
            <View style={{ flex: 2 }}>
              <View style={styles.signLine} />
              <Text style={styles.signLabel}>RECEIVED BY</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.signLine} />
              <Text style={styles.signLabel}>DATE</Text>
            </View>
          </View>
        </View>

        <View style={base.footer}>
          <Text style={base.thanks}>Thank you for your business.</Text>
          <Text style={base.smallPrint}>
            {`Questions about this shipment? Call ${PHONE_DISPLAY}.`}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderPackingSlipPdf(
  input: PackingSlipPdfInput,
): Promise<Uint8Array> {
  return renderWithFiller(
    (fillerRows) => <PackingSlipDocument input={{ ...input, fillerRows }} />,
    { fillerRows: input.fillerRows },
  );
}
