import type { Metadata } from "next";
import Link from "next/link";
import ServicePage, { type ServicePageContent } from "../service-page";

const TITLE =
  "Heavy Equipment Welding Repair in Granbury, TX | Tidwell Specialty Welding";
const DESCRIPTION =
  "Heavy equipment welding repair from Granbury, TX. Buckets, booms, frames, frac tanks and hot oil beds, fixed in the field. Call (817) 894-6357.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/services/equipment" },
  openGraph: {
    type: "website",
    siteName: "Tidwell Specialty Welding",
    url: "/services/equipment",
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
  slug: "equipment",
  breadcrumbName: "Heavy equipment repair",
  eyebrow: "Service — Equipment · Field-first",
  headline: (
    <>
      Equipment repair that holds under{" "}
      <span style={{ color: "#c90314" }}>load</span>.
    </>
  ),
  lede: "Heavy equipment welding repair out of Granbury, TX. Buckets, booms, frames, frac tanks and hot oil beds. Fixed where the machine sits.",
  sections: [
    {
      kicker: "What breaks",
      heading: "Buckets, booms, tanks and frames.",
      paragraphs: [
        "Cracked bucket ears. Worn pins. Split tank seams. Bent frames. Eric has repaired them at the plant, on the pad and in the pasture. Hot oil beds and frac tanks came with the road years.",
        <>
          Ranch equipment breaks the same way. Hay season cracks balers around{" "}
          <Link href="/welder/stephenville-tx">Stephenville</Link>, and Eric
          welds them in the field. Feeders, cattle gates and trailer frames
          ride the same truck.
        </>,
      ],
    },
    {
      kicker: "A repair from the log",
      heading: "The dozer bucket that went back to work.",
      paragraphs: [
        <>
          A dozer bucket in the <Link href="/work">job log</Link> needed a
          reinforcement plate. Eric cut it, fit it and welded it on in the
          field. Preheated, welded out, back pushing dirt.
        </>,
        "That is the pattern for equipment work. Get to the machine, build the repair around the load it carries, and put it back to work.",
        "Plant equipment runs through the same book. The log holds a custom chute built for an asphalt plant, made to fit the machine it feeds.",
      ],
    },
    {
      kicker: "The guarantee",
      heading: "It holds, or he comes back.",
      paragraphs: [
        "The repair holds under load or Eric comes back on his dime. That line sits on the capability sheet because he means it.",
        <>
          Downtime is the real cost, so the truck comes to the machine. The{" "}
          <Link href="/services/emergency">emergency line</Link> runs 24/7 for
          breakdowns that cannot wait for morning. Fort Worth is about 45
          minutes out. Stephenville is about 40.
        </>,
        "Haul-in repairs work too. The shop sits in Granbury, TX 76048. Drop the part any day, and call if the gate is shut.",
      ],
    },
  ],
  media: [
    {
      kind: "image",
      src: "/media/bulldozer-reinforcement-plate.webp",
      alt: "Reinforcement plate welded onto a bulldozer bucket in the field",
    },
  ],
  chips: [
    "Buckets & booms",
    "Frac tanks",
    "Hot oil beds",
    "Frames",
    "On location",
  ],
  specs: [
    { icon: "truck", text: "Field-first · the truck comes to the machine" },
    { icon: "shield-check", text: "Holds under load, or he comes back" },
    { icon: "clock", text: "Emergency line 24/7 · (817) 894-6357" },
  ],
  related: [
    { label: "24/7 emergency", href: "/services/emergency" },
    { label: "Mobile welding", href: "/services/mobile" },
    { label: "Welder in Stephenville, TX", href: "/welder/stephenville-tx" },
  ],
  closingHeadline: (
    <>
      Machine down? Get it back to{" "}
      <span style={{ color: "#c90314" }}>work</span>.
    </>
  ),
  closingLede:
    "Send photos of the crack and where the machine sits. Quotes are free.",
  closingPrimary: { label: "Request a quote", href: "/quote" },
  closingSecondary: { label: "Call (817) 894-6357", href: "tel:8178946357" },
  serviceName: "Heavy equipment repair",
  serviceType: "Heavy equipment welding repair",
  serviceDescription: DESCRIPTION,
};

export default function EquipmentRepairPage() {
  return <ServicePage content={CONTENT} />;
}
