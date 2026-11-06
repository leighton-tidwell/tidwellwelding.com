# Spike: a lighter PDF renderer for invoices (issue #10)

**Status:** complete. Recommendation inside; no migration done.

## Finding in one line

Most of the cost is not the renderer. `renderInvoicePdf` renders the whole
document **up to 13 times** to choose the number of filler rows. One render of
a 100-line invoice costs ~103ms; the search around it costs the other ~1.3s.

100-line invoice, medians of 7 timed runs on this machine:

| 100-line invoice                                     | median     | spread (7 runs) | vs today |
| ---------------------------------------------------- | ---------- | --------------- | -------- |
| today — `@react-pdf/renderer` + linear filler search | **1380ms** | 1345–1388       | —        |
| `@react-pdf/renderer`, one render, no filler search  | 103ms      | 97–106          | 13x      |
| `@react-pdf/renderer` + probe-max-then-bisect search | **218ms**  | 207–244         | **6.3x** |
| direct `pdf-lib` composition                         | **32ms**   | 31–35           | **43x**  |

The issue quotes 1739ms for today's path; this machine does the same work in
1380ms. The ratios, not the absolute numbers, are the transferable part.

## Recommendation

1. **Adopt: replace the linear filler search.** Keep `@react-pdf/renderer`.
   1380ms → 218ms for 100 lines (6.3x), no new layout code, same chosen filler
   count, byte-for-byte the same document. About 15 lines in
   `convex/invoicePdf.tsx`. This is where the cost actually is.
2. **Drop, for now: migrating the renderer to `pdf-lib`.** It is genuinely 43x
   faster and it _can_ meet the layout constraints — the spike renderer proves
   that, see below. But it costs ~450 lines of hand-measured layout to own and
   test, re-introducing the class of defect the react-pdf rewrite removed, to
   save a further 186ms on an operation that runs when the shop owner clicks
   Download. After step 1 the renderer is no longer the bottleneck.

Step 2 stays on the shelf as a proven escape hatch: `bench/pdfLibInvoice.ts` in
this PR is a working starting point if invoice rendering ever becomes
customer-facing at volume, or if invoices start running past ~250 lines (where
react-pdf costs 339ms per render and pdf-lib still costs 44ms).

`testTimeout: 30_000` stays as it is either way, as the issue says.

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

## Candidate 1: cheaper filler search, same renderer

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

## Candidate 2: direct `pdf-lib` composition

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

## Approaches considered and not measured

- **Template + fill.** A pre-built US Letter template filled with `pdf-lib`
  would be faster still, but the table is variable-height and multi-page, so the
  template would have to carry every row count. The filler and pagination work
  would be the same arithmetic as candidate 2, for no further saving.
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

Numbers above are medians of 7 timed runs after 2 warm-up runs, one bench file
at a time, on an Apple M4 Pro (14 cores) / Node v26.13.0 (the repo pin) / macOS.
Run-to-run drift between whole-suite runs was about 5%. CI runners measured
~5.5x slower than a dev machine on the same work (issue #10: 9590ms against
1739ms), so expect roughly **1.2s on CI after the search fix** and **~180ms**
for pdf-lib — extrapolated, not measured.
