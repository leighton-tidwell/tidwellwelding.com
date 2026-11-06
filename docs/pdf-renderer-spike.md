# Spike: a lighter PDF renderer for invoices (issue #10)

**Status:** complete. Recommendation inside; no migration done.

## Finding in one line

Most of today's cost is not the renderer. `renderInvoicePdf` renders the whole
document **up to 13 times** to choose the number of filler rows. One render of
a 100-line invoice costs ~98ms; the search around it costs the other ~1.3s.

And the renderer itself can be replaced by one that owns no layout code at all:
HTML + CSS printed by Chromium holds every layout constraint, matches today's
pagination exactly, and is **34x** faster.

100-line invoice, medians of 7 timed runs on this machine:

| 100-line invoice                                       | median     | spread    | vs today |
| ------------------------------------------------------ | ---------- | --------- | -------- |
| today — `@react-pdf/renderer` + linear filler search   | **1374ms** | 1355–1397 | —        |
| `@react-pdf/renderer`, one render, no filler search    | 98ms       | 97–100    | 14x      |
| `@react-pdf/renderer` + probe-max-then-bisect search   | **209ms**  | 203–253   | **6.6x** |
| direct `pdf-lib` composition                           | 33ms       | 31–34     | 42x      |
| **HTML + CSS via Chromium** (warm browser)             | **42ms**   | 38–44     | **33x**  |
| HTML + CSS via Chromium (cold browser launch included) | 152ms      | 149–165   | 9x       |

The issue quotes 1739ms for today's path; this machine does the same work in
1374ms. The ratios, not the absolute numbers, are the transferable part.

At 250 line items the gap widens: react-pdf takes 4617ms, Chromium 56ms — 82x.

## Recommendation

1. **Adopt now: replace the linear filler search.** Keep `@react-pdf/renderer`.
   1374ms → 209ms for 100 lines (6.6x), no new layout code, same chosen filler
   count, byte-for-byte the same document. About 15 lines in
   `convex/invoicePdf.tsx`. Zero formatting risk, and it is independent of
   everything below — it is worth doing whether or not the renderer ever
   changes, because it is where the cost actually is.
2. **Adopt next, gated: HTML + CSS printed by Chromium.** This is the only
   candidate that _reduces_ the amount of layout code we own. Repeated
   headings, keep-together, row splitting, long-token breaking and page size
   stop being our code and become five CSS declarations backed by the layout
   engine the whole web is tested against. 33x faster warm, 9x faster even
   counting a cold browser launch, and the pagination is identical to today's
   at 0, 7, 40 and 100 line items. Three things must be settled first — an
   embedded font, the filler-row strategy and a visual diff; see the open
   questions below.
3. **Drop: direct `pdf-lib` composition.** Fast (42x) and it can be made to
   meet the constraints, but it puts ~545 lines of hand-measured layout on us
   permanently. Chromium gets the same speed class with none of that. The
   prototype stays in `bench/` as a record.

`testTimeout: 30_000` stays as it is regardless, as the issue says.

## Where today's cost goes

`renderInvoicePdf` renders once with no filler to learn the natural page count,
then renders again for every filler count from 1 to `MAX_FILLER_ROWS` (12),
stopping at the first one that spills onto a new page. Page count is monotone
non-decreasing in filler rows, and measured:

| line items | pages at filler 0…12      |
| ---------- | ------------------------- |
| 0          | 1,1,1,1,1,1,1,1,1,1,1,1,2 |
| 7          | 1,1,1,1,1,2,2,2,2,2,2,2,2 |
| 40         | 3,3,3,3,3,3,3,3,3,3,3,3,3 |
| 100        | 5,5,5,5,5,5,5,5,5,5,5,5,5 |

On any invoice that already fills a page, every filler count fits, so the loop
never breaks early and pays all 13 renders. That is the 40- and 100-line case —
exactly the slow tests in the issue.

## Candidate A: cheaper filler search, same renderer

Because the relation is monotone, the largest filler that fits can be found by
bisection instead of by walking the range. Two variants, measured:

