# Quote uploads

What `/quote` takes, and why. The rules live in `convex/uploadRules.ts` and
are shared verbatim by the browser (the `accept` attribute and the inline
rejection) and by `quotes.submitQuote`, which re-checks every file against the
size and content type storage actually recorded. The browser's check is a
courtesy; the server's is the one that counts.

| Job type        | Takes                          | Caps                           |
| --------------- | ------------------------------ | ------------------------------ |
| CNC plasma      | photos, DXF/DWG/SVG/PDF/AI/EPS | 10 MB a photo, 25 MB a drawing |
| Everything else | photos, video                  | 10 MB a photo, 200 MB a clip   |
| Competitor slot | one photo or PDF, any job type | 10 MB a photo, 25 MB a PDF     |

Ten files a request, plus the competitor quote. Video stops at CNC on purpose:
that work is cut from a drawing, so footage of it tells the shop nothing.

The 200 MB video cap is sized to what a phone hands over, not to what is
convenient to store. Thirty seconds of 4K/30 HEVC off a recent iPhone is
around 190 MB; 1080p/30 runs about 2 MB a second. A cap under that would read
to the visitor as "your video is broken" at exactly the moment they are trying
to describe a job, which costs a lead. The worst case a single request can
push is ten clips at the cap, and `uploads.generateUploadUrl` is rate limited
per session and globally in front of it.

A submission that fails any check deletes every file it uploaded, so a
rejected or retried attempt leaves nothing in storage (issue #21).

## Why the videos are not compressed in the browser

Issue #20 asked whether a clip could be shrunk before it goes up. It can, but
not worth what it costs here.

Compression has to happen in the browser — the bytes reach Convex storage
directly, and nothing in the Workers or Convex runtime can transcode video
afterwards. That leaves two options:

- **WebCodecs** (`VideoEncoder`, plus a small muxer) is the right shape for
  the job and adds only tens of kilobytes. Support is uneven exactly where
  these videos come from, so it would need a full fall-back path beside it,
  and hardware encoders differ enough between phones that the failures would
  be the hard-to-reproduce kind.
- **ffmpeg.wasm** is a 25 MB-plus download before a single frame is encoded,
  decodes and re-encodes in software at a fraction of real time on a phone,
  and wants `SharedArrayBuffer` — which means serving the site
  cross-origin-isolated and breaking the embedded Turnstile widget. The
  single-threaded build skips the headers and is slower still.

And the saving is smaller than it looks. Re-encoding that 190 MB clip to
1080p H.264 would land near 30 MB, but the transcode itself costs a minute or
more of phone CPU, during which the upload has not started. On any usable
connection the visitor finishes sooner by just sending the file, and the
failure mode of a transcode — a stall or a crash on the step before submit —
falls on the lead we can least afford to lose. Eric watches each clip once;
the storage is pennies.

**Recommendation: leave it alone.** The copy asks for a short clip, the cap
refuses the multi-minute recording, and that is the whole of the problem
worth solving. If uploads do start timing out on mobile data, the first thing
to reach for is a progress indicator and a "video too long?" hint, not a
transcoder.
