import type { Metadata } from "next";
import type { ReactNode } from "react";
import Button from "@/components/ds/button";
import Icon from "@/components/ds/icon";
import MediaFrame from "@/components/ds/media-frame";
import JsonLd from "@/components/json-ld";
import styles from "./services.module.css";

const PAGE_TITLE =
  "Welding Services: Fabrication, Pipe, Equipment Repair | Granbury & Fort Worth | TSWS";
const PAGE_DESCRIPTION =
  "Six service lines out of Granbury, TX: fabrication, staircases and handrail, pipe welding, heavy equipment repair, mobile welding, 24/7 emergency.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/services" },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/services",
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
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: ["/og-card.png"],
  },
};

type Service = {
  id: "fabrication" | "structural" | "pipe" | "equipment" | "mobile" | "emergency";
  kicker: string;
  title: string;
  serviceType: string;
  body: string;
  chips: string[];
  ctaLabel: string;
  ctaHref: string;
  fullLabel: string;
  note: string;
  media: ReactNode;
};

const SERVICES: Service[] = [
  {
    id: "fabrication",
    kicker: "SERVICE 01 — FABRICATION",
    title: "Fabrication",
    serviceType: "Metal fabrication",
    body: "The core of the business. Frames, brackets, gates, trailers, one-off parts and full builds. Bring drawings, a sketch on a napkin, or a photo of the space it has to fit. Eric builds to the spec and holds the tolerance.",
    chips: ["Carbon", "Stainless", "Aluminum", "From drawings or photos"],
    ctaLabel: "Request a quote",
    ctaHref: "/quote",
    fullLabel: "Full fabrication page",
    note: "Shop · Granbury",
    media: (
       
      <img
        className={styles.mediaEl}
        src="/media/gate-fabrication.webp"
        alt="Grinding a fabricated carbon steel gate frame, sparks flying, Granbury TX"
      />
    ),
  },
  {
    id: "structural",
    kicker: "SERVICE 02 — STRUCTURAL",
    title: "Staircases & handrail",
    serviceType: "Structural steel welding",
    body: "Commercial staircase packages and handrail that reads clean from a foot away. A recent package ran three welders and 150 man-hours for a distribution facility, built over two weekends so the floor stayed open. Plumb, square, ready for inspection.",
    chips: ["Commercial packages", "Handrail runs", "Structural steel"],
    ctaLabel: "Request a quote",
    ctaHref: "/quote",
    fullLabel: "Full staircase & handrail page",
    note: "Shop + field install",
    media: (
       
      <img
        className={styles.mediaEl}
        src="/media/custom-handrail.webp"
        alt="Installed interior steel handrail with cable infill"
      />
    ),
  },
  {
    id: "pipe",
    kicker: "SERVICE 03 — PIPE",
    title: "Pipe welding",
    serviceType: "Pipe welding",
    body: "Eric's road years: paper mills, chemical plants, refineries, pipeline stations and pipeline itself. Tie-ins, repairs and new runs in carbon, stainless, chrome-moly and Inconel. Roots that pass, caps that look it.",
    chips: ["Process pipe", "Pipeline & stations", "Chrome-moly", "Inconel"],
    ctaLabel: "Request a quote",
    ctaHref: "/quote",
    fullLabel: "Full pipe welding page",
    note: "Field + shop",
    media: (
      <video
        className={`${styles.mediaEl} ${styles.mediaVideo}`}
        src="/media/stainless-16in-closeup.mp4"
        poster="/media/stainless-16in-closeup-poster.jpg"
        controls
        muted
        playsInline
        preload="metadata"
        aria-label="Weld close-up on 16 inch stainless pipe"
      />
    ),
  },
  {
    id: "equipment",
    kicker: "SERVICE 04 — EQUIPMENT",
    title: "Heavy equipment repair",
    serviceType: "Heavy equipment welding repair",
    body: "Cracked bucket ears, worn pins, split tank seams, hot oil beds. Eric has repaired them at the plant, on the pad and in the pasture. The repair holds under load or he comes back on his dime.",
    chips: ["Buckets & booms", "Frac tanks", "Hot oil beds", "Frames"],
    ctaLabel: "Request a quote",
    ctaHref: "/quote",
    fullLabel: "Full equipment repair page",
    note: "Field-first",
    media: (
       
      <img
        className={styles.mediaEl}
        src="/media/bulldozer-reinforcement-plate.webp"
        alt="Reinforcement plate welded onto a bulldozer bucket in the field"
      />
    ),
  },
  {
    id: "mobile",
    kicker: "SERVICE 05 — MOBILE",
    title: "Mobile welding",
    serviceType: "Mobile welding",
    body: "The truck carries the shop: machine, leads, gas, grinders, consumables. It rolls to ranches, plants, job sites and roadsides anywhere between DFW and Stephenville. The welder who quotes the job is the welder who shows up.",
    chips: ["Rigged truck", "On-site", "Same welder"],
    ctaLabel: "Request a quote",
    ctaHref: "/quote",
    fullLabel: "Full mobile welding page",
    note: "DFW to Stephenville",
    media: (
       
      <img
        className={styles.mediaEl}
        src="/media/welding-rig-at-work.webp"
        alt="TSWS mobile welding rig set up on a job site, Granbury TX"
      />
    ),
  },
  {
    id: "emergency",
    kicker: "SERVICE 06 — EMERGENCY",
    title: "Emergency & on-call",
    serviceType: "Emergency welding",
    body: "Breakdowns don't book appointments. Call any hour and Eric drops what he's doing, loads the truck and drives to you. Plants get lines running, ranchers get equipment back in the field, contractors hold their schedule.",
    chips: ["Nights", "Weekends", "Holidays"],
    ctaLabel: "Call (817) 894-6357",
    ctaHref: "tel:8178946357",
    fullLabel: "Full emergency page",
    note: "24/7 · Any hour",
    media: (
      <MediaFrame
        ratio="4 / 3"
        src="/media/cracked-equipment-repair.webp"
        alt="Field repair weld on a John Deere excavator boom, truck alongside, Granbury TX"
      />
    ),
  },
];

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

