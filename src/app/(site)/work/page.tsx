import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Button from "@/components/ds/button";
import JobLog from "./job-log";
import TikTokEmbeds from "./tiktok-embeds";

const TITLE =
  "Welding & Fabrication Job Log | Tidwell Specialty Welding, Granbury TX";
const DESCRIPTION =
  "Real jobs off Eric's phone: pipe welds, gates, equipment repair, rail. Photos and video from Granbury to Fort Worth. Zoom in on any weld.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/work" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/work",
    images: [
      {
        url: "/og-card.png",
        width: 1200,
        height: 630,
        alt: "Tidwell Specialty Welding Services",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-card.png"],
  },
};

const kickerStyle: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,.55)",
  marginBottom: 12,
};

const sectionH2Style: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 900,
  fontStyle: "oblique 10deg",
  lineHeight: 0.9,
  textTransform: "uppercase",
  color: "#ffffff",
  margin: 0,
};

const captionStyle: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,.55)",
};

const wallVideoStyle: CSSProperties = {
  width: "100%",
  aspectRatio: "3 / 4",
  objectFit: "cover",
  display: "block",
  background: "#000",
  border: "1px solid rgba(255,255,255,.1)",
  clipPath:
    "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)",
};

/** Order and captions ported verbatim from work.dc.html (carport.mov is carport.mp4 in the manifest). */
const WALL_VIDEOS = [
  { name: "outdoor-railing", caption: "Outdoor custom railing" },
  { name: "water-trough-creosote", caption: "Water trough · creosote walls" },
  { name: "creosote-walls-troughs", caption: "Creosote walls, troughs in" },
  { name: "flange-weld-stainless", caption: "Stainless flange weld, close" },
  { name: "stainless-16in-closeup", caption: "16 in stainless weld, close" },
  { name: "flange-spoil-welds", caption: "Flange welds, spool piece" },
  { name: "aquarium-tank-holder", caption: "Custom aquarium stand" },
  { name: "carport", caption: "Carport build" },
] as const;

export default function WorkPage() {
  return (
    <>
      <JobLog />

      <section
        style={{
          borderTop: "1px solid rgba(255,255,255,.1)",
          background: "#0a0b0c",
        }}
      >
        <div className="max-w-[1280px] mx-auto px-5 md:px-8 py-16 md:py-[88px]">
          <div style={kickerStyle}>From the field</div>
          <h2
            className="text-[38px] md:text-[52px] mb-7 md:mb-8"
            style={sectionH2Style}
          >
            Shot on the <span style={{ color: "#c90314" }}>job</span>.
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
            {WALL_VIDEOS.map((video) => (
              <figure key={video.name} className="m-0 flex flex-col gap-2.5">
                <video
                  src={`/media/${video.name}.mp4`}
                  poster={`/media/${video.name}-poster.jpg`}
                  controls
                  muted
                  playsInline
                  preload="metadata"
                  aria-label={video.caption}
                  style={wallVideoStyle}
                />
                <figcaption style={captionStyle}>{video.caption}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section
        style={{
          borderTop: "1px solid rgba(255,255,255,.1)",
          background: "linear-gradient(180deg, #101214 0%, #0a0b0c 100%)",
        }}
      >
        <div className="max-w-[1280px] mx-auto px-5 md:px-8 py-16 md:py-[88px]">
          <div className="flex flex-wrap items-end justify-between gap-6 mb-3">
            <div>
              <div style={kickerStyle}>@__tdaddy__ on TikTok</div>
              <h2 className="text-[38px] md:text-[52px]" style={sectionH2Style}>
                10,000 watch the{" "}
                <span style={{ color: "#c90314" }}>welds</span>.
              </h2>
            </div>
            <Button variant="ghost" href="https://www.tiktok.com/@__tdaddy__">
              Open TikTok
            </Button>
          </div>
          <p
            className="mb-8"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 16,
              lineHeight: 1.55,
              color: "rgba(255,255,255,.72)",
              marginTop: 0,
              maxWidth: "56ch",
            }}
          >
            Eric films the process: fit-up, root, cap, the grind. Three posts
            pull straight from the feed. Like and follow from right here.
          </p>
          <TikTokEmbeds />
        </div>
      </section>

      <section
        style={{
          borderTop: "1px solid rgba(255,255,255,.1)",
          background: "#0a0b0c",
        }}
      >
        <div className="max-w-[1280px] mx-auto px-5 md:px-8 py-12 md:py-[72px] flex flex-wrap items-center justify-between gap-8">
          <h2 className="text-[36px] md:text-[48px]" style={sectionH2Style}>
            Got something like this?{" "}
            <span style={{ color: "#c90314" }}>Send it.</span>
          </h2>
          <Button variant="primary" size="lg" href="/quote">
            Request a quote
          </Button>
        </div>
      </section>
    </>
  );
}