| approach                                             | 7 lines | 40 lines | 100 lines |
| ---------------------------------------------------- | ------- | -------- | --------- |
| linear (today)                                       | 153ms   | 650ms    | 1430ms    |
| bisection (≤5 renders)                               | 127ms   | 261ms    | 543ms     |
| probe max, then bisect (2 renders when the max fits) | 164ms   | **96ms** | **218ms** |

Probe-max-then-bisect wins where it matters. On short invoices all three land
within ~40ms of each other, because a short invoice genuinely needs the search;
on long ones the probe answers in two renders. All three pick the same filler
count and produce the same document (identical output size in every case).

Memory follows render count: the linear search peaked at **+477MB** RSS over a
100-line run against **+60MB** for a single render. RSS deltas are noisy and
should be read as indicative, not exact.

## Candidate B: direct `pdf-lib` composition

`bench/pdfLibInvoice.ts` composes the same invoice with `pdf-lib` — already a
dependency, and already proven on this runtime, since `convex/pdfText.ts` uses
it. It measures rows with `font.widthOfTextAtSize`, paginates by arithmetic,
and so resolves filler rows without a single extra render. That is why it is
nearly flat in line count:

| line items | react-pdf, one render | pdf-lib |
| ---------- | --------------------- | ------- |
| 7          | 26ms                  | 24ms    |
| 40         | 47ms                  | 27ms    |
| 100        | 99ms                  | 31ms    |
| 250        | 339ms                 | 44ms    |

Output size is comparable once both embed the logo: 96.9KB react-pdf against
99.1KB pdf-lib at 100 lines.

### Does it meet the layout constraints?

Checked, not assumed (`bench/fidelity.bench.test.ts`):

- **US Letter** — 612x792, same as today. ✅
- **Column headings repeated on each page** — one `QTY / HRS` heading per page,
  and the page count matches react-pdf exactly at 0, 7, 40 and 100 lines
  (1, 1, 3, 5). ✅
- **Filler rows under the last entry** — present, resolved by arithmetic instead
  of by re-rendering. ✅
- **Notes/totals/footer kept together with the last row** — drawn as one atomic
  block; it moves to a fresh page rather than splitting. ✅
- **Long unbroken tokens stay in their column** — the defect that killed the
  previous coordinate renderer. Reproduced the test's 100-character part number:
  zero text runs wider than the column. ✅
- **Accented characters** — "Fabricación Zürich" survives the round trip. ✅

### What it is not

Being honest about what a 43x number is bought with:

- Not pixel-identical. Vertical centring, the meta grid and the notes rules are
  re-derived, not ported. It would need a visual diff against the owner's
  reference invoice before it could ship.
- No test coverage. The 28 assertions in `convex/invoicePdf.test.ts` were never
  run against it; only the six probes above were.
- Layout is hand-computed. Every future change — a new column, a longer footer —
  becomes arithmetic rather than flexbox, which is exactly the trade the current
  renderer's header comment warns about.

## Candidate C: HTML + CSS printed by Chromium (recommended direction)

`bench/htmlInvoice.ts` is the invoice as a single HTML document with a
stylesheet. `bench/chromiumRenderer.ts` prints it with local Chromium through
Playwright (already a devDependency). `bench/cloudflareRenderer.ts` is the
hosted leg — Cloudflare Browser Rendering's `/pdf` quick action — plus the
degradation chain.

**Playwright's `page.pdf()` is Chromium's print-to-PDF, the same engine
Cloudflare Browser Rendering runs server side.** The transport differs; the
layout engine does not. So every layout behaviour verified below is the
behaviour the hosted path produces, subject to the font caveat.

### The whole point: the constraints become CSS

