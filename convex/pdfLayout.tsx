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

/**
 * About as many characters as fit on one line of a meta cell. A longer email
 * wraps at its "@" instead of mid-word, where the engine would add a hyphen
 * that reads as part of the address.
 */
const CONTACT_LINE_CHARS = 32;

const keepContactWhole = (word: string) =>
  word.length <= CONTACT_LINE_CHARS
    ? [word]
    : (word.match(new RegExp(`.{1,${CONTACT_LINE_CHARS}}`, "g")) ?? [word]);

export function emailLinesFor(email?: string): string[] {
  if (!email) return [];
  const at = email.indexOf("@");
  if (email.length <= CONTACT_LINE_CHARS || at <= 0) return [email];
  return [email.slice(0, at), email.slice(at)];
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
  metaValueFull: { fontSize: 8.5 },

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

/** Ruled lines with the note text on the first. */
export function NoteLines({ text, lines }: { text: string; lines: number }) {
  return (
    <View style={base.notesBody}>
      {Array.from({ length: lines }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed ruled lines; position is the identity.
        <View style={base.notesLine} key={`note-${i}`}>
          {i === 0 && text ? (
            <Text style={base.notesText}>{text}</Text>
          ) : (
            <Text style={base.notesText}> </Text>
          )}
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
