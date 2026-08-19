import { Fragment } from "react";
import type { Metadata } from "next";
import TownPage, { CopyLink, type TownContent } from "../town-page";

const TITLE =
  "Welding & Fabrication in Granbury, TX | Free Quotes, We Beat Any Bid | Tidwell Specialty Welding";
const DESCRIPTION =
  "The shop sits in Granbury, TX 76048. Fabrication, pipe, equipment repair and 24/7 mobile welding. Free quotes. Call (817) 894-6357.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/welder/granbury-tx" },
  openGraph: {
    type: "website",
    siteName: "Tidwell Specialty Welding",
    url: "/welder/granbury-tx",
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: "/media/welding-rig-at-work.jpg",
        alt: "TSWS mobile welding rig burning rod on a job, Granbury TX 76048",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/media/welding-rig-at-work.jpg"],
  },
};

const CONTENT: TownContent = {
  slug: "granbury-tx",
  town: "Granbury",
  eyebrow: "Service area — Granbury, TX",
  headline: (
    <>
      Granbury is the <span style={{ color: "#c90314" }}>home</span> town.
    </>
  ),
  lede: "Eric Tidwell is a welder in Granbury, TX. The shop sits in 76048, a few minutes off the square. Drop parts any day. Free quotes on every job.",
  bodyKicker: "The home town",
  paragraphs: [
    "Granbury is where the truck parks at night. The shop sits in 76048, close to the square. Drop parts any day. If the gate is shut, call and Eric will meet you.",
    "Most Granbury work is Hood County work. Ranch gates and fence corners off Lake Granbury. Water troughs, trailer frames and cracked loader buckets in the pasture. Builders near the courthouse call for handrail and brackets.",
    "Shop jobs and field jobs start the same way. Send photos with rough sizes. Working numbers come back the same day.",
  ],
  image: {
    src: "/media/welding-rig-at-work.webp",
    alt: "TSWS mobile welding rig burning rod on a job, Granbury TX 76048",
  },
  specs: [
    { icon: "map-pin", text: "Home base — Granbury, TX 76048" },
    { icon: "truck", text: "Shop hours 7a–6p · drop parts any day" },
    { icon: "clock", text: "Emergency line 24/7 · (817) 894-6357" },
  ],
  question: {
    headline: "Is there a welding shop in Granbury, TX?",
    paragraphs: [
      "Tidwell Specialty Welding is a mobile welding and fabrication shop based in Granbury, TX 76048, and Eric Tidwell answers the line at (817) 894-6357 every hour of the day, quotes every job free, and takes work at the shop or on your site anywhere in Hood County.",
      <Fragment key="granbury-service-links">
        Most shop days are{" "}
        <CopyLink href="/services/fabrication">custom fabrication</CopyLink>:
        gates, rails, brackets and trailer frames. Field days lean on{" "}
        <CopyLink href="/services/equipment">equipment repair</CopyLink>. The{" "}
        <CopyLink href="/services/mobile">mobile welding</CopyLink> truck covers
        the rest of Hood County.
      </Fragment>,
    ],
  },
  serviceLinesHeadline: (
    <>
      Every line runs from this <span style={{ color: "#c90314" }}>shop</span>.
    </>
  ),
  plateLede:
    "A cracked gate hinge, a dead baler, a trailer on the shoulder. The truck is in town. Call any hour and it rolls.",
  closingHeadline: (
    <>
      Bring the job to the <span style={{ color: "#c90314" }}>shop</span>.
    </>
  ),
  closingLede: "Quotes are free. Send photos and rough sizes.",
  serviceName: "Welding & fabrication in Granbury, TX",
  serviceDescription:
    "Fabrication, structural, pipe and heavy equipment repair from the shop in Granbury, TX 76048. Mobile truck and 24/7 emergency response. Free quotes.",
};

export default function GranburyPage() {
  return <TownPage content={CONTENT} />;
}
