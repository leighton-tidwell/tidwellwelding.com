"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import Badge from "@/components/ds/badge";

const CATEGORIES = ["All", "Fabrication", "Structural", "Equipment", "Pipe"] as const;
type Category = (typeof CATEGORIES)[number];
type JobCategory = Exclude<Category, "All">;

type JobMedia =
  | { kind: "image"; src: string; alt: string }
  | { kind: "video"; src: string; poster: string };

type Job = {
  category: JobCategory;
  media: JobMedia;
  title: string;
  blurb: string;
  specs: string[];
};

/** Content ported verbatim from work.dc.html (media paths per the manifest: .webp images, .mp4 + poster videos). */
const JOBS: Job[] = [
  {
    category: "Pipe",
    media: {
      kind: "image",
      src: "/media/heavy-wall-8in-stainless.webp",
      alt: "Heavy wall stainless piece with flanges",
    },
    title: "Heavy wall stainless, 8 in",
    blurb:
      "Flanged heavy wall stainless piece, purged TIG roots and caps. The heat tint tells you the purge held.",
    specs: ["8 in heavy wall", "Purged TIG", "Stainless"],
  },
  {
    category: "Pipe",
    media: {
      kind: "image",
      src: "/media/stainless-fabrication-pieces.webp",
      alt: "304 stainless elbows with flanges",
    },
    title: "Flanged spool pieces",
    blurb:
      "304 stainless elbows with slip-on flanges, TIG start to finish. Welds left as-run. Look at the flange joints.",
    specs: ["304 stainless", "TIG", "Shop built"],
  },
  {
    category: "Equipment",
    media: {
      kind: "image",
      src: "/media/bulldozer-reinforcement-plate.webp",
      alt: "Reinforcement plate on a bulldozer bucket",
    },
    title: "Bulldozer bucket reinforcement",
    blurb:
      "Reinforcement plate cut, fit and welded onto a dozer bucket in the field. Preheated, welded out, back pushing dirt.",
    specs: ["On location", "Wear plate", "Carbon steel"],
  },
  {
    category: "Structural",
    media: {
      kind: "image",
      src: "/media/custom-handrail.webp",
      alt: "Interior steel handrail with cable infill",
    },
    title: "Interior cable-rail handrail",
    blurb:
      "Steel rail with cable infill for a staircase remodel. Square, plumb and blended joints inside a finished house.",
    specs: ["In-home install", "Cable infill", "Clean joints"],
  },
  {
    category: "Structural",
    media: {
      kind: "image",
      src: "/media/water-troughs-creosote.webp",
      alt: "Steel-framed trough bays with creosote board walls",
    },
    title: "Water troughs, creosote walls",
    blurb:
      "Steel-framed trough bays under a metal barn, walls skinned in creosote boards. Framed, squared and set on the pad.",
    specs: ["Ranch build", "Steel + creosote", "On location"],
  },
  {
    category: "Fabrication",
    media: {
      kind: "video",
      src: "/media/asphalt-chute.mp4",
      poster: "/media/asphalt-chute-poster.jpg",
    },
    title: "Asphalt plant chute",
    blurb:
      "Custom chute fabricated for an asphalt plant. Built to fit the plant, not the other way around.",
    specs: ["Plant equipment", "Carbon steel", "Built to fit"],
  },
  {
    category: "Fabrication",
    media: {
      kind: "video",
      src: "/media/creosote-gate.mp4",
      poster: "/media/creosote-gate-poster.jpg",
    },
    title: "Creosote board gate",
    blurb:
      "Steel-framed custom gate skinned in creosote boards. Frame welded in the shop, boards hung to match the fence line.",
    specs: ["Custom gate", "Steel + creosote", "Shop built"],
  },
];

const CHAMFER_6 =
  "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)";
const CHAMFER_12 =
  "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)";
const CHAMFER_14 =
  "polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)";

const mediaStyle: CSSProperties = {
  width: "100%",
  aspectRatio: "16 / 9",
  objectFit: "cover",
  display: "block",
  clipPath: CHAMFER_12,
};

