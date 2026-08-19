import type { Metadata } from "next";
import SearchClient from "./search-client";

export const metadata: Metadata = {
  title: "Search | Tidwell Specialty Welding",
  description:
    "Search the site. Services, towns served, the job log, quotes and contact.",
  alternates: { canonical: "/search" },
  // Thin utility page: keep it crawlable and linkable, but out of the index.
  robots: { index: false },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const q = (await searchParams).q;
  const initialQuery = typeof q === "string" ? q : "";
  return <SearchClient initialQuery={initialQuery} />;
}
