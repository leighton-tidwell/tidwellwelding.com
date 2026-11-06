/**
 * THROWAWAY: issue #10 spike. Prints bench/htmlInvoice.ts with local Chromium
 * through Playwright (already a devDependency).
 *
 * Playwright's page.pdf() IS Chromium's print-to-PDF — the same engine
 * Cloudflare Browser Rendering runs server side. So every layout behaviour
 * verified here (repeated <thead>, break-inside, overflow-wrap, @page letter)
 * is the behaviour the hosted path would produce. The transport differs; the
 * layout engine does not. See bench/cloudflareRenderer.ts for the hosted leg.
 */
import { type Browser, chromium, type Page } from "@playwright/test";
import type { InvoicePdfInput } from "../convex/invoicePdf";
import { invoiceHtml } from "./htmlInvoice";

const MAX_FILLER_ROWS = 12;

let browser: Browser | undefined;
let page: Page | undefined;

/** Launch once; a per-render launch would dominate every measurement. */
export async function warmChromium(): Promise<void> {
  if (!browser) browser = await chromium.launch();
  if (!page) page = await browser.newPage();
}

export async function closeChromium(): Promise<void> {
  await page?.close();
  await browser?.close();
  page = undefined;
  browser = undefined;
}

const PDF_OPTIONS = {
  printBackground: true,
  preferCSSPageSize: true,
} as const;

/** Cheap page count: Chromium writes a readable /Count in the page tree. */
function pageCountOf(bytes: Uint8Array): number {
  const text = Buffer.from(bytes).toString("latin1");
  let max = 0;
  for (const [, count] of text.matchAll(/\/Count\s+(\d+)/g)) {
    max = Math.max(max, Number(count));
  }
  return max || 1;
}

/** Set the filler row count in the loaded document, without reloading it. */
async function setFillerRows(p: Page, rows: number): Promise<void> {
  await p.evaluate((count) => {
    const body = document.getElementById("rows");
    if (!body) return;
    for (const stale of body.querySelectorAll("tr.filler")) stale.remove();
    const columns = 5;
    for (let i = 0; i < count; i += 1) {
      const tr = document.createElement("tr");
      tr.className = "filler";
      for (let c = 0; c < columns; c += 1)
        tr.appendChild(document.createElement("td"));
      body.appendChild(tr);
    }
  }, rows);
}

export type ChromiumRenderResult = {
  bytes: Uint8Array;
  pages: number;
  prints: number;
  fillerRows: number;
};

/**
 * Loads the document once, then resolves filler rows by reprinting the already
 * loaded page — a print, not a re-render of the whole pipeline. Probe the
 * maximum first, bisect only if it does not fit (page count is monotone
 * non-decreasing in filler rows).
 */
export async function renderInvoiceChromium(
  input: InvoicePdfInput,
  options: { fillerRows?: number } = {},
): Promise<ChromiumRenderResult> {
  await warmChromium();
  if (!page) throw new Error("Chromium page unavailable");
  const p = page;

  await p.setContent(invoiceHtml(input), { waitUntil: "load" });

  if (options.fillerRows !== undefined) {
    await setFillerRows(p, options.fillerRows);
    const bytes = new Uint8Array(await p.pdf(PDF_OPTIONS));
    return {
      bytes,
      pages: pageCountOf(bytes),
      prints: 1,
      fillerRows: options.fillerRows,
    };
  }

  let prints = 0;
  const print = async (rows: number) => {
    await setFillerRows(p, rows);
    prints += 1;
    const bytes = new Uint8Array(await p.pdf(PDF_OPTIONS));
    return { bytes, pages: pageCountOf(bytes), rows };
  };

  const bare = await print(0);
  const full = await print(MAX_FILLER_ROWS);
  let best = full.pages === bare.pages ? full : bare;

  if (full.pages > bare.pages) {
    let lo = 0;
    let hi = MAX_FILLER_ROWS - 1;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      const candidate = await print(mid);
      if (candidate.pages > bare.pages) {
        hi = mid - 1;
      } else {
        lo = mid;
        best = candidate;
      }
    }
  }

  return {
    bytes: best.bytes,
    pages: best.pages,
    prints,
    fillerRows: best.rows,
  };
}

export type LayoutMeasurement = {
  /** Description cells whose text is wider than the cell can show. */
  overflowingDescCells: number;
  /** Description cells whose ink escapes the column's own box. */
  escapingDescCells: number;
  /** Meta values clipped to one line, as the react-pdf original does. */
  metaValuesClipped: number;
  metaValuesOverflowingGrid: number;
  tableWidthPt: number;
  descColumnWidthPt: number;
};

/**
 * Measures the printed layout in the DOM rather than inferring it from the
 * PDF. Chromium's layout engine is the thing under test here, so asking it
 * directly — under print media emulation — is the stronger evidence.
 */
export async function measureLayout(
  input: InvoicePdfInput,
): Promise<LayoutMeasurement> {
  await warmChromium();
  if (!page) throw new Error("Chromium page unavailable");
  const p = page;
  // Print media emulation switches stylesheets but does not re-lay-out to the
  // page box, so the viewport must be set to the printed content area for DOM
  // measurements to mean anything: US Letter minus the @page margins, in px.
  const PX_PER_PT = 96 / 72;
  await p.setViewportSize({
    width: Math.round((612 - 48 * 2) * PX_PER_PT),
    height: Math.round((792 - 40 * 2) * PX_PER_PT),
  });
  await p.setContent(invoiceHtml(input), { waitUntil: "load" });
  await p.emulateMedia({ media: "print" });
  try {
    return await p.evaluate(() => {
      const PT = 96 / 72; // CSS px per pt
      const table = document.querySelector("table.items") as HTMLElement;
      const descCells = Array.from(
        document.querySelectorAll("td.desc"),
      ) as HTMLElement[];
      const metaValues = Array.from(
        document.querySelectorAll(".meta-value"),
      ) as HTMLElement[];

      // scrollWidth > clientWidth means text the cell cannot display.
      const overflowingDescCells = descCells.filter(
        (c) => c.scrollWidth > c.clientWidth + 1,
      ).length;

      // Ink escaping the column box: compare the text's own range box.
      const escapingDescCells = descCells.filter((c) => {
        const cell = c.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(c);
        const ink = range.getBoundingClientRect();
        range.detach();
        return ink.right > cell.right + 1 || ink.left < cell.left - 1;
      }).length;

      const metaValuesClipped = metaValues.filter(
        (c) => c.scrollWidth > c.clientWidth + 1,
      ).length;

      const grid = document.querySelector(".meta") as HTMLElement;
      const gridBox = grid.getBoundingClientRect();
      const metaValuesOverflowingGrid = metaValues.filter((c) => {
        const box = c.getBoundingClientRect();
        return box.right > gridBox.right + 1;
      }).length;

      const firstDesc = descCells[0]?.getBoundingClientRect();
      return {
        overflowingDescCells,
        escapingDescCells,
        metaValuesClipped,
        metaValuesOverflowingGrid,
        tableWidthPt: Math.round(table.getBoundingClientRect().width / PT),
        descColumnWidthPt: firstDesc ? Math.round(firstDesc.width / PT) : 0,
      };
    });
  } finally {
    await p.emulateMedia({ media: null });
  }
}
