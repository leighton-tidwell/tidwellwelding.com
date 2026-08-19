import type { Metadata } from "next";
import Link from "next/link";
import ServicePage, { type ServicePageContent } from "../service-page";

const TITLE =
  "Mobile Welding, Granbury TX to DFW & Stephenville | Tidwell Specialty Welding";
const DESCRIPTION =
  "Mobile welding from Granbury, TX. The rigged truck covers DFW to Stephenville: ranches, plants, job sites, roadsides. Free quotes. Call (817) 894-6357.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/services/mobile" },
  openGraph: {
    type: "website",
    siteName: "Tidwell Specialty Welding",
    url: "/services/mobile",
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
  slug: "mobile",
  breadcrumbName: "Mobile welding",
  eyebrow: "Service — Mobile · DFW to Stephenville",
  headline: (
    <>
      The truck carries the <span style={{ color: "#c90314" }}>shop</span>.
    </>
  ),
  lede: "Mobile welding across the DFW to Stephenville corridor, based in Granbury, TX. If the part can't come in, the truck goes out.",
  sections: [
    {
      kicker: "The rig",
      heading: "Rigged, stocked and ready to burn rod.",
      paragraphs: [
        "The truck carries the shop: machine, leads, gas, grinders and consumables. It arrives rigged and burns rod within minutes. No trips back for the basics.",
        "The welder who quotes the job is the welder who shows up. Eric drives the truck, runs the welds and answers the phone.",
      ],
    },
    {
      kicker: "Where it rolls",
      heading: "Ranches, plants, job sites and roadsides.",
      paragraphs: [
        <>
          The rig rolls anywhere between DFW and Stephenville.{" "}
          <Link href="/welder/granbury-tx">Granbury</Link>,{" "}
          <Link href="/welder/fort-worth-tx">Fort Worth</Link>, Weatherford,
          Cleburne, Glen Rose, Tolar, Lipan and{" "}
          <Link href="/welder/stephenville-tx">Stephenville</Link> sit inside
          the run.
        </>,
        "Drive times stay short. Fort Worth is about 45 minutes from the Granbury shop. Stephenville is about 40 minutes down 377. Home base is Granbury, TX 76048.",
      ],
    },
    {
      kicker: "Typical calls",
      heading: "The jobs that meet the truck.",
      paragraphs: [
        "Ranch gates and fence corners. Cracked loader buckets in the pasture. Plant repairs that have to land inside a window. Trailers dead on the shoulder. The truck meets all of them where they sit.",
        <>
          Field work from the <Link href="/work">job log</Link>: a
          reinforcement plate cut, fit and welded onto a dozer bucket on
          location. Water trough bays framed, squared and set on the pad.
        </>,
        <>
          Send photos, rough sizes and the location. Working numbers come back
          the same day. Quotes are free, and the{" "}
          <Link href="/services/emergency">emergency line</Link> runs 24/7.
        </>,
      ],
    },
  ],
  media: [
    {
      kind: "video",
      src: "/media/rig-rear-slowmo.mp4",
      poster: "/media/rig-rear-slowmo-poster.jpg",
      label: "Rear of the TSWS welding rig rolling in slow motion",
    },
    {
      kind: "image",
      src: "/media/fence-weld-closeup.webp",
      alt: "Close-up of a welded fence joint from a field repair",
    },
  ],
  chips: ["Rigged truck", "On-site", "Same welder", "DFW to Stephenville"],
  specs: [
    { icon: "truck", text: "Rigged truck · burns rod within minutes" },
    { icon: "map-pin", text: "Home base — Granbury, TX 76048" },
    { icon: "clock", text: "24/7 emergency line · (817) 894-6357" },
  ],
  related: [
    { label: "24/7 emergency", href: "/services/emergency" },
    { label: "Welder in Granbury, TX", href: "/welder/granbury-tx" },
    { label: "Welder in Fort Worth, TX", href: "/welder/fort-worth-tx" },
    { label: "Welder in Stephenville, TX", href: "/welder/stephenville-tx" },
  ],
  closingHeadline: (
    <>
      Name the spot. The rig <span style={{ color: "#c90314" }}>rolls</span>.
    </>
  ),
  closingLede: "Quotes are free. Send photos, rough sizes and the location.",
  closingPrimary: { label: "Request a quote", href: "/quote" },
  closingSecondary: { label: "Call (817) 894-6357", href: "tel:8178946357" },
  serviceName: "Mobile welding",
  serviceType: "Mobile welding",
  serviceDescription: DESCRIPTION,
};

export default function MobileWeldingPage() {
  return <ServicePage content={CONTENT} />;
}
