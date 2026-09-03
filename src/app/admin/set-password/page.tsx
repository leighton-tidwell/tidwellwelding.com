import type { Metadata } from "next";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ds";
import SetPasswordForm from "./set-password-form";
import "../admin.css";

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
 *
 * The token is checked here, on the server, so a spent link renders as spent in
 * the first HTML the browser receives. Checking it in the client meant the form
 * painted first and flashed before the query came back.
 */
export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  let valid = false;
  if (token) {
    try {
      const convex = new ConvexHttpClient(
        process.env.NEXT_PUBLIC_CONVEX_URL as string,
      );
      ({ valid } = await convex.query(api.auth.checkSetupToken, { token }));
    } catch {
      // Convex unreachable: fall through to the spent screen rather than
      // offering a form whose submit would fail anyway.
      valid = false;
    }
  }

  if (!valid) {
    return (
      <div className="admin-gate">
        <div className="admin-gate__plate">
          <h1 className="admin-gate__title">This link is used up</h1>
          <p className="admin-gate__sub">
            A setup link works exactly once. If you have already set your
            password, sign in below — otherwise ask for a fresh link.
          </p>
          <Button href="/admin" block>
            Go to sign in
          </Button>
        </div>
      </div>
    );
  }

  return <SetPasswordForm token={token as string} />;
}
