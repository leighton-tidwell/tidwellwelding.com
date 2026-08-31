import { PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";

/**
 * Pull the visible text out of a rendered PDF.
 *
 * Tests that assert on a layout module's own draw-op list only prove the module
 * agrees with itself. Reading the bytes back means a test fails when the actual
 * document is wrong, which is the thing that matters.
 *
 * Content streams are located through pdf-lib rather than by scanning for the
 * `stream` keyword, so compressed object streams are handled correctly.
 */

function contentStreams(pdf: PDFDocument): string[] {
  const out: string[] = [];
  for (const [, obj] of pdf.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    try {
      const decoded = decodePDFRawStream(obj).decode();
      out.push(Buffer.from(decoded).toString("latin1"));
    } catch {
      // Image and font streams are not text; skip anything that will not
      // decode rather than failing the whole extraction.
    }
  }
  return out;
}

/** `<48656c6c6f>` -> "Hello". Standard fonts encode bytes directly. */
function hexToString(hex: string): string {
  let out = "";
  for (let i = 0; i + 1 < hex.length; i += 2) {
    out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  }
  return out;
}

/** Undo PDF string escapes inside a literal `( ... )` operand. */
function unescapeLiteral(body: string): string {
  return body.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_, code: string) => {
    switch (code) {
      case "n":
        return "\n";
      case "r":
        return "\r";
      case "t":
        return "\t";
      case "b":
        return "\b";
      case "f":
        return "\f";
      case "(":
        return "(";
      case ")":
        return ")";
      case "\\":
        return "\\";
      default:
        return String.fromCharCode(parseInt(code, 8));
    }
  });
}

/**
 * Every text run in the document, in draw order. Each entry is one show
 * operation, so a wrapped line arrives as its own entry — which is what lets a
 * test assert that no single run is wide enough to overflow its column.
 */
export async function extractTextRuns(bytes: Uint8Array): Promise<string[]> {
  const pdf = await PDFDocument.load(bytes);
  const runs: string[] = [];

  for (const stream of contentStreams(pdf)) {
    if (!/T[jJ]/.test(stream)) continue;

    // TJ takes an array mixing strings and kerning numbers.
    for (const [, body] of stream.matchAll(/\[([^\]]*)\]\s*TJ/g)) {
      let run = "";
      for (const [, hex, literal] of body.matchAll(
        /<([0-9A-Fa-f]*)>|\(((?:[^()\\]|\\.)*)\)/g,
      )) {
        run += hex !== undefined ? hexToString(hex) : unescapeLiteral(literal);
      }
      if (run.trim()) runs.push(run);
    }

    // Tj takes a single string.
    for (const [, hex, literal] of stream.matchAll(
      /(?:<([0-9A-Fa-f]*)>|\(((?:[^()\\]|\\.)*)\))\s*Tj/g,
    )) {
      const run = hex !== undefined ? hexToString(hex) : unescapeLiteral(literal);
      if (run.trim()) runs.push(run);
    }
  }

  return runs;
}

/** All the document's text as one string, whitespace collapsed. */
export async function extractText(bytes: Uint8Array): Promise<string> {
  const runs = await extractTextRuns(bytes);
  return runs.join(" ").replace(/\s+/g, " ").trim();
}

/** How many pages the document has. */
export async function countPages(bytes: Uint8Array): Promise<number> {
  const pdf = await PDFDocument.load(bytes);
  return pdf.getPageCount();
}
