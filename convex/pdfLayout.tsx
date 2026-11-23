"use node";

import {
  Font,
  Image,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { ReactElement } from "react";
import {
  EMAIL,
  LEGAL_NAME,
  LOCALITY,
  PHONE_DISPLAY,
  POSTAL_CODE,
  REGION,
  SITE_URL,
  STREET_ADDRESS,
} from "../src/lib/business";
import { type NoteBox, printableNote, wrapEmail, wrapNote } from "./noteLines";

/**
 * The parts every shop document shares: the letterhead, the labelled meta grid,
 * the table and footer styling, and the filler-row fitting. The invoice and the
 * packing slip both build on these so the two never drift apart.
 */

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
export const RED = "#C90314";
export const BLACK = "#000000";
export const GREY = "#6B6B6B";
export const SHADE = "#EFEFEF";
export const HAIRLINE = "#C8C8C8";

/**
 * Upper bound on filler rows to try. Anything past a full sheet is pointless.
 */
const MAX_FILLER_ROWS = 12;

/** Point size of a value in the meta grid (`base.metaValueFull`). */
const META_FONT_SIZE = 8.5;

/**
 * Width of a meta value's text in points: half the 516pt page less the 16pt
 * gap between the columns, less the 88pt label and 9pt padding on each side.
 */
const META_VALUE_WIDTH = 144;

/**
 * The contact lines are already broken to fit, so the engine is told every
 * word is whole. Left to hyphenate, it adds a "-" that reads as part of the
 * address.
 */
const keepContactWhole = (word: string) => [word];

/** The customer's email on as few lines as the cell allows. */
export function emailLinesFor(email?: string): string[] {
  return wrapEmail(email ?? "", META_VALUE_WIDTH, META_FONT_SIZE);
}

export const base = StyleSheet.create({
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
  titleWord: {
    fontSize: 30,
    fontFamily: "Helvetica-Bold",
    color: RED,
    letterSpacing: 1,
    marginBottom: 10,
  },
  bizName: { fontFamily: "Helvetica-Bold", fontSize: 9.5, marginBottom: 2 },
  bizLine: { color: GREY, fontSize: 8.5, marginBottom: 1.5 },
  rule: { height: 2, backgroundColor: RED, marginTop: 8, marginBottom: 8 },

  // Meta grid ---------------------------------------------------------------
  metaRow: { flexDirection: "row", gap: 16 },
  metaLine: {
    flex: 1,
    flexDirection: "row",
    borderBottomWidth: 0.6,
    borderColor: HAIRLINE,
    minHeight: 19,
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
  metaValue: { flex: 1, paddingHorizontal: 9, paddingVertical: 3 },
  metaValueText: { fontSize: 8.5, maxLines: 1, textOverflow: "ellipsis" },
  // Phone and email each get their own line and never truncate: a cut-off
  // email address is useless on an invoice.
  metaValueFull: { fontSize: META_FONT_SIZE },

  // Table -------------------------------------------------------------------
  table: { marginTop: 10, borderWidth: 0.6, borderColor: HAIRLINE },
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
  cellCentre: { fontSize: 8.5, textAlign: "center" },
  cellText: { fontSize: 8.5 },

  // Notes -------------------------------------------------------------------
  notesHead: {
    backgroundColor: SHADE,
    paddingVertical: 4,
    paddingHorizontal: 7,
  },
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

  // Footer ------------------------------------------------------------------
  // In normal flow, not absolutely positioned: an absolute footer sitting in
  // the page's bottom padding counts as overflow and forces an extra page.
  footer: { marginTop: "auto", paddingTop: 10, textAlign: "center" },
  thanks: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: RED,
    marginBottom: 3,
  },
  smallPrint: { fontSize: 6.5, color: GREY, lineHeight: 1.3 },
});

/** A table cell: fixed width, or flex when no width is given. */
export function cell(width?: number, last = false) {
  return {
    ...(width === undefined ? { flex: 1 } : { width }),
    paddingVertical: 6,
    paddingHorizontal: width === undefined ? 7 : 4,
    ...(last ? {} : { borderRightWidth: 0.6, borderColor: HAIRLINE }),
    alignSelf: "stretch" as const,
    justifyContent: "center" as const,
  };
}

export function formatDate(ms: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(ms));
}

/** A string is one truncated line; an array prints every entry in full. */
export type MetaValue = string | string[];

export function MetaLine({
  label,
  value,
}: {
  label: string;
  value: MetaValue;
}) {
  return (
    <View style={base.metaLine}>
      <View style={base.metaLabel}>
        <Text style={base.metaLabelText}>{label}</Text>
      </View>
      <View style={base.metaValue}>
        {typeof value === "string" ? (
          <Text style={base.metaValueText}>{value}</Text>
        ) : (
          value.map((line) => (
            <Text
              key={line}
              style={base.metaValueFull}
              hyphenationCallback={keepContactWhole}
            >
              {line}
            </Text>
          ))
        )}
      </View>
    </View>
  );
}

