import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import Button from "@/components/ds/button";
import HazardBar from "@/components/ds/hazard-bar";
import Icon from "@/components/ds/icon";
import type { IconName } from "@/components/ds/icon";
import JsonLd from "@/components/json-ld";
import {
  EMAIL,
  EMAIL_MAILTO,
  PHONE_DISPLAY,
  PHONE_TEL,
  SITE_URL,
} from "@/lib/business";

/* ---- shared inline type styles (same idiom as the home page) -------- */

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

const bodyCopy: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 17,
  lineHeight: 1.55,
  color: "rgba(255,255,255,.78)",
  margin: 0,
  maxWidth: "54ch",
};

const monoSpec: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "#ffb020",
};

const chamfer = (px: number): CSSProperties => ({
  clipPath: `polygon(${px}px 0, 100% 0, 100% calc(100% - ${px}px), calc(100% - ${px}px) 100%, 0 100%, 0 ${px}px)`,
});

/* ---- inline copy link (for in-paragraph cross-links) ---------------- */

export function CopyLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        color: "#eef0f1",
        textDecoration: "underline",
        textDecorationColor: "rgba(201,3,20,.6)",
        textUnderlineOffset: 3,
      }}
    >
      {children}
    </Link>
  );
}

/* ---- per-town content contract -------------------------------------- */

export type TownContent = {
  slug: "granbury-tx" | "fort-worth-tx" | "stephenville-tx";
  town: string;
  eyebrow: string;
  headline: ReactNode;
  lede: string;
  bodyKicker: string;
  paragraphs: ReactNode[];
  image: { src: string; alt: string };
  specs: { icon: IconName; text: string }[];
  question: { headline: string; paragraphs: ReactNode[] };
  serviceLinesHeadline: ReactNode;
  plateLede: string;
  closingHeadline: ReactNode;
  closingLede: string;
  serviceName: string;
  serviceDescription: string;
};

const SERVICE_LINES = [
  { label: "Fabrication", href: "/services/fabrication" },
  { label: "Staircases & handrail", href: "/services/structural" },
  { label: "Pipe welding", href: "/services/pipe" },
  { label: "Equipment repair", href: "/services/equipment" },
  { label: "Mobile welding", href: "/services/mobile" },
  { label: "24/7 emergency", href: "/services/emergency" },
];

const serviceJsonLd = (c: TownContent) => ({
  "@context": "https://schema.org",
  "@type": "Service",
  name: c.serviceName,
  serviceType: "Welding",
  description: c.serviceDescription,
  url: `${SITE_URL}/welder/${c.slug}`,
  areaServed: `${c.town} TX`,
  provider: { "@id": `${SITE_URL}/#business` },
});

const breadcrumbJsonLd = (c: TownContent) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: `${SITE_URL}/`,
    },
    {
      "@type": "ListItem",
      position: 2,
      name: `Welder in ${c.town}, TX`,
    },
  ],
});

