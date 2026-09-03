import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AdminConsole from "./admin-console";

export const metadata: Metadata = {
  title: "Admin | TSWS",
  robots: { index: false, follow: false },
};

// The access-key check reads searchParams + env at request time; without this
// the route gets statically prerendered and 500s on the worker.
export const dynamic = "force-dynamic";

/**
 * Not linked anywhere public. When ADMIN_ACCESS_KEY is set the route 404s
 * without ?key=<value>, so the login screen stays invisible to crawlers and
 * casual pokes. This is obscurity, not security: every Convex function behind
 * it independently requires a valid session token.
 *
 * With the env var unset (local dev, CI) the console opens straight to login.
 */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const accessKey = process.env.ADMIN_ACCESS_KEY;
  if (accessKey) {
    const { key } = await searchParams;
    if (key !== accessKey) notFound();
  }
  return <AdminConsole />;
}
