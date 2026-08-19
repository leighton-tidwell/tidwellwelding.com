import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import Button from "@/components/ds/button";
import Card from "@/components/ds/card";
import HazardBar from "@/components/ds/hazard-bar";
import Icon from "@/components/ds/icon";
import Tag from "@/components/ds/tag";
import JsonLd from "@/components/json-ld";

export const metadata: Metadata = {
  title:
    "Welding & Fabrication in Granbury, TX | 24/7 Mobile Welder | Tidwell Specialty Welding",
  description:
    "Fabrication, structural, pipe and heavy equipment repair out of Granbury, TX. The rigged truck covers DFW to Stephenville. Call (817) 894-6357 any hour.",
  alternates: { canonical: "/" },
};

/* ---- shared inline type styles (ported from index.dc.html) ---------- */

const kicker: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,.55)",
};

const displayHead: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 900,
  fontStyle: "oblique 10deg",
  lineHeight: 0.9,
  textTransform: "uppercase",
  color: "#ffffff",
  margin: 0,
};

const chamfer = (px: number): CSSProperties => ({
  clipPath: `polygon(${px}px 0, 100% 0, 100% calc(100% - ${px}px), calc(100% - ${px}px) 100%, 0 100%, 0 ${px}px)`,
});

/* ---- content (ported verbatim from index.dc.html renderVals()) ------ */

const SERVICES = [
  {
    eyebrow: "SERVICE 01 — FABRICATION",
    title: "Fabrication",
    body: "Custom builds from drawings, sketches or a photo of the space. Carbon, stainless, aluminum.",
    href: "/services#fabrication",
  },
  {
    eyebrow: "SERVICE 02 — STRUCTURAL",
    title: "Staircases & handrail",
    body: "Commercial staircase packages, handrail runs, structural steel. Plumb, square, inspection-ready.",
    href: "/services#structural",
  },
  {
    eyebrow: "SERVICE 03 — PIPE",
    title: "Pipe welding",
    body: "Process pipe, pipeline and station work. Carbon, stainless, chrome-moly, Inconel.",
    href: "/services#pipe",
  },
  {
    eyebrow: "SERVICE 04 — EQUIPMENT",
    title: "Heavy equipment repair",
    body: "Buckets, booms, frames, frac tanks, hot oil beds. Repairs that hold under load.",
    href: "/services#equipment",
  },
  {
    eyebrow: "SERVICE 05 — MOBILE",
    title: "Mobile welding",
    body: "A rigged truck that meets you anywhere in the DFW–Stephenville area.",
    href: "/services#mobile",
  },
  {
    eyebrow: "SERVICE 06 — EMERGENCY",
    title: "Emergency & on-call",
    body: "24/7. Nights, weekends, holidays. Eric drops what he's doing and comes to you.",
    href: "/services#emergency",
  },
];

const REVIEWS = [
  {
    text: "Line went down Friday night. Eric was on site by nine and we ran Saturday morning. The repair weld looks better than the factory ones.",
    name: "D. Whitfield",
    meta: "Plant maintenance · Granbury",
  },
  {
    text: "He quoted our stair package against two bigger shops and beat both. The rail welds passed inspection on the first walk.",
    name: "M. Serrano",
    meta: "General contractor · Fort Worth",
  },
  {
    text: "Baler cracked at the pivot in the middle of hay season. He drove out to the ranch that day and the fix has held two seasons.",
    name: "R. Cates",
    meta: "Ranch owner · Stephenville",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Describe the job",
    body: "Job type, material, rough sizes, where it sits. Attach photos or video.",
  },
  {
    n: "02",
    title: "Get working numbers",
    body: "The estimator drafts tasks, crew size, hours and a dollar range.",
  },
  {
    n: "03",
    title: "Eric confirms",
    body: "Pick a time slot. Eric calls back within the hour to firm it up.",
  },
];

const TRUST = [
  {
    icon: "clock",
    title: "24/7 emergency",
    body: "Nights, weekends, holidays. Eric drops what he's doing and comes to you.",
  },
  {
    icon: "truck",
    title: "Fully mobile",
    body: "The rigged truck meets you anywhere from DFW to Stephenville.",
  },
  {
    icon: "file-text",
    title: "We beat quotes",
    body: "Quotes are free. Send us the one you got and we'll beat it.",
  },
] as const;

const SERVICE_AREA_TAGS = [
  "Granbury",
  "Fort Worth",
  "Weatherford",
  "Cleburne",
  "Glen Rose",
  "Stephenville",
];