const serviceJsonLd = (service: Service) => ({
  "@context": "https://schema.org",
  "@type": "Service",
  "@id": `https://tidwellwelding.com/services/${service.id}#service`,
  name: service.title,
  serviceType: service.serviceType,
  description: service.body,
  url: `https://tidwellwelding.com/services/${service.id}`,
  provider: { "@id": "https://tidwellwelding.com/#business" },
  areaServed: AREA_SERVED,
});

export default function ServicesPage() {
  return (
    <>
      {SERVICES.map((service) => (
        <JsonLd key={service.id} data={serviceJsonLd(service)} />
      ))}

      <section className={styles.hero}>
        <div className={styles.heroKicker}>Capability sheet</div>
        <h1 className={styles.heroTitle}>
          Ask for the spec. You&apos;ll get the{" "}
          <span className={styles.accent}>spec</span>.
        </h1>
        <p className={styles.heroLede}>
          Six service lines, one standard. Nothing leaves the shop unless the
          welds pass Eric&apos;s eye. Every job, start to finish.
        </p>
      </section>

      <div className={styles.list}>
        {SERVICES.map((service) => (
          <section key={service.id} id={service.id} className={styles.service}>
            <div className={styles.serviceBody}>
              <div className={styles.serviceKicker}>{service.kicker}</div>
              <h2 className={styles.serviceTitle}>{service.title}</h2>
              <p className={styles.serviceCopy}>{service.body}</p>
              <div className={styles.chips}>
                {service.chips.map((chip) => (
                  <span key={chip} className={styles.chip}>
                    {chip}
                  </span>
                ))}
              </div>
              <div className={styles.serviceCta}>
                <Button variant="secondary" href={service.ctaHref}>
                  {service.ctaLabel}
                </Button>
                <Button
                  variant="quiet"
                  href={`/services/${service.id}`}
                  iconRight={<Icon name="arrow-right" size={14} />}
                >
                  {service.fullLabel}
                </Button>
                <span className={styles.serviceNote}>{service.note}</span>
              </div>
            </div>
            <div className={styles.serviceMedia}>{service.media}</div>
          </section>
        ))}
      </div>

      <section className={styles.beat}>
        <div className={styles.beatInner}>
          <div>
            <h2 className={styles.beatTitle}>
              Send us the quote you got. We&apos;ll{" "}
              <span className={styles.accent}>beat</span> it.
            </h2>
            <p className={styles.beatLede}>
              Quotes are free. Attach the competitor&apos;s number to your
              request.
            </p>
          </div>
          <Button variant="primary" size="lg" href="/quote">
            Start the estimate
          </Button>
        </div>
      </section>
    </>
  );
}
