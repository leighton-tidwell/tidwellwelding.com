import type { Metadata } from "next";
import Link from "next/link";
import ServicePage, { type ServicePageContent } from "../service-page";

const TITLE = "Pipe Welding in Granbury, TX | Tidwell Specialty Welding";
const DESCRIPTION =
  "Pipe welding in Granbury, TX. Tie-ins, repairs and new runs in carbon, stainless, chrome-moly and Inconel. TIG roots and caps. Call (817) 894-6357.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/services/pipe" },
  openGraph: {
    type: "website",
    siteName: "Tidwell Specialty Welding",
    url: "/services/pipe",
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: "/media/heavy-wall-8in-stainless.jpg",
        alt: "Heavy wall stainless piece with flanges, purged TIG roots and caps",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/media/heavy-wall-8in-stainless.jpg"],
  },
};

const CONTENT: ServicePageContent = {
  slug: "pipe",
  breadcrumbName: "Pipe welding",
  eyebrow: "Service — Pipe · Field + shop",
  headline: (
    <>
      Pipe welding. Roots that <span style={{ color: "#c90314" }}>pass</span>.
    </>
  ),
  lede: "Pipe welding in Granbury, TX and across the DFW to Stephenville corridor. Tie-ins, repairs and new runs. Roots that pass, caps that look it.",
  sections: [
    {
      kicker: "The road years",
      heading: "Trained on plants, mills and pipeline.",
      paragraphs: [
        "Eric's road years built this service line. Paper mills, chemical plants, refineries, pipeline stations and pipeline itself. He started in a Granbury fab shop in 2011 and worked shop to shop from there.",
        "That history matters on pipe. Plant work runs on outage windows and inspection. A welder who has lived inside those windows plans the job around them.",
      ],
    },
    {
      kicker: "Materials and process",
      heading: "Carbon, stainless, chrome-moly and Inconel.",
      paragraphs: [
        <>
          The <Link href="/work">job log</Link> shows purged TIG roots and caps
          on 8 inch heavy wall stainless. The heat tint tells you the purge
          held. Flanged 304 spool pieces sit next to it, welds left as-run.
        </>,
        "Carbon and stainless cover most calls. Chrome-moly and Inconel come off the same torch when the spec asks for them.",
        "Roots get purged when the metal calls for it. Caps get left the way they ran. Look close at the 16 inch stainless video. That is the working standard, not a highlight reel.",
      ],
    },
    {
      kicker: "Shop spools, field tie-ins",
      heading: "Where the pipe work happens.",
      paragraphs: [
        <>
          Spool pieces get built in the Granbury shop and hauled out. Tie-ins
          and repairs happen in the field, on the pad or inside the plant.
          Plants around <Link href="/welder/fort-worth-tx">Fort Worth</Link>{" "}
          call for repairs inside outage windows. Breakdowns get the truck the
          same day.
        </>,
        <>
          Send photos of the joint, the line size and the material. Working
          numbers come back the same day. Quotes are free, and the{" "}
          <Link href="/services/emergency">emergency line</Link> runs 24/7.
        </>,
      ],
    },
  ],
  media: [
    {
      kind: "video",
      src: "/media/stainless-16in-closeup.mp4",
      poster: "/media/stainless-16in-closeup-poster.jpg",
      label: "Weld close-up on 16 inch stainless pipe",
    },
    {
      kind: "image",
      src: "/media/heavy-wall-8in-stainless.webp",
      alt: "Heavy wall 8 inch stainless piece with flanges, purged TIG roots and caps",
    },
  ],
  chips: [
    "Process pipe",
    "Pipeline & stations",
    "Purged TIG",
    "Chrome-moly",
    "Inconel",
  ],
  specs: [
    { icon: "flame", text: "TIG roots and caps" },
    { icon: "wrench", text: "Carbon · stainless · chrome-moly · Inconel" },
    { icon: "clock", text: "Emergency line 24/7 · (817) 894-6357" },
  ],
  related: [
    { label: "24/7 emergency", href: "/services/emergency" },
    { label: "Fabrication", href: "/services/fabrication" },
    { label: "Welder in Fort Worth, TX", href: "/welder/fort-worth-tx" },
  ],
  closingHeadline: (
    <>
      Send the joint. Get a <span style={{ color: "#c90314" }}>number</span>.
    </>
  ),
  closingLede:
    "Quotes are free. Line size, material and photos start the estimate.",
  closingPrimary: { label: "Request a quote", href: "/quote" },
  closingSecondary: { label: "Call (817) 894-6357", href: "tel:8178946357" },
  serviceName: "Pipe welding",
  serviceType: "Pipe welding",
  serviceDescription: DESCRIPTION,
};

export default function PipeWeldingPage() {
  return <ServicePage content={CONTENT} />;
}