// WebSite schema (home page ONLY): the surviving purpose is the site name
// shown above Google results. The SearchAction is harmless and free now that
// /search exists — Google removed the sitelinks search box globally in 2024,
// so expect nothing from it there.
const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://tidwellwelding.com/#website",
  url: "https://tidwellwelding.com/",
  name: "Tidwell Specialty Welding",
  alternateName: ["TSWS", "Tidwell Specialty Welding Services"],
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: "https://tidwellwelding.com/search?q={search_term_string}",
    },
    "query-input": "required name=search_term_string",
  },
};

export default function HomePage() {
  return (
    <>
      <JsonLd data={websiteJsonLd} />

      {/* ---- Hero ------------------------------------------------------ */}
      <section className="mx-auto grid w-full max-w-[1280px] items-center gap-10 px-5 pb-14 pt-14 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:pb-20 lg:pt-24">
        <div className="flex flex-col gap-6">
          <div style={kicker}>Welding &amp; fabrication · Granbury, TX</div>
          <h1
            className="text-[52px] sm:text-[68px] lg:text-[88px]"
            style={{
              ...displayHead,
              lineHeight: 0.88,
              letterSpacing: "-0.02em",
              textWrap: "pretty",
            }}
          >
            Welds that look like a <span style={{ color: "#c90314" }}>robot</span>{" "}
            ran them.
          </h1>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 18,
              lineHeight: 1.55,
              color: "rgba(255,255,255,.78)",
              margin: 0,
              maxWidth: "52ch",
            }}
          >
            Fabrication, structural, pipe, heavy equipment. Shop work when the
            part can come in. The truck when it can&apos;t. You talk to the
            welder who does the work.
          </p>
          <div className="flex flex-wrap items-center gap-3.5">
            <Button variant="primary" size="lg" href="/quote">
              Request a quote
            </Button>
            <Button variant="ghost" size="lg" href="/work">
              See the work
            </Button>
          </div>
          <div
            className="flex flex-wrap gap-x-5 gap-y-3 border-t border-white/10 pt-[18px] sm:gap-y-2"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,.55)",
            }}
          >
            <span>Welding since 2011</span>
            <span aria-hidden="true">◆</span>
            <span>16 years on the torch</span>
            <span aria-hidden="true">◆</span>
            <span>LLC · Insured</span>
            <span aria-hidden="true">◆</span>
            <span>Free quotes</span>
          </div>
        </div>
        { }
        <img
          src="/media/stainless-pipe-8in.webp"
          alt="Stacked TIG beads on 8 in stainless pipe, Granbury TX"
          style={{
            width: "100%",
            aspectRatio: "4 / 5",
            objectFit: "cover",
            display: "block",
            ...chamfer(20),
          }}
        />
      </section>

      {/* ---- Trust strip ----------------------------------------------- */}
      <section className="border-y border-white/10 bg-[#0a0b0c]">
        <div className="mx-auto grid max-w-[1280px] px-5 sm:px-8 md:grid-cols-3">
          {TRUST.map((t, i) => (
            <div
              key={t.title}
              className={[
                "flex items-start gap-3.5 py-7",
                i < TRUST.length - 1
                  ? "border-b border-white/8 md:border-b-0 md:border-r"
                  : "",
                i === 0 ? "md:pr-7" : i === TRUST.length - 1 ? "md:pl-7" : "md:px-7",
              ].join(" ")}
            >
              <Icon name={t.icon} size={24} color="#ffb020" />
              <div>
                <div
                  style={{ ...displayHead, fontSize: 24, lineHeight: 1 }}
                >
                  {t.title}
                </div>
                <p
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: "rgba(255,255,255,.68)",
                    margin: "8px 0 0",
                  }}
                >
                  {t.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Emergency call plate --------------------------------------- */}
      <section id="emergency" className="bg-[#0d0e0f]">
        <HazardBar variant="red" height="8px" animated />
        <div className="mx-auto grid max-w-[1280px] items-center gap-8 px-5 py-14 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:gap-12 lg:py-18">
          <div className="flex flex-col gap-4">
            <div style={{ ...kicker, color: "#ffb020" }}>
              Emergency response · On call now
            </div>
            <h2
              className="text-[44px] lg:text-[62px]"
              style={displayHead}
            >
              Something&apos;s down. Call now.
            </h2>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 17,
                lineHeight: 1.55,
                color: "rgba(255,255,255,.78)",
                margin: 0,
                maxWidth: "56ch",
              }}
            >
              A cracked frame, a leaking tank, a line that has to run by
              morning. Call at 2 a.m. and Eric loads the truck. Nights,
              weekends, holidays included.
            </p>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,.5)",
              }}
            >
              Granbury · Fort Worth · Stephenville · everywhere between
            </div>
          </div>
          <div className="flex flex-col items-start gap-3.5">
            <a
              href="tel:8178946357"
              className="tsws-focus-inset block max-w-full [box-shadow:inset_0_1px_0_rgba(255,255,255,.25),0_2px_0_#000] hover:[box-shadow:inset_0_1px_0_rgba(255,255,255,.25),0_2px_0_#000,0_0_32px_rgba(201,3,20,.45)] active:translate-y-px"
              style={{
                textDecoration: "none",
                background: "linear-gradient(180deg, #e2101f 0%, #a00210 100%)",
                color: "#ffffff",
                padding: "22px 34px",
                ...chamfer(16),
              }}
            >
              <span
                style={{
                  display: "block",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "#ffffff",
                }}
              >
                Tap to call Eric
              </span>
              <span
                className="text-[36px] sm:text-[44px]"
                style={{
                  display: "block",
                  fontFamily: "var(--font-display)",
                  fontWeight: 900,
                  fontStyle: "oblique 10deg",
                  lineHeight: 1,
                  marginTop: 4,
                }}
              >
                (817) 894-6357
              </span>
            </a>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 14,
                color: "rgba(255,255,255,.6)",
              }}
            >
              Can&apos;t call? Email{" "}
              <a href="mailto:eric@tidwellwelding.com" style={{ color: "#eef0f1" }}>
                eric@tidwellwelding.com
              </a>{" "}
              and mark it urgent.
            </div>
          </div>
        </div>
      </section>

      {/* ---- Capability sheet ------------------------------------------- */}
      <section className="mx-auto w-full max-w-[1280px] px-5 pb-14 pt-16 sm:px-8 lg:pt-26">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <div style={{ ...kicker, marginBottom: 12 }}>Capability sheet</div>
            <h2 className="text-[40px] lg:text-[56px]" style={displayHead}>
              Fabrication is the <span style={{ color: "#c90314" }}>job</span>.
            </h2>
          </div>
          <Button variant="ghost" href="/services">
            Open the capability sheet
          </Button>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              style={{ textDecoration: "none", display: "block" }}
            >
              <Card interactive eyebrow={s.eyebrow} title={s.title}>
                <p
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: "rgba(255,255,255,.68)",
                    margin: 0,
                  }}
                >
                  {s.body}
                </p>
              </Card>
            </Link>
          ))}
        </div>
        <div className="mt-7 flex flex-wrap items-center gap-3.5">
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,.5)",
            }}
          >
            Materials
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#eef0f1",
            }}
          >
            Carbon <span aria-hidden="true">◆</span> Stainless{" "}
            <span aria-hidden="true">◆</span> Aluminum{" "}
            <span aria-hidden="true">◆</span> Inconel{" "}
            <span aria-hidden="true">◆</span> Chrome-moly
          </span>
        </div>
      </section>

      {/* ---- Mobile welding --------------------------------------------- */}
      <section
        className="border-t border-white/10"
        style={{ background: "linear-gradient(180deg, #101214 0%, #0a0b0c 100%)" }}
      >
        <div className="mx-auto grid max-w-[1280px] items-center gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14 lg:py-22">
          <video
            id="rig-video"
            src="/media/rig-rear-slowmo.mp4"
            poster="/media/welding-rig-at-work.jpg"
            autoPlay
            muted
            loop
            playsInline
            controls
            aria-label="Rear of the TSWS welding rig rolling in slow motion"
            style={{
              width: "100%",
              aspectRatio: "4 / 3",
              objectFit: "cover",
              display: "block",
              background: "#000",
              ...chamfer(16),
            }}
          />
          {/* 2.2.2/2.3.3: no autoplay for users who asked for reduced motion. */}
          <script
            dangerouslySetInnerHTML={{
              __html:
                '(function(){try{if(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches){var v=document.getElementById("rig-video");if(v){v.removeAttribute("autoplay");v.autoplay=false;v.pause();}}}catch(e){}})();',
            }}
          />
          <div className="flex flex-col gap-[18px]">
            <div style={kicker}>Mobile welding</div>
            <h2 className="text-[40px] lg:text-[56px]" style={displayHead}>
              The shop comes to <span style={{ color: "#c90314" }}>you</span>.
            </h2>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 17,
                lineHeight: 1.55,
                color: "rgba(255,255,255,.78)",
                margin: 0,
                maxWidth: "54ch",
              }}
            >
              If the part can&apos;t come in, the truck goes out. It arrives
              rigged and burns rod within minutes. Ranch gates, plant floors,
              trailers dead on the shoulder. You name the spot in the
              DFW&ndash;Stephenville area and Eric meets you there.
            </p>
            <div className="flex flex-wrap gap-2.5">
              {SERVICE_AREA_TAGS.map((town) => (
                <Tag key={town}>{town}</Tag>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---- Reviews ----------------------------------------------------- */}
      <section className="mx-auto w-full max-w-[1280px] px-5 py-16 sm:px-8 lg:py-26">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-6">
          <h2 className="text-[40px] lg:text-[56px]" style={displayHead}>
            What the area says.
          </h2>
          <div className="flex items-center gap-2.5">
            <Icon name="star" size={18} color="#ffb020" />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                letterSpacing: "0.12em",
                color: "#ffffff",
              }}
            >
              5.0 · GOOGLE
            </span>
          </div>
        </div>
        <div
          className="mb-8"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,.55)",
          }}
        >
          Sample reviews. Wire to the live Google Business Profile feed at
          launch.
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {REVIEWS.map((r) => (
            <div
              key={r.name}
              className="flex flex-col gap-3.5"
              style={{
                background: "#0d0e0f",
                border: "1px solid rgba(255,255,255,.1)",
                borderTop: "3px solid #c90314",
                padding: 24,
                ...chamfer(12),
              }}
            >
              <div
                role="img"
                aria-label="Rated 5 out of 5 stars"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  letterSpacing: "0.2em",
                  color: "#ffb020",
                }}
              >
                ★★★★★
              </div>
              <p
                className="flex-1"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 15,
                  lineHeight: 1.55,
                  color: "rgba(255,255,255,.82)",
                  margin: 0,
                }}
              >
                {r.text}
              </p>
              <div className="border-t border-white/8 pt-3">
                <div
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#ffffff",
                  }}
                >
                  {r.name}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,.5)",
                    marginTop: 2,
                  }}
                >
                  {r.meta}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Quote intake ------------------------------------------------ */}
      <section className="border-t border-white/10 bg-[#0a0b0c]">
        <div className="mx-auto grid max-w-[1280px] items-center gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14 lg:py-22">
          <div className="flex flex-col gap-[18px]">
            <div style={kicker}>Quote intake · AI assisted</div>
            <h2 className="text-[40px] lg:text-[56px]" style={displayHead}>
              Send photos. Get a working{" "}
              <span style={{ color: "#c90314" }}>estimate</span>.
            </h2>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 17,
                lineHeight: 1.55,
                color: "rgba(255,255,255,.78)",
                margin: 0,
                maxWidth: "54ch",
              }}
            >
              Describe the job and attach photos. The estimator drafts the task
              list, crew size and hours while you watch. Eric checks the
              numbers and calls you back. Quotes are free. Got one from another
              shop? Send it and we&apos;ll beat it.
            </p>
            <div className="flex flex-wrap gap-3.5">
              <Button variant="primary" size="lg" href="/quote">
                Start the estimate
              </Button>
              <Button variant="ghost" size="lg" href="/contact">
                Talk to Eric first
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {STEPS.map((st) => (
              <div
                key={st.n}
                className="flex items-start gap-4"
                style={{
                  background: "#0d0e0f",
                  border: "1px solid rgba(255,255,255,.1)",
                  padding: "18px 20px",
                  ...chamfer(10),
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 900,
                    fontStyle: "oblique 10deg",
                    fontSize: 32,
                    color: "#c90314",
                    lineHeight: 1,
                  }}
                >
                  {st.n}
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      color: "#ffffff",
                    }}
                  >
                    {st.title}
                  </div>
                  <p
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: 14,
                      lineHeight: 1.5,
                      color: "rgba(255,255,255,.68)",
                      margin: "6px 0 0",
                    }}
                  >
                    {st.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Clip-path chamfers swallow the global outset focus ring; draw it inset (2.4.7). */}
      <style>{`.tsws-focus-inset:focus-visible{box-shadow:inset 0 0 0 2px var(--black-900),inset 0 0 0 4px var(--arc-blue)}`}</style>
    </>
  );
}
