import type { Metadata } from "next";
import SetPasswordForm from "./set-password-form";

export const metadata: Metadata = {
  title: "Set your password | TSWS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Landing page for the one-time setup link emailed to the owner. The token in
 * the URL is single-use: setPassword burns it, and a user who already has a
 * password is refused even with a pristine token. A replacement link can only
 * be minted from the Convex CLI (auth:issuePasswordReset).
 */
export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <SetPasswordForm token={token ?? ""} />;
}