| Constraint                       | Our code today                                        | As CSS                                                           |
| -------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------- |
| Column headings repeat per page  | `fixed` prop on the heading View                      | `<thead>` / `display: table-header-group`                        |
| Totals/notes/footer kept whole   | `wrap={false}`                                        | `break-inside: avoid`                                            |
| Rows never split                 | `wrap={false}` per row                                | `break-inside: avoid` on `tr`                                    |
| Long unbroken tokens stay in col | `Font.registerHyphenationCallback` + `MAX_TOKEN = 24` | `overflow-wrap: anywhere`                                        |
| Long customer name clipped       | `maxLines: 1` + `textOverflow`                        | `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` |
| US Letter                        | `size="LETTER"`                                       | `@page { size: letter }`                                         |

`bench/htmlInvoice.ts` contains no token-splitting constant, no hyphenation
callback, no hand-measured row height and no page arithmetic.

### Measured fidelity

Structure is read back out of the PDF; overflow is measured in the DOM under
print emulation, because Chromium's layout is the thing under test
(`bench/html.bench.test.ts`, 3 tests, all passing):

| line items | pages (react-pdf) | pages (Chromium) | heading on every page | totals | footer |
| ---------- | ----------------- | ---------------- | --------------------- | ------ | ------ |
| 0          | 1                 | 1                | 1/1                   | 1      | 1      |
| 7          | 1                 | 1                | 1/1                   | 1      | 1      |
| 40         | 3                 | 3                | 3/3                   | 1      | 1      |
| 100        | 5                 | 5                | 5/5                   | 1      | 1      |

- Page size 612x792pt, table 516pt wide, description column 175pt — the
  react-pdf design's own geometry (176pt, less a hairline absorbed by
  `border-collapse`). ✅
- 100-character part number: **0** cells whose text overflows, **0** cells with
  ink outside the column box. ✅
- 84-character company name: clipped to one line, **0** values overflowing the
  meta grid. ✅
- "Fabricación Zürich" round-trips. ✅

A gotcha worth recording: the stylesheet is written in **`pt`, not `px`**. CSS
`pt` is 1/72in, the same unit the PDF uses, so the react-pdf design's numbers
carry over unchanged. In `px` the sheet is 816 wide rather than 612 and the
whole invoice comes out a quarter too small — which is exactly what the first
draft of this candidate did, and the symptom was 40 line items fitting on 2
pages instead of 3.

### Timing

| line items | react-pdf today | Chromium, one print | Chromium, filler resolved |
| ---------- | --------------- | ------------------- | ------------------------- |
| 7          | 148ms           | 18ms                | 78ms (6 prints)           |
| 40         | 605ms           | 19ms                | 33ms (2 prints)           |
| 100        | 1409ms          | 24ms                | 42ms (2 prints)           |
| 250        | 4617ms          | 33ms                | 56ms (2 prints)           |

A cold browser launch plus a 100-line render is 152ms — still 9x faster than
today's warm path.

Output is bigger: **160KB against 97KB** at 100 lines, because Chromium embeds
subsetted font programs where react-pdf references the standard 14. That is
1.6x more for Eric's phone to download, and worth weighing against the render
saving.

### Graceful degradation (tested)

`bench/cloudflareRenderer.ts` renders through Cloudflare and falls back to the
existing in-process renderer rather than failing. Cloudflare's published
limits are 600 req/min on Workers Paid, 30 concurrent browsers, 30 new
instances/minute, a 60s browser timeout, and 10 minutes of browser time per
day on the free plan — so for this shop the realistic failure is a transient
429/5xx or the free daily allowance, not sustained volume.

The transport is injected, so the chain is verified with no network and no API
token (`bench/fallback.bench.test.ts`, 7 tests, all passing):

| situation                     | behaviour                                                       |
| ----------------------------- | --------------------------------------------------------------- |
| success                       | 1 call, no sleeping, fallback untouched                         |
| 429 then 200                  | retried after the server's own `Retry-After`, no fallback       |
| `Retry-After: 3600`           | capped at 2s — an invoice never hangs for an hour               |
| sustained 429                 | 3 attempts with jittered backoff, then a real react-pdf invoice |
| 401 / 413 (our mistake)       | no retries, no backoff, straight to the fallback                |
| 3 consecutive failed invoices | breaker opens; later invoices skip the network entirely         |
| 60s later                     | hosted renderer is probed again and recovers on its own         |

