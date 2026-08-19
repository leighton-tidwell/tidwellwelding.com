import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CrewConsole from "./crew-console";

export const metadata: Metadata = {
  title: "Crew console | TSWS",
  robots: { index: false, follow: false },
};

// The access-key check reads searchParams + env at request time; without this
// the route gets statically prerendered and 500s on the worker.
export const dynamic = "force-dynamic";

// Not linked anywhere public. Access requires the key: /crew?key=<CREW_ACCESS_KEY>.
// Wrong or missing key 404s so the route stays invisible. When the env var is
// unset (local dev), the console opens without a key.
export default async function CrewPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const accessKey = process.env.CREW_ACCESS_KEY;
  if (accessKey) {
    const { key } = await searchParams;
    if (key !== accessKey) notFound();
  }
  return <CrewConsole />;
}
