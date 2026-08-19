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

export default function QuotePage() {
  return <QuoteFlow />;
}
