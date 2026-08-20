import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { BadgeImg } from "@/components/badge-img";
import { Button, Card, MediaFrame } from "@/components/ds";

const TITLE =
  "Eric Tidwell, Welder Since 2011 | Tidwell Specialty Welding, Granbury TX";
const DESCRIPTION =
  "Eric Tidwell started welding in 2011. He runs Tidwell Specialty Welding from Granbury, TX as a one-man shop with one standard for every weld.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/about" },
  openGraph: {
    type: "website",
    siteName: "Tidwell Specialty Welding",
    url: "/about",
    title: TITLE,
    description: DESCRIPTION,
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
};

const bodyParaStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 17,
  lineHeight: 1.6,
  color: "rgba(255,255,255,.78)",
  margin: 0,
  maxWidth: "58ch",
};

const cardParaStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 14,
  lineHeight: 1.5,
  color: "rgba(255,255,255,.68)",
  margin: 0,
};

const shopCards = [
  {
    eyebrow: "SHOP — WHO",
    title: "Same hands, every step",
    text: "Eric quotes the job, welds the job and hands it back. No subs, no handoffs, nobody else to point at.",
  },
  {
    eyebrow: "SHOP — STANDARD",
    title: "One set of eyes",
    text: "Every weld passes the same eye before it leaves. If it wouldn't pass his, it doesn't ship.",
  },
  {
    eyebrow: "SHOP — SCHEDULE",
    title: "One job at a time",
    text: "One welder books one job at a time. You get a straight answer on when it starts and when it's done.",
  },
] as const;

export default function AboutPage() {
  return (
    <>
      {/* Owner hero */}
      <section className="mx-auto grid w-full max-w-[1280px] grid-cols-1 items-start gap-10 px-6 pt-14 pb-12 md:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-[56px] lg:pt-[88px] lg:pb-[72px]">
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={kickerStyle}>The owner</div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 900,
              fontStyle: "oblique 10deg",
              fontSize: "clamp(46px, 6vw, 76px)",
              lineHeight: 0.88,
              letterSpacing: "-0.02em",
              textTransform: "uppercase",
              color: "#ffffff",
              margin: 0,
            }}
          >
            Eric Tidwell. 16 years on the{" "}
            <span style={{ color: "#c90314" }}>torch</span>.
          </h1>
          <p style={bodyParaStyle}>
            Eric started in a Granbury fab shop in 2011 and worked shop to shop
            from there: paper mills, chemical plants, refineries, pipeline
            stations and pipeline itself. He repaired heavy equipment, hot oil
            beds and frac tanks along the way. In carbon, stainless, aluminum,
            Inconel and chrome-moly.
          </p>
          <p style={bodyParaStyle}>
            He trained and tested on the torch, filed the LLC and carries insurance. The
            standard is simple: if a weld wouldn&apos;t pass his eye, it
            doesn&apos;t leave the shop. Every job, no exceptions.
          </p>
          <p style={bodyParaStyle}>
            The company has a reason. Eric and his wife Paige, a Fort Worth
            hairstylist of ten years, have three kids. TSWS lets him build at
            home instead of living on the road.
          </p>
          <div
            style={{
              display: "flex",
              gap: 20,
              flexWrap: "wrap",
              borderTop: "1px solid rgba(255,255,255,.1)",
              paddingTop: 18,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,.55)",
            }}
          >
            <span>Welding since 2011</span>
            <span aria-hidden="true">◆</span>
            <span>Trained and tested</span>
            <span aria-hidden="true">◆</span>
            <span>Tidwell Specialty Welding Services, LLC</span>
            <span aria-hidden="true">◆</span>
            <span>Insured</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <MediaFrame
            ratio="4 / 5"
            src="/media/eric-tidwell.webp"
            alt="Eric Tidwell in the truck after a shift, FR gear on, Granbury TX"
          />
          <BadgeImg
            src="/logo-badge-metal.webp"
            alt="TSWS badge on distressed metal"
            style={{
              width: "100%",
              display: "block",
              border: "1px solid rgba(255,255,255,.1)",
            }}
          />
        </div>
      </section>

      {/* Shop */}
      <section
        style={{
          borderTop: "1px solid rgba(255,255,255,.1)",
          background: "#0a0b0c",
        }}
      >
        <div className="mx-auto w-full max-w-[1280px] px-6 py-14 md:px-8 lg:py-[88px]">
          <div style={{ ...kickerStyle, marginBottom: 14 }}>The shop</div>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 900,
              fontStyle: "oblique 10deg",
              fontSize: "clamp(38px, 4.5vw, 56px)",
              lineHeight: 0.9,
              textTransform: "uppercase",
              color: "#ffffff",
              margin: "0 0 40px",
            }}
          >
            One welder. Start to{" "}
            <span style={{ color: "#c90314" }}>finish</span>.
          </h2>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {shopCards.map((card) => (
              <Card key={card.eyebrow} eyebrow={card.eyebrow} title={card.title}>
                <p style={cardParaStyle}>{card.text}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ borderTop: "1px solid rgba(255,255,255,.1)" }}>
        <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-8 px-6 py-12 md:px-8 lg:py-[72px]">
          <div>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 900,
                fontStyle: "oblique 10deg",
                fontSize: "clamp(34px, 4vw, 48px)",
                lineHeight: 0.9,
                textTransform: "uppercase",
                color: "#ffffff",
                margin: 0,
              }}
            >
              Talk to the welder, not a{" "}
              <span style={{ color: "#c90314" }}>desk</span>.
            </h2>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 16,
                color: "rgba(255,255,255,.7)",
                margin: "12px 0 0",
              }}
            >
              Eric quotes the job, welds the job and answers the phone.
            </p>
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <Button variant="primary" size="lg" href="/quote">
              Request a quote
            </Button>
            <Button variant="ghost" size="lg" href="tel:8178946357">
              Call (817) 894-6357
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