function JobCard({ job, eager }: { job: Job; eager: boolean }) {
  return (
    <article
      style={{
        background: "#0d0e0f",
        border: "1px solid rgba(255,255,255,.1)",
        borderTop: "3px solid #c90314",
        clipPath: CHAMFER_14,
      }}
    >
      <div className="px-6 pt-5">
        {job.media.kind === "image" ? (
           
          <img
            src={job.media.src}
            alt={job.media.alt}
            loading={eager ? undefined : "lazy"}
            style={mediaStyle}
          />
        ) : (
          <video
            src={job.media.src}
            poster={job.media.poster}
            controls
            muted
            playsInline
            preload="metadata"
            aria-label={job.title}
            style={{ ...mediaStyle, background: "#000" }}
          />
        )}
      </div>
      <div className="px-6 pt-5 pb-6 flex flex-col gap-3">
        <div className="flex justify-between items-center gap-3">
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,.5)",
            }}
          >
            JOB — {job.category.toUpperCase()}
          </div>
          <Badge variant="ok" dot>
            Completed
          </Badge>
        </div>
        <h2
          className="text-[28px] md:text-[34px]"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 900,
            fontStyle: "oblique 10deg",
            lineHeight: 0.95,
            textTransform: "uppercase",
            color: "#ffffff",
            margin: 0,
          }}
        >
          {job.title}
        </h2>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 15,
            lineHeight: 1.55,
            color: "rgba(255,255,255,.72)",
            margin: 0,
          }}
        >
          {job.blurb}
        </p>
        <ul
          className="flex flex-wrap gap-x-[18px] gap-y-1.5"
          role="list"
          style={{
            borderTop: "1px solid rgba(255,255,255,.08)",
            paddingTop: 14,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,.55)",
            listStyle: "none",
            margin: 0,
            paddingLeft: 0,
          }}
        >
          {job.specs.map((spec) => (
            <li key={spec}>{spec}</li>
          ))}
        </ul>
      </div>
    </article>
  );
}

export default function JobLog() {
  const [filter, setFilter] = useState<Category>("All");
  const visibleJobs = JOBS.filter(
    (job) => filter === "All" || job.category === filter,
  );

  return (
    <>
      <style>{`.work-chip--idle:hover{border-color:rgba(201,3,20,.7) !important}
/* Clip-path chamfers swallow the global outset focus ring; draw it inset (2.4.7). */
.tsws-focus-inset:focus-visible{box-shadow:inset 0 0 0 2px var(--black-900),inset 0 0 0 4px var(--arc-blue)}`}</style>

      <section className="w-full max-w-[1280px] mx-auto px-5 md:px-8 pt-14 md:pt-[88px] pb-10">
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,.55)",
            marginBottom: 14,
          }}
        >
          Job log
        </div>
        <h1
          className="text-[48px] sm:text-[60px] md:text-[76px]"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 900,
            fontStyle: "oblique 10deg",
            lineHeight: 0.88,
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
            color: "#ffffff",
            margin: 0,
          }}
        >
          The work speaks. <span style={{ color: "#c90314" }}>Look close.</span>
        </h1>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 17,
            lineHeight: 1.55,
            color: "rgba(255,255,255,.78)",
            margin: "20px 0 0",
            maxWidth: "58ch",
          }}
        >
          Real jobs off Eric&apos;s phone: pipe, gates, equipment, rail. Zoom in
          on any weld.
        </p>
        <div className="flex flex-wrap gap-2.5 mt-6">
          {CATEGORIES.map((category) => {
            const active = category === filter;
            return (
              <button
                key={category}
                type="button"
                onClick={() => setFilter(category)}
                aria-pressed={active}
                className={
                  active
                    ? "work-chip tsws-focus-inset"
                    : "work-chip work-chip--idle tsws-focus-inset"
                }
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  padding: "8px 14px",
                  border: `1px solid ${active ? "#c90314" : "rgba(255,255,255,.16)"}`,
                  color: "#ffffff",
                  background: active
                    ? "linear-gradient(180deg, #e2101f 0%, #a00210 100%)"
                    : "transparent",
                  clipPath: CHAMFER_6,
                }}
              >
                {category === "All" ? "All jobs" : category}
              </button>
            );
          })}
        </div>
      </section>

      <section className="w-full max-w-[1280px] mx-auto px-5 md:px-8 pb-16 md:pb-24 grid grid-cols-1 md:grid-cols-2 gap-6">
        {visibleJobs.map((job, index) => (
          <JobCard key={job.title} job={job} eager={index < 2} />
        ))}
      </section>
    </>
  );
}
