import type { Metadata } from "next";
import QuoteFlow from "./quote-flow";

const TITLE =
  "Free Welding Quotes | We Beat Any Bid | Tidwell Specialty Welding, Granbury TX";
const DESCRIPTION =
  "Describe the job and get working numbers in minutes. Quotes are free. Put in the other shop's bid and ours comes in under it.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/quote" },
  openGraph: {
    type: "website",
    siteName: "Tidwell Specialty Welding",
    url: "/quote",
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: "/media/welding-rig-at-work.jpg",
        width: 1080,
        height: 1920,
        alt: "TSWS welding rig parked on a job site, Granbury TX",
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

export default function QuotePage() {
  return <QuoteFlow />;
}