/** Logo on the left; document title and the shop's details on the right. */
export function Letterhead({
  title,
  logoPngBytes,
}: {
  title: string;
  logoPngBytes?: Uint8Array;
}) {
  return (
    <>
      <View style={base.header} fixed={false}>
        {logoPngBytes ? (
          <Image style={base.logo} src={Buffer.from(logoPngBytes)} />
        ) : (
          <View style={base.logo} />
        )}
        <View style={base.headerRight}>
          <Text style={base.titleWord}>{title}</Text>
          <Text style={base.bizName}>{LEGAL_NAME}</Text>
          <Text style={base.bizLine}>Eric Tidwell, Owner</Text>
          <Text style={base.bizLine}>
            {`${STREET_ADDRESS} · ${LOCALITY}, ${REGION} ${POSTAL_CODE}`}
          </Text>
          <Text style={base.bizLine}>{PHONE_DISPLAY}</Text>
          <Text style={base.bizLine}>{EMAIL}</Text>
          <Text style={base.bizLine}>
            {SITE_URL.replace(/^https?:\/\//, "")}
          </Text>
        </View>
      </View>
      <View style={base.rule} />
    </>
  );
}

/**
 * The note on ruled lines, one printed line per rule. The text is wrapped here
 * rather than by the layout engine so no rule ever holds more than one line.
 * A note longer than the box (one saved before the editor enforced the fit)
 * gets extra rules rather than losing its end.
 */
export function NoteLines({ text, box }: { text: string; box: NoteBox }) {
  const wrapped = wrapNote(printableNote(text), box.width);
  const count = Math.max(box.lines, wrapped.length);
  return (
    <View style={[base.notesBody, { width: box.width }]}>
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed ruled lines; position is the identity.
        <View style={base.notesLine} key={`note-${i}`}>
          <Text style={base.notesText}>{wrapped[i] || " "}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Pages in a rendered document. react-pdf writes an uncompressed page tree, so
 * the /Count entry is readable without pulling in a PDF parser.
 */
function pageCountOf(bytes: Uint8Array): number {
  const text = Buffer.from(bytes).toString("latin1");
  let max = 0;
  for (const [, count] of text.matchAll(/\/Count\s+(\d+)/g)) {
    max = Math.max(max, Number(count));
  }
  return max || 1;
}

/** Render once and report how many pages the document needs. */
async function renderPages(doc: ReactElement): Promise<{
  bytes: Uint8Array;
  pages: number;
}> {
  // biome-ignore lint/suspicious/noExplicitAny: renderToBuffer wants a <Document> element type that a generic ReactElement does not carry.
  const buffer = await renderToBuffer(doc as any);
  const bytes = new Uint8Array(buffer);
  return { bytes, pages: pageCountOf(bytes) };
}

/**
 * Render with as many blank filler rows as fit without adding a page, so a
 * short document still reads as a full form. `fillerRows` set by the caller
 * renders exactly that many; `suppress` renders none.
 */
export async function renderWithFiller(
  docFor: (fillerRows: number) => ReactElement,
  { fillerRows, suppress }: { fillerRows?: number; suppress?: boolean } = {},
): Promise<Uint8Array> {
  // An explicit count means the caller is measuring; render exactly that.
  if (fillerRows !== undefined) {
    return (await renderPages(docFor(fillerRows))).bytes;
  }

  // Measure the document's natural length first. Guessing row heights from
  // character counts is what previously padded an invoice with blank rows
  // until the totals were pushed onto a second, nearly empty page.
  const bare = await renderPages(docFor(0));
  if (suppress) return bare.bytes;

  // Then take the most filler that still fits in that many pages. Each step is
  // a real render, so the answer accounts for wrapping, long descriptions and
  // every other thing an estimate gets wrong.
  //
  // Page count is monotone non-decreasing in the filler count: a blank row can
  // only push later content further down the document, never pull it back. So
  // the counts that fit form a prefix of 0..MAX_FILLER_ROWS and the largest one
  // can be found without rendering every count in between.
  //
  // Probe the maximum first. On any document whose lines already fill a page,
  // no filler count adds a page, so that settles it in one extra render -- the
  // case that used to cost all MAX_FILLER_ROWS renders. Only when the maximum
  // does spill do we bisect the range below it for the boundary.
  const maxFiller = await renderPages(docFor(MAX_FILLER_ROWS));
  if (maxFiller.pages <= bare.pages) return maxFiller.bytes;

  let best = bare;
  let low = 1;
  let high = MAX_FILLER_ROWS - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = await renderPages(docFor(mid));
    if (candidate.pages > bare.pages) {
      high = mid - 1;
    } else {
      best = candidate;
      low = mid + 1;
    }
  }

  return best.bytes;
}
