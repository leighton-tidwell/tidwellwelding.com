import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { Card, Icon, MediaFrame } from "@/components/ds";
import JsonLd from "@/components/json-ld";
import {
  EMAIL,
  EMAIL_MAILTO,
  PHONE_DISPLAY,
  PHONE_TEL,
} from "@/lib/business";

const TITLE = `Contact a Welder Now: ${PHONE_DISPLAY} | Granbury to Stephenville | TSWS`;
const DESCRIPTION = `Call or text ${PHONE_DISPLAY}, any hour. Email ${EMAIL}. Granbury shop, mobile truck from Fort Worth to Stephenville. Free quotes.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/contact" },
  openGraph: {
    type: "website",
    siteName: "Tidwell Specialty Welding",
    url: "/contact",
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

/* Verbatim from contact.dc.html renderVals(). Sample reviews — never Review schema. */
const REVIEWS = [
  {
    text: "Called about a bent trailer tongue at 7 a.m. He met me in Cleburne by 10 and I hauled that afternoon.",
    name: "T. Boyd",
    meta: "Equipment owner · Cleburne",
  },
  {
    text: "We used him for pipe repairs during our spring outage. His roots passed x-ray and he kept our window.",
    name: "K. Nguyen",
    meta: "Plant maintenance · Fort Worth",
  },
  {
    text: "He built a gate and fence panels for our entry off a phone photo. The measurements came out exact.",
    name: "J. McAllen",
    meta: "Ranch owner · Glen Rose",
  },
];

/* Q&As drawn only from the FaqBot facts. Rendered rows and the FAQPage
   JSON-LD below share this array so the schema matches the page exactly. */
const FAQS = [
  {
    q: "What area do you cover?",
    a: "The shop is in Granbury, TX 76048. The truck covers the DFW metro down through Stephenville: Fort Worth, Weatherford, Cleburne, Glen Rose, Tolar, Lipan. Outside that ring, call anyway.",
  },
  {
    q: "How much does a quote cost?",
    a: "Nothing. Quotes are free, and TSWS will beat any quote you've been given.",
  },
  {
    q: "Do you take emergency calls?",
    a: `Yes. Any hour, any day. Nights, weekends, holidays. Eric drops what he's doing and comes to you. Call ${PHONE_DISPLAY}.`,
  },
  {
    q: "What materials can you weld?",
    a: "Carbon, stainless, aluminum, Inconel and chrome-moly. Pretty much you name it.",
  },
  {
    q: "Can you come to my job site?",
    a: "Yes. Eric runs a fully rigged welding truck. It meets you anywhere in the DFW, Granbury and Stephenville area.",
  },
  {
    q: "Do you work in the shop or in the field?",
    a: "Both. Shop work when the part can come in. The truck when it can't.",
  },
  {
    q: "Are you insured?",
    a: "Yes. Tidwell Specialty Welding is an LLC and carries insurance. Eric trained and tested as a welder and has run a torch since 2011.",
  },
  {
    q: "How do I get a quote?",
    a: `Call or text ${PHONE_DISPLAY}, email ${EMAIL}, or use the Request a Quote page. Send photos and rough measurements. You get working numbers the same day.`,
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

const eyebrowStyle: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,.55)",
};

const cardBodyStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 14,
  lineHeight: 1.5,
  color: "rgba(255,255,255,.68)",
  margin: 0,
};

const SERVICE_AREAS = [
  "Granbury · Home base",
  "Fort Worth",
  "Weatherford",
  "Cleburne",
  "Glen Rose",
  "Tolar · Lipan",
  "Stephenville",
  "Everywhere between",
];

