import type { Metadata } from "next";
import Link from "next/link";
import ServicePage, { type ServicePageContent } from "../service-page";

const TITLE =
  "24/7 Emergency Welding, Granbury TX to DFW & Stephenville | Tidwell Specialty Welding";
const DESCRIPTION =
  "24/7 emergency welding from Granbury, TX. Nights, weekends and holidays across DFW to Stephenville. Call (817) 894-6357 any hour.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/services/emergency" },
  openGraph: {
    type: "website",
    siteName: "Tidwell Specialty Welding",
    url: "/services/emergency",
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
  slug: "emergency",
  breadcrumbName: "Emergency & on-call",
  eyebrow: "Service — Emergency · 24/7",
  headline: (
    <>
      Breakdowns don&apos;t book{" "}
      <span style={{ color: "#c90314" }}>appointments</span>.
    </>
  ),
  lede: "24/7 emergency welding across DFW to Stephenville, out of Granbury, TX. Call any hour. Nights, weekends and holidays included.",
  sections: [
    {
      kicker: "How it works",
      heading: "Call. The truck loads. It rolls.",
      paragraphs: [
        "Call at 2 a.m. and Eric loads the truck. He drops what he's doing and drives to you. The rig arrives stocked: machine, leads, gas, grinders and consumables.",
        <>
          There is no dispatcher and no call center. The phone rings on the
          welder who does the work. Can&apos;t call? Email{" "}
          <a href="mailto:eric@tidwellwelding.com">eric@tidwellwelding.com</a>{" "}
          and mark it urgent.
        </>,
      ],
    },
    {
      kicker: "Who calls at 2 a.m.",
      heading: "Plants, ranches and contractors.",
      paragraphs: [
        <>
          Plants call about lines that have to run by morning. A cracked frame,
          a leaking tank, a seam that let go. The job is to get the line
          running. <Link href="/services/pipe">Pipe repairs</Link> ride the
          same truck.
        </>,
        "Ranchers get equipment back in the field. A baler cracks in the middle of a cut, or a parlor rail tears loose before milking. Contractors hold their schedule when a repair lands the same night.",
      ],
    },
    {
      kicker: "Coverage",
      heading: "Granbury, Fort Worth, Stephenville and between.",
      paragraphs: [
        <>
          The truck runs the whole corridor.{" "}
          <Link href="/welder/granbury-tx">Granbury</Link> is home base, in
          76048. <Link href="/welder/fort-worth-tx">Fort Worth</Link> is about
          45 minutes out.{" "}
          <Link href="/welder/stephenville-tx">Stephenville</Link> is about 40
          minutes down 377. Weatherford, Cleburne, Glen Rose, Tolar and Lipan
          sit inside the run.
        </>,
        "One number covers all of it: (817) 894-6357. Save it before something breaks.",
      ],
    },
    {
      kicker: "Make the call count",
      heading: "What to say when you call.",
      paragraphs: [
        "Say what broke, where it sits and what metal it looks like. Photos help if you can get them. Eric loads the truck for the job instead of guessing.",
        "Then clear a path to the work. The rig needs room to park and set up. The sooner the arc strikes, the sooner the line runs.",
      ],
    },
  ],
  media: [
    {
      kind: "image",
      src: "/media/cracked-equipment-repair.webp",
      alt: "Field repair weld on a John Deere excavator boom, truck alongside, Granbury TX",
    },
  ],
  chips: ["Nights", "Weekends", "Holidays", "Any hour"],
  specs: [
    { icon: "clock", text: "24/7 · nights, weekends, holidays" },
    { icon: "phone", text: "(817) 894-6357 · rings the welder" },
    { icon: "truck", text: "DFW to Stephenville · everywhere between" },
  ],
  related: [
    { label: "Mobile welding", href: "/services/mobile" },
    { label: "Equipment repair", href: "/services/equipment" },
    { label: "Pipe welding", href: "/services/pipe" },
  ],
  closingHeadline: (
    <>
      Something&apos;s down. <span style={{ color: "#c90314" }}>Call</span> now.
    </>
  ),
  closingLede:
    "Call any hour and the truck rolls. Email works too, marked urgent.",
  closingPrimary: { label: "Call (817) 894-6357", href: "tel:8178946357" },
  closingSecondary: { label: "Request a quote", href: "/quote" },
  serviceName: "Emergency & on-call welding",
  serviceType: "Emergency welding",
  serviceDescription: DESCRIPTION,
};

export default function EmergencyPage() {
  return <ServicePage content={CONTENT} />;
}