The design rule: **an invoice that renders slowly is a much better outcome for
the shop than an invoice that does not render at all**, so the fallback is
unconditional and the in-process renderer stays in the tree as the safety net.
Only a failure of _both_ renderers surfaces an error.

### Open questions before this could ship

1. **Fonts — the real risk.** On macOS Chromium resolves genuine Helvetica.
   Cloudflare's Linux container will not have it and will substitute. I
   verified the layout _is_ metric-sensitive (switching to a serif changes the
   description column's ink width from 97pt to 89.67pt), but I could **not**
   simulate Linux metrics here: Liberation Sans, DejaVu Sans and Nimbus Sans
   are not installed on this machine, so all those family names resolve to the
   same fallback and the test cannot tell them apart. Fixed 26pt row heights
   mean page counts held across every family I could try, but a description
   that wraps to two lines on Linux and one on macOS would change a row's
   height and therefore the pagination. **Mitigation: embed a WOFF2 via
   `@font-face` as base64 in the document**, so rendering is identical
   everywhere and does not depend on the container's font set. Must be done
   and verified against the hosted renderer before adopting.
2. **Filler rows need DOM access.** The local prototype resolves them by
   measuring, mutating the DOM and reprinting the already-loaded page — 2
   prints for a long invoice, up to 6 for a short one. The hosted REST
   endpoint takes HTML and returns a PDF, with no DOM in between, so the same
   strategy costs 2–6 round trips per invoice. Options: accept the round trips
   (free if the PDF is pre-generated when the invoice is saved rather than on
   download), drop filler rows (they are cosmetic), or drive a browser session
   through the Workers binding, which does give DOM access. Unresolved.
3. **Visual diff.** Pagination and overflow are verified; pixel placement is
   not. Needs a page-by-page image diff against Eric's reference invoice.
4. **Where it runs.** A Convex action can `fetch` the REST endpoint (a token
   on the Convex deployment), or the Next.js Worker can use the `env.BROWSER`
   binding with no token at all. The binding is cheaper and avoids a secret,
   but moves PDF generation out of the Convex action.

## Approaches considered and not measured

- **Template + fill.** A pre-built US Letter template filled with `pdf-lib`
  would be faster still, but the table is variable-height and multi-page, so the
  template would have to carry every row count. The filler and pagination work
  would be the same arithmetic as candidate B, for no further saving.
- **Caching the rendered PDF.** Already effectively present: the action stores
  the result in Convex file storage and attaches it to the invoice. It does not
  help the test suite, which is where the pain is.
- **Streaming.** `renderToStream` would start bytes flowing sooner, but the total
  work is unchanged and the action has to hand complete bytes to
  `ctx.storage.store` anyway.
- **Reusing react-pdf's font/layout setup across renders.** The ~10ms floor on a
  one-line render is small next to the per-line slope; with the search fixed
  there is nothing worth chasing here.

## Reproducing

```bash
pnpm exec vitest run --config vitest.bench.config.mts
```

Benchmark code lives in `bench/` and is **throwaway**: it is excluded from
`make test` (`vitest.config.mts` includes only `convex/**` and `src/**`) and has
no bearing on production. Raw output in
[`bench/results.md`](../bench/results.md).

Numbers above are medians of 7 timed runs after 2 warm-up runs (3 runs for the
cold-launch figure), one bench file at a time, on an Apple M4 Pro (14 cores) /
Node v26.13.0 (the repo pin) / macOS. Run-to-run drift between whole-suite runs
was about 5%. CI runners measured ~5.5x slower than a dev machine on the same
work (issue #10: 9590ms against 1739ms), so expect roughly **1.2s on CI after
the search fix** — extrapolated, not measured.

Chromium figures come from local Playwright, not from Cloudflare. The hosted
endpoint was never called: it needs an account id and an API token with
"Browser Run - Edit", and per `AGENTS.md` server secrets live on the Convex
deployment. Cloudflare publishes no latency figure for `/pdf`; one third-party
blog claims sub-200ms, unverified. **The hosted leg is untimed.**
