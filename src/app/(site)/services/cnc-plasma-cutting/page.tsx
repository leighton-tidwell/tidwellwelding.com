import type { Metadata } from "next";
import Link from "next/link";
import ServicePage, { type ServicePageContent } from "../service-page";

const TITLE = "CNC Plasma Cutting in Granbury, TX | Tidwell Specialty Welding";
const DESCRIPTION =
  "CNC plasma cutting in Granbury, TX. Custom metal signs, ranch entry signs and cut parts in steel, stainless and aluminum. Free quotes. Call (817) 894-6357.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/services/cnc-plasma-cutting" },
  openGraph: {
    type: "website",
    siteName: "Tidwell Specialty Welding",
    url: "/services/cnc-plasma-cutting",
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
  slug: "cnc-plasma-cutting",
  breadcrumbName: "CNC plasma cutting",
  eyebrow: "Service — CNC plasma cutting · Granbury, TX",
  headline: (
    <>
      CNC plasma. Cut from the <span style={{ color: "#c90314" }}>file</span>.
    </>
  ),
  lede: "CNC plasma cutting in Granbury, TX. Custom metal signs, brackets, gussets, base plates and flat parts. The table takes a full 5x10 sheet.",
  sections: [
    {
      kicker: "Signs",
      heading: "Ranch entry signs. Brand and name signs.",
      paragraphs: [
        "Bring the sign you have in mind. A ranch entry sign to hang over the gate. Your brand cut in plate for the barn or the arch. A name sign for the shop, the house or the trailer.",
        <>
          Send a sketch, a logo file or a photo of the brand. Eric lays it out
          and cuts it. Need posts and an arch? The shop builds those too, and
          Eric hangs the sign on site. The{" "}
          <Link href="/services/fabrication">fabrication page</Link> covers the
          welding side.
        </>,
      ],
    },
    {
      kicker: "The table",
      heading: "Steel, stainless and aluminum.",
      paragraphs: [
        "The table takes a full 5x10 sheet. It cuts carbon steel, stainless and aluminum.",
        'Plate up to 3/8" cuts clean. Call about anything thicker.',
        "Order one part or a production run. Brackets, gussets, tabs and base plates come off the same table as the signs.",
      ],
    },
    {
      kicker: "How to start",
      heading: "Send the file. Or a sketch.",
      paragraphs: [
        "Eric cuts from a DXF or CAD file, a drawing, a sketch with sizes, or a part to copy. Tell him the material, the thickness and how many you need. Quotes are free.",
        <>
          The shop sits in <Link href="/welder/granbury-tx">Granbury, TX</Link>{" "}
          76048, a few minutes off the square. Drop off a part to copy, or send
          the file and pick up the cut pieces.
        </>,
      ],
    },
  ],
  media: [
    // Shop photo stands in until the CNC plasma videos are ready; swap it then.
    {
      kind: "image",
      src: "/media/gate-fabrication.webp",
      alt: "Grinding a carbon steel frame in the Granbury shop, sparks flying",
    },
  ],
  chips: [
    "Steel",
    "Stainless",
    "Aluminum",
    "Full 5x10 sheet",
    "Signs",
    "From DXF, drawings or sketches",
  ],
  specs: [
    { icon: "wrench", text: "CNC plasma table · Granbury, TX 76048" },
    { icon: "ruler", text: "Cut from DXF files, drawings or sketches" },
    { icon: "file-text", text: "Free quotes" },
  ],
  related: [
    { label: "Fabrication", href: "/services/fabrication" },
    { label: "Mobile welding", href: "/services/mobile" },
    { label: "Welder in Granbury, TX", href: "/welder/granbury-tx" },
  ],
  closingHeadline: (
    <>
      Send the file. Or the <span style={{ color: "#c90314" }}>sketch</span>.
    </>
  ),
  closingLede:
    "Quotes are free. Attach the file, drawing or sketch with sizes. Tell Eric the material, thickness and quantity.",
  closingPrimary: { label: "Request a quote", href: "/quote" },
  closingSecondary: { label: "Call (817) 894-6357", href: "tel:8178946357" },
  serviceName: "CNC plasma cutting",
  serviceType: "CNC plasma cutting",
  serviceDescription: DESCRIPTION,
};

export default function CncPlasmaCuttingPage() {
  return <ServicePage content={CONTENT} />;
}
