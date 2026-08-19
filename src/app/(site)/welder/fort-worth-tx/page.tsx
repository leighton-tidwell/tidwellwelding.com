import { Fragment } from "react";
import type { Metadata } from "next";
import TownPage, { CopyLink, type TownContent } from "../town-page";

const TITLE =
  "Welder in Fort Worth, TX | Free Quotes, We Beat Any Bid | Tidwell Specialty Welding";
const DESCRIPTION =
  "Mobile welder for Fort Worth, about 45 minutes from the Granbury shop. Staircases, pipe repair, 24/7 emergency. Free quotes. Call (817) 894-6357.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/welder/fort-worth-tx" },
  openGraph: {
    type: "website",
    siteName: "Tidwell Specialty Welding",
    url: "/welder/fort-worth-tx",
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
  slug: "fort-worth-tx",
  town: "Fort Worth",
  eyebrow: "Service area — Fort Worth, TX",
  headline: (
    <>
      The rig <span style={{ color: "#c90314" }}>rolls</span> to Fort Worth.
    </>
  ),
  lede: "A mobile welder in Fort Worth, TX: structural packages, plant repairs and emergency calls on the west side of DFW. The truck makes it in about 45 minutes.",
  bodyKicker: "The Fort Worth run",
  paragraphs: [
    "Fort Worth is the industrial end of the run. Distribution floors, plants and contractor sites off the highways. The truck leaves Granbury and hits the west side in about 45 minutes.",
    "TSWS built a staircase package for a distribution facility in the Fort Worth area. Three welders, 150 man-hours, two weekends. The floor stayed open the whole job.",
    "Contractors call for handrail and structural steel that passes inspection. Plants call for pipe repairs inside outage windows. Breakdowns get the truck the same day.",
  ],
  image: {
    src: "/media/custom-handrail.webp",
    alt: "Installed steel handrail with cable infill, commercial package, Fort Worth TX area",
  },
  specs: [
    { icon: "truck", text: "Drive time — about 45 min from the Granbury shop" },
    { icon: "map-pin", text: "Coverage — Fort Worth and the west side of DFW" },
    { icon: "clock", text: "Emergency line 24/7 · (817) 894-6357" },
  ],
  question: {
    headline: "How fast can a mobile welder get to Fort Worth?",
    paragraphs: [
      "Tidwell Specialty Welding sends a rigged mobile welding truck from its Granbury shop to Fort Worth in about 45 minutes, the emergency line at (817) 894-6357 picks up 24/7, and every quote is free, whether the job is a structural package, a plant pipe repair or a rack torn off a dock.",
      <Fragment key="fort-worth-service-links">
        Contractors book{" "}
        <CopyLink href="/services/structural">structural steel</CopyLink> that
        passes inspection. Plants book{" "}
        <CopyLink href="/services/pipe">pipe welding</CopyLink> inside outage
        windows. Breakdowns go to the{" "}
        <CopyLink href="/services/emergency">emergency line</CopyLink>.
      </Fragment>,
    ],
  },
  serviceLinesHeadline: (
    <>
      Every line makes the Fort Worth{" "}
      <span style={{ color: "#c90314" }}>run</span>.
    </>
  ),
  plateLede:
    "A line down at the plant or a rack torn loose at the dock. Call any hour and the truck heads for Fort Worth.",
  closingHeadline: (
    <>
      Got a Fort Worth bid? We&apos;ll{" "}
      <span style={{ color: "#c90314" }}>beat</span> it.
    </>
  ),
  closingLede: "Quotes are free. Attach the other shop's number.",
  serviceName: "Welder in Fort Worth, TX",
  serviceDescription:
    "Mobile welding, structural packages and pipe repair for Fort Worth, TX. The rigged truck runs from the Granbury shop in about 45 minutes. 24/7 emergency response.",
};

export default function FortWorthPage() {
  return <TownPage content={CONTENT} />;
}
