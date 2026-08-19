import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import Button from "@/components/ds/button";
import Icon from "@/components/ds/icon";
import type { IconName } from "@/components/ds/icon";
import JsonLd from "@/components/json-ld";
import { PHONE_DISPLAY, PHONE_TEL, SITE_URL } from "@/lib/business";

/* ---- shared inline type styles (same idiom as the town pages) ------- */

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
  maxWidth: "58ch",
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

const chipStyle: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "#eef0f1",
  border: "1px solid rgba(255,255,255,.16)",
  padding: "6px 10px",
  ...chamfer(6),
};

const mediaStyle: CSSProperties = {
  width: "100%",
  aspectRatio: "4 / 3",
  objectFit: "cover",
  display: "block",
  ...chamfer(16),
};

/* ---- per-service content contract ----------------------------------- */

export type ServiceMedia =
  | { kind: "image"; src: string; alt: string }
  | { kind: "video"; src: string; poster: string; label: string };

export type ServiceSection = {
  kicker: string;
  heading: string;
  paragraphs: ReactNode[];
};

export type ServicePageContent = {
  slug:
    | "fabrication"
    | "structural"
    | "pipe"
    | "equipment"
    | "mobile"
    | "emergency";
  breadcrumbName: string;
  eyebrow: string;
  headline: ReactNode;
  lede: string;
  sections: ServiceSection[];
  media: ServiceMedia[];
  chips: string[];
  specs: { icon: IconName; text: string }[];
  related: { label: string; href: string }[];
  closingHeadline: ReactNode;
  closingLede: string;
  closingPrimary: { label: string; href: string };
  closingSecondary: { label: string; href: string };
  serviceName: string;
  serviceType: string;
  serviceDescription: string;
};

const AREA_SERVED = [
  "Granbury TX",
  "Fort Worth TX",
  "Weatherford TX",
  "Cleburne TX",
  "Glen Rose TX",
  "Tolar TX",
  "Lipan TX",
  "Stephenville TX",
];

const serviceJsonLd = (c: ServicePageContent) => ({
  "@context": "https://schema.org",
  "@type": "Service",
  "@id": `${SITE_URL}/services/${c.slug}#service`,
  name: c.serviceName,
  serviceType: c.serviceType,
  description: c.serviceDescription,
  url: `${SITE_URL}/services/${c.slug}`,
  provider: { "@id": `${SITE_URL}/#business` },
  areaServed: AREA_SERVED,
});

/* Same shape as the town-page breadcrumbs: last item carries no `item`. */
const breadcrumbJsonLd = (c: ServicePageContent) => ({
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
      name: "Services",
      item: `${SITE_URL}/services`,
    },
    { "@type": "ListItem", position: 3, name: c.breadcrumbName },
  ],
});

export default function ServicePage({
  content,
}: {
  content: ServicePageContent;
}) {
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
          className="flex flex-wrap items-center gap-2"
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          <li>
            <Link
              href="/"
              className="text-white/55 hover:text-white"
              style={{ borderBottom: 0 }}
            >
              Home
            </Link>
          </li>
          <li aria-hidden="true" className="text-white/30">
            /
          </li>
          <li>
            <Link
              href="/services"
              className="text-white/55 hover:text-white"
              style={{ borderBottom: 0 }}
            >
              Services
            </Link>
          </li>
          <li aria-hidden="true" className="text-white/30">
            /
          </li>
          <li aria-current="page" className="text-white/85">
            {content.breadcrumbName}
          </li>
        </ol>
      </nav>

      {/* ---- Hero ------------------------------------------------------ */}
      <section className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-5 pb-12 pt-8 sm:px-8 lg:pb-16 lg:pt-12">
        <div style={kicker}>{content.eyebrow}</div>
        <h1
          className="text-[44px] sm:text-[58px] lg:text-[72px]"
          style={{
            ...displayHead,
            lineHeight: 0.88,
            letterSpacing: "-0.02em",
            textWrap: "pretty",
            maxWidth: "20ch",
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

      {/* ---- Copy + media ---------------------------------------------- */}
      <section className="border-t border-white/10 bg-[#0a0b0c]">
        <div className="mx-auto grid w-full max-w-[1280px] gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:py-20">
          <div className="flex flex-col gap-10">
            {content.sections.map((section) => (
              <div key={section.heading} className="flex flex-col gap-[14px]">
                <div style={kicker}>{section.kicker}</div>
                <h2
                  className="text-[30px] lg:text-[38px]"
                  style={{ ...displayHead, lineHeight: 0.95 }}
                >
                  {section.heading}
                </h2>
                {section.paragraphs.map((paragraph, index) => (
                  <p key={index} style={bodyCopy}>
                    {paragraph}
                  </p>
                ))}
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              {content.chips.map((chip) => (
                <span key={chip} style={chipStyle}>
                  {chip}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-6 lg:sticky lg:top-28 lg:self-start">
            {content.media.map((m, index) =>
              m.kind === "image" ? (

                <img
                  key={m.src}
                  src={m.src}
                  alt={m.alt}
                  loading={index === 0 ? undefined : "lazy"}
                  style={mediaStyle}
                />
              ) : (
                <video
                  key={m.src}
                  src={m.src}
                  poster={m.poster}
                  controls
                  muted
                  playsInline
                  preload="metadata"
                  aria-label={m.label}
                  style={{ ...mediaStyle, background: "#000" }}
                />
              ),
            )}
          </div>
        </div>
      </section>

      {/* ---- Spec strip ------------------------------------------------ */}
      <section className="border-y border-white/10 bg-[#0d0e0f]">
        <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center gap-x-9 gap-y-4 px-5 py-6 sm:gap-y-3 sm:px-8">
          {content.specs.map((spec) => (
            <div key={spec.text} className="flex items-center gap-3">
              <Icon name={spec.icon} size={18} color="#ffb020" />
              <span style={monoSpec}>{spec.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Related pages --------------------------------------------- */}
      <section className="mx-auto w-full max-w-[1280px] px-5 py-12 sm:px-8 lg:py-16">
        <div style={{ ...kicker, marginBottom: 16 }}>Related pages</div>
        <div className="flex flex-wrap gap-3">
          {content.related.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:border-white/40"
              style={{
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
              {link.label}
              <Icon name="arrow-right" size={14} color="#c90314" />
            </Link>
          ))}
        </div>
      </section>

      {/* ---- Closing CTA ------------------------------------------------ */}
      <section className="border-t border-white/10 bg-[#0a0b0c]">
        <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-8 px-5 py-14 sm:px-8 lg:py-18">
          <div className="flex flex-col gap-3.5">
            <h2 className="text-[36px] lg:text-[48px]" style={displayHead}>
              {content.closingHeadline}
            </h2>
            <p style={bodyCopy}>{content.closingLede}</p>
          </div>
          <div className="flex flex-wrap gap-3.5">
            <Button
              variant="primary"
              size="lg"
              href={content.closingPrimary.href}
            >
              {content.closingPrimary.label}
            </Button>
            <Button
              variant="ghost"
              size="lg"
              href={content.closingSecondary.href}
            >
              {content.closingSecondary.label}
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