export default function TownPage({ content }: { content: TownContent }) {
  return (
    <>
      <JsonLd data={serviceJsonLd(content)} />
      <JsonLd data={breadcrumbJsonLd(content)} />

      {/* ---- Breadcrumb ------------------------------------------------ */}
      <nav
        aria-label="Breadcrumb"
        className="mx-auto w-full max-w-[1280px] px-5 pt-7 sm:px-8"
      >
        <ol
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            alignItems: "center",
            gap: 10,
            whiteSpace: "nowrap",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          <li>
            <Link
              href="/"
              className="hover:text-white"
              style={{
                color: "rgba(255,255,255,.55)",
                textDecoration: "none",
              }}
            >
              Home
            </Link>
          </li>
          <li aria-hidden="true" style={{ color: "rgba(255,255,255,.3)" }}>
            /
          </li>
          <li aria-current="page" style={{ color: "rgba(255,255,255,.78)" }}>
            Welder in {content.town}, TX
          </li>
        </ol>
      </nav>

      {/* ---- Hero ------------------------------------------------------ */}
      <section className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-5 pb-14 pt-10 sm:px-8 lg:pb-18 lg:pt-16">
        <div style={kicker}>{content.eyebrow}</div>
        <h1
          className="text-[48px] sm:text-[62px] lg:text-[80px]"
          style={{
            ...displayHead,
            lineHeight: 0.88,
            letterSpacing: "-0.02em",
            textWrap: "pretty",
            maxWidth: "18ch",
          }}
        >
          {content.headline}
        </h1>
        <p style={bodyCopy}>{content.lede}</p>
        <div className="flex flex-wrap items-center gap-3.5">
          <Button variant="primary" size="lg" href="/quote">
            Request a quote
          </Button>
          <Button variant="ghost" size="lg" href={PHONE_TEL}>
            Call {PHONE_DISPLAY}
          </Button>
        </div>
      </section>

      {/* ---- Town copy ------------------------------------------------- */}
      <section className="border-t border-white/10 bg-[#0a0b0c]">
        <div className="mx-auto grid w-full max-w-[1280px] items-center gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:py-20">
          <div className="flex flex-col gap-[18px]">
            <div style={kicker}>{content.bodyKicker}</div>
            {content.paragraphs.map((p, i) => (
              <p key={i} style={bodyCopy}>
                {p}
              </p>
            ))}
          </div>
          {}
          <img
            src={content.image.src}
            alt={content.image.alt}
            style={{
              width: "100%",
              aspectRatio: "4 / 3",
              objectFit: "cover",
              display: "block",
              ...chamfer(16),
            }}
          />
        </div>
      </section>

      {/* ---- Drive time / response strip ------------------------------- */}
      <section className="border-y border-white/10 bg-[#0d0e0f]">
        <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center gap-x-9 gap-y-4 px-5 py-6 sm:gap-y-3 sm:px-8">
          {content.specs.map((s) => (
            <div key={s.text} className="flex items-center gap-3">
              <Icon name={s.icon} size={18} color="#ffb020" />
              <span style={monoSpec}>{s.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Straight answer (question H2) ----------------------------- */}
      <section className="mx-auto w-full max-w-[1280px] px-5 py-14 sm:px-8 lg:py-20">
        <div style={{ ...kicker, marginBottom: 12 }}>Straight answers</div>
        <h2
          className="text-[28px] lg:text-[36px]"
          style={{
            ...displayHead,
            lineHeight: 1,
            maxWidth: "26ch",
            marginBottom: 20,
            textWrap: "pretty",
          }}
        >
          {content.question.headline}
        </h2>
        <div className="flex flex-col gap-[18px]">
          {content.question.paragraphs.map((p, i) => (
            <p key={i} style={{ ...bodyCopy, maxWidth: "64ch" }}>
              {p}
            </p>
          ))}
        </div>
      </section>

      {/* ---- Service lines --------------------------------------------- */}
      <section className="border-t border-white/10">
        <div className="mx-auto w-full max-w-[1280px] px-5 py-14 sm:px-8 lg:py-20">
          <div style={{ ...kicker, marginBottom: 12 }}>Service lines</div>
          <h2
            className="text-[36px] lg:text-[48px]"
            style={{ ...displayHead, marginBottom: 28 }}
          >
            {content.serviceLinesHeadline}
          </h2>
          <div className="flex flex-wrap gap-3">
            {SERVICE_LINES.map((line) => (
              <Link
                key={line.href}
                href={line.href}
                className="tsws-focus-inset hover:border-white/40"
                style={{
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  background: "#0d0e0f",
                  border: "1px solid rgba(255,255,255,.14)",
                  padding: "12px 18px",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "#eef0f1",
                  ...chamfer(8),
                }}
              >
                {line.label}
                <Icon name="arrow-right" size={14} color="#c90314" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Emergency call plate (home page styling) ------------------- */}
      <section className="bg-[#0d0e0f]">
        <HazardBar variant="red" height="8px" animated />
        <div className="mx-auto grid max-w-[1280px] items-center gap-8 px-5 py-14 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:gap-12 lg:py-18">
          <div className="flex flex-col gap-4">
            <div style={{ ...kicker, color: "#ffb020" }}>
              Emergency response · On call now
            </div>
            <h2 className="text-[44px] lg:text-[62px]" style={displayHead}>
              Something&apos;s down. Call now.
            </h2>
            <p style={bodyCopy}>{content.plateLede}</p>
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
              href={PHONE_TEL}
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
                {PHONE_DISPLAY}
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
              <a href={EMAIL_MAILTO} style={{ color: "#eef0f1" }}>
                {EMAIL}
              </a>{" "}
              and mark it urgent.
            </div>
          </div>
        </div>
      </section>

      {/* ---- Closing quote CTA ------------------------------------------ */}
      <section className="border-t border-white/10 bg-[#0a0b0c]">
        <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-8 px-5 py-14 sm:px-8 lg:py-18">
          <div className="flex flex-col gap-3.5">
            <h2 className="text-[36px] lg:text-[48px]" style={displayHead}>
              {content.closingHeadline}
            </h2>
            <p style={bodyCopy}>{content.closingLede}</p>
          </div>
          <Button variant="primary" size="lg" href="/quote">
            Request a quote
          </Button>
        </div>
      </section>

      {/* Clip-path chamfers swallow the global outset focus ring; draw it inset (2.4.7). */}
      <style>{`.tsws-focus-inset:focus-visible{box-shadow:inset 0 0 0 2px var(--black-900),inset 0 0 0 4px var(--arc-blue)}`}</style>
    </>
  );
}
