import type { Metadata } from "next";
import Link from "next/link";
import ServicePage, { type ServicePageContent } from "../service-page";

const TITLE =
  "Staircase & Handrail Welding in Granbury, TX | Tidwell Specialty Welding";
const DESCRIPTION =
  "Commercial staircases, handrail and structural steel from Granbury, TX. Shop built, field installed, inspection-ready. Free quotes. Call (817) 894-6357.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/services/structural" },
  openGraph: {
    type: "website",
    siteName: "Tidwell Specialty Welding",
    url: "/services/structural",
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

const CONTENT: ServicePageContent = {
  slug: "structural",
  breadcrumbName: "Staircases & handrail",
  eyebrow: "Service — Structural · Shop + field install",
  headline: (
    <>
      Staircases and handrail that pass the{" "}
      <span style={{ color: "#c90314" }}>walk</span>.
    </>
  ),
  lede: "Commercial staircase packages, handrail runs and structural steel welding out of Granbury, TX. Shop built, field installed, ready for inspection.",
  sections: [
    {
      kicker: "Commercial packages",
      heading: "Staircase packages, built around your floor.",
      paragraphs: [
        <>
          A recent package ran three welders and 150 man-hours for a
          distribution facility in the{" "}
          <Link href="/welder/fort-worth-tx">Fort Worth</Link> area. The crew
          built it over two weekends so the floor stayed open. Plumb, square,
          ready for inspection.
        </>,
        "Bigger structural jobs run with a crew of two to three welders. Each runs his own shop and works under TSWS on the package. Eric inspects every weld the way he inspects his own.",
      ],
    },
    {
      kicker: "Handrail",
      heading: "Handrail that reads clean from a foot away.",
      paragraphs: [
        <>
          The <Link href="/work">job log</Link> holds an interior cable-rail
          handrail from a staircase remodel. Square, plumb and blended joints
          inside a finished house. Outdoor railing runs get the same treatment.
        </>,
        "Handrail has one test. Put a hand on it and look down the run. The welds should read clean from a foot away. The line should hold straight.",
      ],
    },
    {
      kicker: "Shop and field",
      heading: "Built in Granbury. Installed where it lives.",
      paragraphs: [
        "Structural steel gets welded in the Granbury shop, then installed in the field. Fort Worth is about 45 minutes out. Stephenville is about 40 minutes down 377. The truck covers everything between.",
        "Send drawings or photos of the stair opening. Rough sizes are enough to start. Quotes are free, and working numbers come back the same day.",
        "Smaller rail jobs move fast. A porch rail or a short run rides the truck out and gets welded in place.",
      ],
    },
  ],
  media: [
    {
      kind: "image",
      src: "/media/custom-handrail.webp",
      alt: "Installed interior steel handrail with cable infill",
    },
    {
      kind: "video",
      src: "/media/outdoor-railing.mp4",
      poster: "/media/outdoor-railing-poster.jpg",
      label: "Outdoor steel railing run, welded and installed",
    },
  ],
  chips: [
    "Commercial packages",
    "Handrail runs",
    "Structural steel",
    "Shop + field install",
  ],
  specs: [
    { icon: "hard-hat", text: "Commercial staircase packages" },
    { icon: "users", text: "Crew of two to three welders on big jobs" },
    { icon: "check", text: "Plumb · square · inspection-ready" },
  ],
  related: [
    { label: "Fabrication", href: "/services/fabrication" },
    { label: "Welder in Fort Worth, TX", href: "/welder/fort-worth-tx" },
    { label: "See the job log", href: "/work" },
  ],
  closingHeadline: (
    <>
      Got a stair package bid? We{" "}
      <span style={{ color: "#c90314" }}>beat</span> it.
    </>
  ),
  closingLede: "Quotes are free. Attach the other shop's number.",
  closingPrimary: { label: "Request a quote", href: "/quote" },
  closingSecondary: { label: "Call (817) 894-6357", href: "tel:8178946357" },
  serviceName: "Staircases & handrail",
  serviceType: "Structural steel welding",
  serviceDescription: DESCRIPTION,
};

export default function StructuralPage() {
  return <ServicePage content={CONTENT} />;
}
