import type { Metadata } from "next";
import Link from "next/link";
import ServicePage, { type ServicePageContent } from "../service-page";

const TITLE =
  "Custom Metal Fabrication in Granbury, TX | Tidwell Specialty Welding";
const DESCRIPTION =
  "Custom metal fabrication in Granbury, TX. Gates, frames, trailers and one-off builds in carbon, stainless and aluminum. Free quotes. Call (817) 894-6357.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/services/fabrication" },
  openGraph: {
    type: "website",
    siteName: "Tidwell Specialty Welding",
    url: "/services/fabrication",
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
  slug: "fabrication",
  breadcrumbName: "Fabrication",
  eyebrow: "Service — Fabrication · Granbury, TX",
  headline: (
    <>
      Fabrication. Built to the <span style={{ color: "#c90314" }}>spec</span>.
    </>
  ),
  lede: "Custom metal fabrication in Granbury, TX. Frames, gates, trailers, one-off parts and full builds. Fabrication is the core of the business.",
  sections: [
    {
      kicker: "What comes out of the shop",
      heading: "Gates, frames, trailers and one-off builds.",
      paragraphs: [
        <>
          The <Link href="/work">job log</Link> shows the range. A steel-framed
          gate skinned in creosote boards, hung to match the fence line.
          Steel-framed water trough bays under a metal barn. A custom chute
          built for an asphalt plant.
        </>,
        "Porch gates, carports, brackets and trailer frames run through the same shop. One-off parts get built to fit the space they live in. Full builds start from steel and a plan.",
      ],
    },
    {
      kicker: "Materials and standard",
      heading: "Carbon, stainless and aluminum.",
      paragraphs: [
        "Carbon steel carries most builds. Stainless shows in the job log: 304 elbows with slip-on flanges, TIG start to finish. Aluminum runs through the same shop.",
        "The standard does not move. Eric builds to the spec and holds the tolerance. If a weld wouldn't pass his eye, it doesn't leave the shop. That covers crew work too.",
      ],
    },
    {
      kicker: "How to start",
      heading: "Bring a drawing. Or a napkin.",
      paragraphs: [
        "Bring drawings, a sketch on a napkin, or a photo of the space it has to fit. Send photos with rough sizes and working numbers come back the same day. Quotes are free.",
        <>
          The shop sits in <Link href="/welder/granbury-tx">Granbury, TX</Link>{" "}
          76048, a few minutes off the square. Drop parts any day. If the gate
          is shut, call and Eric will meet you.
        </>,
        <>
          Field installs ride the rigged truck. Gates get hung on site. Rail
          gets blended inside finished houses. The{" "}
          <Link href="/services/mobile">mobile welding page</Link> covers the
          run.
        </>,
      ],
    },
  ],
  media: [
    {
      kind: "image",
      src: "/media/gate-fabrication.webp",
      alt: "Grinding a fabricated carbon steel gate frame, sparks flying, Granbury TX",
    },
    {
      kind: "video",
      src: "/media/creosote-gate.mp4",
      poster: "/media/creosote-gate-poster.jpg",
      label: "Steel-framed custom gate skinned in creosote boards",
    },
  ],
  chips: [
    "Carbon",
    "Stainless",
    "Aluminum",
    "From drawings or photos",
    "Shop · Granbury 76048",
  ],
  specs: [
    { icon: "wrench", text: "Shop fabrication — Granbury, TX 76048" },
    { icon: "ruler", text: "Built from drawings, sketches or photos" },
    { icon: "file-text", text: "Free quotes · send the bid, we beat it" },
  ],
  related: [
    { label: "Staircases & handrail", href: "/services/structural" },
    { label: "Mobile welding", href: "/services/mobile" },
    { label: "Welder in Granbury, TX", href: "/welder/granbury-tx" },
    { label: "See the job log", href: "/work" },
  ],
  closingHeadline: (
    <>
      Send the drawing. Or the <span style={{ color: "#c90314" }}>napkin</span>.
    </>
  ),
  closingLede:
    "Quotes are free. Attach photos and rough sizes. Working numbers come back the same day.",
  closingPrimary: { label: "Request a quote", href: "/quote" },
  closingSecondary: { label: "Call (817) 894-6357", href: "tel:8178946357" },
  serviceName: "Fabrication",
  serviceType: "Metal fabrication",
  serviceDescription: DESCRIPTION,
};

export default function FabricationPage() {
  return <ServicePage content={CONTENT} />;
}
