import type { Metadata } from "next";
import { Saira_Condensed, Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import ConvexClientProvider from "./ConvexClientProvider";
import JsonLd from "@/components/json-ld";
import {
  EMAIL,
  LEGAL_NAME,
  LOCALITY,
  NAME,
  PHONE_E164,
  POSTAL_CODE,
  REGION,
  SAME_AS,
  SERVICE_AREA,
  SITE_URL,
} from "@/lib/business";

const saira = Saira_Condensed({
  weight: ["500", "600", "700", "800", "900"],
  subsets: ["latin"],
  variable: "--font-saira",
  display: "swap",
});

const archivo = Archivo({
  // Variable font: covers 400-800 plus italic 600 per the design spec.
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title:
    "Welding & Fabrication in Granbury, TX | 24/7 Mobile Welder | Tidwell Specialty Welding",
  description:
    "Welding and fabrication out of Granbury, Texas. Mobile rig, 24/7 emergency response, free quotes. We'll beat any quote you've been given.",
  openGraph: {
    type: "website",
    siteName: "Tidwell Specialty Welding",
    url: SITE_URL,
    title:
      "Welding & Fabrication in Granbury, TX | 24/7 Mobile Welder | Tidwell Specialty Welding",
    description:
      "Welding and fabrication out of Granbury, Texas. Mobile rig, 24/7 emergency response, free quotes. We'll beat any quote you've been given.",
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
    title:
      "Welding & Fabrication in Granbury, TX | 24/7 Mobile Welder | Tidwell Specialty Welding",
    description:
      "Welding and fabrication out of Granbury, Texas. Mobile rig, 24/7 emergency response, free quotes. We'll beat any quote you've been given.",
    images: ["/og-card.png"],
  },
};

// Site-wide LocalBusiness JSON-LD — exactly one block across the site.
// No `Welder` type exists in schema.org and Google ignores `additionalType`;
// the multi-type array below is the correct, valid pattern.
// NAP values come from src/lib/business.ts (SEO P1-5) — never hardcode them.
const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": ["HomeAndConstructionBusiness", "LocalBusiness"],
  "@id": `${SITE_URL}/#business`,
  name: NAME,
  legalName: LEGAL_NAME,
  description:
    "Mobile welding and custom metal fabrication out of Granbury, Texas — pipe, structural, heavy equipment repair, 24/7 emergency response across DFW to Stephenville.",
  url: SITE_URL,
  telephone: PHONE_E164,
  email: EMAIL,
  image: `${SITE_URL}/media/welding-rig-at-work.jpg`,
  logo: `${SITE_URL}/logo-badge.png`,
  sameAs: [...SAME_AS],
  address: {
    "@type": "PostalAddress",
    addressLocality: LOCALITY,
    addressRegion: REGION,
    postalCode: POSTAL_CODE,
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: 32.442,
    longitude: -97.794,
  },
  areaServed: [...SERVICE_AREA],
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      opens: "00:00",
      closes: "23:59",
    },
  ],
  knowsAbout: [
    "mobile welding",
    "custom metal fabrication",
    "pipe welding",
    "TIG welding",
    "structural steel",
    "heavy equipment repair",
    "gates and fencing",
  ],
  founder: { "@type": "Person", name: "Eric Tidwell" },
  priceRange: "$$",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${saira.variable} ${archivo.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* React hoists this to <head>. Browser tab-to-search, not a SERP feature. */}
        <link
          rel="search"
          type="application/opensearchdescription+xml"
          title="Tidwell Specialty Welding"
          href="/opensearch.xml"
        />
        <JsonLd data={localBusinessJsonLd} />
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