export default function ContactPage() {
  return (
    <>
      <JsonLd data={faqJsonLd} />

      {/* Hero */}
      <section className="mx-auto w-full max-w-[1280px] px-5 pt-16 pb-10 sm:px-8 md:pt-[88px] md:pb-14">
        <div style={{ ...eyebrowStyle, marginBottom: 14 }}>
          Contact &amp; service area
        </div>
        <h1
          style={{
            fontStyle: "oblique 10deg",
            fontSize: "clamp(48px, 9vw, 76px)",
            lineHeight: 0.88,
            letterSpacing: "-0.02em",
            margin: 0,
          }}
        >
          Call. Eric <span style={{ color: "#c90314" }}>answers</span>.
        </h1>
      </section>

      {/* Three contact cards */}
      <section className="mx-auto grid w-full max-w-[1280px] grid-cols-1 gap-5 px-5 pb-14 sm:px-8 md:grid-cols-3 md:pb-[72px]">
        <a
          href={PHONE_TEL}
          aria-label={`Call or text Eric at ${PHONE_DISPLAY}`}
          style={{ textDecoration: "none", display: "block" }}
        >
          <Card
            interactive
            eyebrow="PHONE — 24/7"
            title={PHONE_DISPLAY}
            style={{ height: "100%" }}
          >
            <p style={cardBodyStyle}>
              Call or text, any hour. Emergencies jump the line.
            </p>
          </Card>
        </a>
        <a
          href={EMAIL_MAILTO}
          aria-label={`Email ${EMAIL}`}
          style={{ textDecoration: "none", display: "block" }}
        >
          <Card
            interactive
            eyebrow="EMAIL"
            title={<span style={{ overflowWrap: "anywhere" }}>{EMAIL}</span>}
            style={{ height: "100%" }}
          >
            <p style={cardBodyStyle}>
              Send drawings, photos and specs. Eric reads it himself.
            </p>
          </Card>
        </a>
        <Link href="/quote" style={{ textDecoration: "none", display: "block" }}>
          <Card
            interactive
            eyebrow="QUOTE — FREE"
            title="Request a quote"
            style={{ height: "100%" }}
          >
            <p style={cardBodyStyle}>
              Describe the job, attach photos, get working numbers today.
            </p>
          </Card>
        </Link>
      </section>

      {/* Service area */}
      <section
        style={{
          borderTop: "1px solid rgba(255,255,255,.1)",
          background: "#0a0b0c",
        }}
      >
        <div className="mx-auto grid w-full max-w-[1280px] grid-cols-1 items-start gap-10 px-5 py-16 sm:px-8 md:py-[88px] lg:grid-cols-2 lg:gap-14">
          <div className="flex flex-col gap-[18px]">
            <div style={eyebrowStyle}>Service area</div>
            <h2
              style={{
                fontStyle: "oblique 10deg",
                fontSize: "clamp(40px, 6vw, 52px)",
                lineHeight: 0.9,
                margin: 0,
              }}
            >
              Based in Granbury. Rolling{" "}
              <span style={{ color: "#c90314" }}>everywhere</span> near it.
            </h2>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 16,
                lineHeight: 1.55,
                color: "rgba(255,255,255,.78)",
                margin: 0,
                maxWidth: "54ch",
              }}
            >
              The shop sits in Granbury, TX 76048. The truck covers the DFW
              metro down through Stephenville. Outside that ring, call anyway.
              Eric will tell you straight if he can make it work.
            </p>
            <ul
              className="mt-1 grid grid-cols-1 gap-x-6 gap-y-3 sm:mt-0 sm:grid-cols-2 sm:gap-y-2"
              role="list"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,.7)",
                listStyle: "none",
                padding: 0,
              }}
            >
              {SERVICE_AREAS.map((area) => (
                <li key={area}>{area}</li>
              ))}
            </ul>
            <div
              className="mt-1 flex flex-wrap gap-x-5 gap-y-3 sm:mt-0 sm:gap-y-2"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              <Link href="/welder/granbury-tx" className="py-1 sm:py-0" style={{ color: "#eef0f1" }}>
                Welder in Granbury
              </Link>
              <Link href="/welder/fort-worth-tx" className="py-1 sm:py-0" style={{ color: "#eef0f1" }}>
                Welder in Fort Worth
              </Link>
              <Link href="/welder/stephenville-tx" className="py-1 sm:py-0" style={{ color: "#eef0f1" }}>
                Welder in Stephenville
              </Link>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <Icon name="clock" size={18} color="#ffb020" />
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "#ffb020",
                }}
              >
                Shop hours 7a–6p · Emergency line 24/7
              </span>
            </div>
          </div>
          <MediaFrame ratio="1 / 1" className="w-full">
            <iframe
              src="https://www.google.com/maps?q=Granbury,+TX+76048&output=embed"
              title="Map centered on Granbury, TX 76048, home base for the TSWS service area"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                border: 0,
              }}
            />
          </MediaFrame>
        </div>
      </section>

      {/* Reviews */}
      <section className="mx-auto w-full max-w-[1280px] px-5 py-16 sm:px-8 md:py-[88px]">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 md:gap-6">
          <h2
            style={{
              fontStyle: "oblique 10deg",
              fontSize: "clamp(36px, 6vw, 48px)",
              lineHeight: 0.9,
              margin: 0,
            }}
          >
            On Google.
          </h2>
          <div className="flex items-center gap-[10px]">
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
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {REVIEWS.map((r) => (
            <div
              key={r.name}
              style={{
                background: "#0d0e0f",
                border: "1px solid rgba(255,255,255,.1)",
                borderTop: "3px solid #c90314",
                padding: 24,
                clipPath:
                  "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)",
                display: "flex",
                flexDirection: "column",
                gap: 14,
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
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 15,
                  lineHeight: 1.55,
                  color: "rgba(255,255,255,.82)",
                  margin: 0,
                  flex: 1,
                }}
              >
                {r.text}
              </p>
              <div
                style={{
                  borderTop: "1px solid rgba(255,255,255,.08)",
                  paddingTop: 12,
                }}
              >
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

      {/* FAQ — crawlable, server-rendered */}
      <section
        style={{
          borderTop: "1px solid rgba(255,255,255,.1)",
          background: "#0a0b0c",
        }}
      >
        <div className="mx-auto w-full max-w-[1280px] px-5 py-16 sm:px-8 md:py-[88px]">
          <div style={{ ...eyebrowStyle, marginBottom: 14 }}>FAQ</div>
          <h2
            style={{
              fontStyle: "oblique 10deg",
              fontSize: "clamp(36px, 6vw, 48px)",
              lineHeight: 0.9,
              margin: "0 0 32px",
            }}
          >
            Before you <span style={{ color: "#c90314" }}>call</span>.
          </h2>
          <div className="contact-faq">
            {FAQS.map((f) => (
              <details key={f.q}>
                <summary>
                  <span>{f.q}</span>
                  <Icon
                    name="chevron-down"
                    size={18}
                    className="contact-faq__chev"
                  />
                </summary>
                <p className="contact-faq__a">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <style>{`
        .contact-faq{display:flex;flex-direction:column;gap:12px}
        .contact-faq details{background:var(--surface-card);border:1px solid var(--border-hairline);clip-path:var(--clip-chamfer-sm)}
        .contact-faq summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 18px;font-family:var(--font-display);font-weight:800;font-size:18px;line-height:1.1;letter-spacing:.01em;text-transform:uppercase;color:var(--white)}
        .contact-faq summary::-webkit-details-marker{display:none}
        .contact-faq summary:hover{color:var(--red-300)}
        .contact-faq summary:focus-visible{outline:2px solid var(--arc-blue);outline-offset:-2px}
        .contact-faq .contact-faq__chev{flex:none;color:var(--steel-300);transition:transform var(--dur-3) var(--ease-mech)}
        .contact-faq details[open] .contact-faq__chev{transform:rotate(180deg);color:var(--red-400)}
        .contact-faq .contact-faq__a{margin:0;padding:0 18px 18px;font-family:var(--font-body);font-size:15px;line-height:1.55;color:rgba(255,255,255,.75);max-width:70ch}
        @media (min-width:768px){
          .contact-faq summary{padding:18px 22px;font-size:20px}
          .contact-faq .contact-faq__a{padding:0 22px 20px}
        }
      `}</style>
    </>
  );
}
