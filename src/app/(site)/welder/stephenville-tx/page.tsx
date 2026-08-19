import { Fragment } from "react";
import type { Metadata } from "next";
import TownPage, { CopyLink, type TownContent } from "../town-page";

const TITLE =
  "Welder in Stephenville, TX | Free Quotes, We Beat Any Bid | Tidwell Specialty Welding";
const DESCRIPTION =
  "Mobile welder for Stephenville and Erath County. Baler repairs, ranch and dairy equipment, 24/7 emergency. Free quotes. Call (817) 894-6357.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/welder/stephenville-tx" },
  openGraph: {
    type: "website",
    siteName: "Tidwell Specialty Welding",
    url: "/welder/stephenville-tx",
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

const CONTENT: TownContent = {
  slug: "stephenville-tx",
  town: "Stephenville",
  eyebrow: "Service area — Stephenville, TX",
  headline: (
    <>
      Stephenville is forty minutes down{" "}
      <span style={{ color: "#c90314" }}>377</span>.
    </>
  ),
  lede: "A mobile welder in Stephenville, TX for ranch country: balers, dairy equipment, gates and trailers. The truck runs Erath County all year.",
  bodyKicker: "Erath County",
  paragraphs: [
    "Stephenville sits about 40 minutes down 377 from the shop. That range covers Erath County ranch country and the dairies. The truck knows the road.",
    "Hay season breaks balers, and Eric welds them in the field. Feeders, cattle gates, trailer frames and dairy equipment ride the same truck. A rodeo town keeps stock, and stock is hard on steel.",
    "Contractors around Tarleton call for handrail and structural repairs. Haul-in jobs run up 377 to the Granbury shop. Send photos first and numbers come back the same day.",
  ],
  image: {
    src: "/media/bulldozer-reinforcement-plate.webp",
    alt: "Reinforcement plate welded onto a bulldozer bucket in the field, Stephenville TX area",
  },
  specs: [
    { icon: "truck", text: "Drive time — about 40 min down US-377" },
    { icon: "map-pin", text: "Coverage — Stephenville and Erath County" },
    { icon: "clock", text: "Emergency line 24/7 · (817) 894-6357" },
  ],
  question: {
    headline: "Will a mobile welder come out to a ranch near Stephenville?",
    paragraphs: [
      "Tidwell Specialty Welding runs a mobile welding truck from Granbury down US-377 to Stephenville in about 40 minutes, welds balers, feeders, cattle gates and dairy equipment in the field, quotes every job free, and answers the emergency line at (817) 894-6357 any hour, hay season included.",
      <Fragment key="stephenville-service-links">
        Baler and loader work runs through{" "}
        <CopyLink href="/services/equipment">equipment repair</CopyLink>. Gates
        and trailers ride the{" "}
        <CopyLink href="/services/mobile">mobile welding</CopyLink> truck. A
        breakdown mid-cut goes to the{" "}
        <CopyLink href="/services/emergency">emergency line</CopyLink>.
      </Fragment>,
    ],
  },
  serviceLinesHeadline: (
    <>
      Every line rides down <span style={{ color: "#c90314" }}>377</span>.
    </>
  ),
  plateLede:
    "A baler cracks in the middle of a cut. A parlor rail tears loose before milking. Call any hour and the truck heads down 377.",
  closingHeadline: (
    <>
      Put the truck on the <span style={{ color: "#c90314" }}>road</span>.
    </>
  ),
  closingLede: "Quotes are free. Send photos and rough sizes.",
  serviceName: "Welder in Stephenville, TX",
  serviceDescription:
    "Mobile welding for Stephenville and Erath County, TX. Baler and equipment repair, ranch and dairy work, about 40 minutes from the Granbury shop. 24/7 emergency response.",
};

export default function StephenvillePage() {
  return <TownPage content={CONTENT} />;
}
