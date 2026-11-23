// How a note is laid onto the ruled lines of a shop document. Pure, with no
// Convex or react-pdf imports: the admin editor loads this file too, so the
// box Eric types into counts and cuts off lines exactly as the PDF prints them.
//
// The PDF draws each wrapped line as its own text on its own rule. Leaving the
// wrapping to the layout engine is what put a whole note on the first rule and
// let it grow past the others.

/** A notes box: how many ruled lines it has and how wide each one is. */
export type NoteBox = {
  lines: number;
  /** Line width in PDF points. */
  width: number;
};

// A LETTER page is 612pt wide with 48pt side padding (pdfLayout `base.page`),
// which leaves 516pt. The invoice gives 246pt of that to the totals block and
// 12pt to the gap beside it.
export const INVOICE_NOTES: NoteBox = { lines: 5, width: 258 };
export const PACKING_SLIP_NOTES: NoteBox = { lines: 3, width: 516 };

/** Point size the notes print at (pdfLayout `base.notesText`). */
const FONT_SIZE = 8;

/**
 * Slack kept at the end of every line, in points. The renderer kerns some
 * letter pairs, so its measure of a line can differ slightly from the sum of
 * advance widths used here.
 */
const SLACK = 4;

/**
 * Helvetica advance widths for the printable ASCII range, space (32) through
 * tilde (126), in 1/1000 em. From Adobe's Helvetica.afm, the metrics react-pdf
 * uses for its built-in Helvetica.
 */
// biome-ignore format: one row per sixteen code points reads as a table.
const ASCII_WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

/** Punctuation a phone keyboard substitutes for the ASCII form. */
const OTHER_WIDTHS: Record<string, number> = {
  "‘": 222,
  "’": 222,
  "“": 333,
  "”": 333,
  "–": 556,
  "—": 1000,
  "…": 1000,
  "°": 400,
};

/** Assumed for any other character: as wide as Helvetica's widest glyphs. */
const UNKNOWN_WIDTH = 1000;

function widthOf(text: string, fontSize: number): number {
  let units = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    units += ASCII_WIDTHS[code - 32] ?? OTHER_WIDTHS[char] ?? UNKNOWN_WIDTH;
  }
  return (units * fontSize) / 1000;
}

/**
 * Fill each line with as many pieces as fit, joined by `gap`. A piece too long
 * for a line of its own is split across as many as it needs.
 */
function pack(
  pieces: string[],
  gap: string,
  width: number,
  fontSize: number,
): string[] {
  const fits = (text: string) => widthOf(text, fontSize) <= width - SLACK;
  const out: string[] = [];
  let line = "";
  for (const piece of pieces) {
    const joined = line ? line + gap + piece : piece;
    if (fits(joined)) {
      line = joined;
      continue;
    }
    if (line) out.push(line);
    line = "";
    for (const char of piece) {
      if (line && !fits(line + char)) {
        out.push(line);
        line = "";
      }
      line += char;
    }
  }
  out.push(line);
  return out;
}

/**
 * Break a note into printed lines no wider than `width` points. A newline the
 * writer typed always starts a new line.
 */
export function wrapNote(text: string, width: number): string[] {
  if (text === "") return [];
  return text
    .split("\n")
    .flatMap((paragraph) =>
      pack(paragraph.split(/\s+/).filter(Boolean), " ", width, FONT_SIZE),
    );
}

/**
 * Break an email address too wide for its cell. Each line takes as much of the
 * address as fits and ends at a natural seam, after the "@" or before a ".",
 * so the short name before the "@" is not left on a line by itself.
 */
export function wrapEmail(
  email: string,
  width: number,
  fontSize: number,
): string[] {
  if (email === "") return [];
  return pack(email.split(/(?<=@)|(?=\.)/), "", width, fontSize);
}

/**
 * Drop what the PDF's Helvetica cannot draw: emoji, symbols and non-Latin
 * scripts. The renderer prints those as stray marks over the neighbouring
 * letters, so the editor takes them out as they are typed.
 */
export function printableNote(text: string): string {
  return text
    .replace(/\t/g, " ")
    .replace(/[^\n\x20-\x7E\xA1-\xFF‘’“”–—…]/gu, "");
}

/** Whether the note fits on the box's ruled lines. */
export function noteFits(text: string, box: NoteBox): boolean {
  return wrapNote(text, box.width).length <= box.lines;
}

/** Refuse a note that would not fit: the server's side of the editor's limit. */
export function assertNoteFits(
  text: string | undefined,
  box: NoteBox,
  document: string,
): void {
  if (text !== undefined && !noteFits(text, box)) {
    throw new Error(`Notes must fit the lines printed on the ${document}`);
  }
}

/** The longest leading part of the note that fits the box. */
export function clipNote(text: string, box: NoteBox): string {
  if (noteFits(text, box)) return text;
  // Fitting is monotone in length: dropping characters from the end never
  // adds a line. So the longest fitting prefix can be bisected.
  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (noteFits(text.slice(0, mid), box)) low = mid;
    else high = mid - 1;
  }
  return text.slice(0, low);
}
