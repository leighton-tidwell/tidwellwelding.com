/**
 * THROWAWAY: issue #10 spike. A text extractor that honours ToUnicode CMaps.
 *
 * convex/pdfText.ts decodes string operands as raw bytes, which is right for
 * react-pdf's standard-14 fonts. Chromium embeds subsetted TrueType fonts
 * whose codes are glyph ids, so the same approach yields mojibake. This reads
 * each page's /Font resources, parses their ToUnicode CMaps, and decodes text
 * runs with the CMap of the font in force — so the fidelity probes assert on
 * real text rather than on glyph numbers.
 *
 * Only what these benches need: 2-byte codes, bfchar and bfrange, Tf/Tj/TJ.
 */
import {
  decodePDFRawStream,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFRef,
} from "pdf-lib";

type CMap = Map<number, string>;

function utf16beToString(hex: string): string {
  let out = "";
  for (let i = 0; i + 3 < hex.length + 1; i += 4) {
    const unit = parseInt(hex.slice(i, i + 4), 16);
    if (Number.isNaN(unit)) break;
    out += String.fromCharCode(unit);
  }
  return out;
}

/** Parse the bfchar/bfrange sections of a ToUnicode CMap stream. */
function parseCMap(text: string): CMap {
  const map: CMap = new Map();

  for (const [, body] of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const [, code, value] of body.matchAll(
      /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g,
    )) {
      map.set(parseInt(code, 16), utf16beToString(value));
    }
  }

  for (const [, body] of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const [, lo, hi, value] of body.matchAll(
      /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g,
    )) {
      const start = parseInt(lo, 16);
      const end = parseInt(hi, 16);
      const base = utf16beToString(value);
      const baseLast = base.charCodeAt(base.length - 1);
      for (let c = start; c <= end && c - start < 65536; c += 1) {
        map.set(
          c,
          base.slice(0, -1) + String.fromCharCode(baseLast + (c - start)),
        );
      }
    }
  }

  return map;
}

function streamText(obj: unknown): string | undefined {
  if (!(obj instanceof PDFRawStream)) return undefined;
  try {
    return Buffer.from(decodePDFRawStream(obj).decode()).toString("latin1");
  } catch {
    return undefined;
  }
}

/** Resource font name (e.g. "F1") -> that font's ToUnicode CMap. */
function fontCMaps(pdf: PDFDocument, page: PDFDict): Map<string, CMap> {
  const out = new Map<string, CMap>();
  const resources = pdf.context.lookup(page.get(PDFName.of("Resources")));
  if (!(resources instanceof PDFDict)) return out;
  const fonts = pdf.context.lookup(resources.get(PDFName.of("Font")));
  if (!(fonts instanceof PDFDict)) return out;

  for (const [key, value] of fonts.entries()) {
    const font = pdf.context.lookup(value);
    if (!(font instanceof PDFDict)) continue;
    const toUnicode = font.get(PDFName.of("ToUnicode"));
    const resolved = pdf.context.lookup(
      toUnicode instanceof PDFRef ? toUnicode : toUnicode,
    );
    const text = streamText(resolved);
    if (text) out.set(key.asString().replace(/^\//, ""), parseCMap(text));
  }
  return out;
}

function decode(hex: string, cmap: CMap | undefined): string {
  let out = "";
  for (let i = 0; i + 1 < hex.length; i += 4) {
    const code = parseInt(hex.slice(i, i + 4), 16);
    if (Number.isNaN(code)) break;
    out += cmap?.get(code) ?? "";
  }
  return out;
}

/**
 * One page's runs with all whitespace removed.
 *
 * Chromium positions each glyph individually at pt sizes, so a run is often a
 * single character and drawn spaces may be absent entirely. Squashing both the
 * haystack and the needle makes a presence check independent of how the engine
 * chose to chunk and position the text. Use `squash` on the needle too.
 */
export function pageText(runs: string[]): string {
  return runs.join("").replace(/\s+/g, "");
}

/** Normalise a needle the same way `pageText` normalises the haystack. */
export function squash(text: string): string {
  return text.replace(/\s+/g, "");
}

/** Text runs per page, decoded through each run's font CMap. */
export async function extractRunsByPage(
  bytes: Uint8Array,
): Promise<string[][]> {
  const pdf = await PDFDocument.load(bytes);
  const pages: string[][] = [];

  for (const page of pdf.getPages()) {
    const dict = page.node;
    const cmaps = fontCMaps(pdf, dict);
    const contents = pdf.context.lookup(dict.get(PDFName.of("Contents")));
    const text = streamText(contents) ?? "";

    const runs: string[] = [];
    let current: CMap | undefined;
    // Walk Tf / Tj / TJ in order so the font in force is known per run.
    const token =
      /\/([A-Za-z0-9+.-]+)\s+[\d.]+\s+Tf|\[([^\]]*)\]\s*TJ|<([0-9A-Fa-f]*)>\s*Tj/g;
    for (const m of text.matchAll(token)) {
      const [, fontName, tjArray, tjHex] = m;
      if (fontName !== undefined) {
        current = cmaps.get(fontName);
        continue;
      }
      let run = "";
      if (tjArray !== undefined) {
        for (const [, hex] of tjArray.matchAll(/<([0-9A-Fa-f]*)>/g)) {
          run += decode(hex, current);
        }
      } else if (tjHex !== undefined) {
        run = decode(tjHex, current);
      }
      if (run.trim()) runs.push(run);
    }
    pages.push(runs);
  }

  return pages;
}

/** All text, whitespace collapsed. */
export async function extractTextCmap(bytes: Uint8Array): Promise<string> {
  const pages = await extractRunsByPage(bytes);
  return pageText(pages.flat());
}
