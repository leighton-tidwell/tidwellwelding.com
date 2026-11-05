import type { Metadata } from "next";
import type { ReactNode } from "react";
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
 *
 * Every failure used to render one "this link is used up" screen. That hid a
 * real outage: a Worker built against the wrong Convex deployment made a valid
 * token look spent, with no exception to find in `wrangler tail`. So each
 * reason now gets its own screen, and a backend we cannot reach says exactly
 * that — and logs the underlying error — instead of blaming the link.
 */

function Gate({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action: { href: string; label: string };
}) {
  return (
    <div className="admin-gate">
      <div className="admin-gate__plate">
        <h1 className="admin-gate__title">{title}</h1>
        <p className="admin-gate__sub">{children}</p>
        <Button href={action.href} block>
          {action.label}
        </Button>
      </div>
    </div>
  );
}

const SIGN_IN = { href: "/admin", label: "Go to sign in" };

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  // No token at all: usually a link that got truncated by a mail client, or
  // someone typing the path by hand. Nothing was ever checked, so do not
  // imply the link was used.
  if (!token) {
    return (
      <Gate title="That link is incomplete" action={SIGN_IN}>
        This page needs the full setup link from your email, including the part
        after <code>?token=</code>. Copy the whole address and try again.
      </Gate>
    );
  }

  let result;
  try {
    const convex = new ConvexHttpClient(
      process.env.NEXT_PUBLIC_CONVEX_URL as string,
    );
    result = await convex.query(api.auth.checkSetupToken, { token });
  } catch (error) {
    // The one case that is not about the link. Log it loudly: this is the only
    // trace of a misconfigured deployment that will reach `wrangler tail`.
    console.error("[set-password] checkSetupToken failed", error);
    return (
      <Gate
        title="We can't reach the backend right now"
        action={{
          href: `/admin/set-password?token=${encodeURIComponent(token)}`,
          label: "Try again",
        }}
      >
        This is not a problem with your link — the server could not check it.
        Try again in a moment, and if it keeps happening the site needs looking
        at.
      </Gate>
    );
  }

  if (result.state === "valid") {
    return <SetPasswordForm token={token} />;
  }

  if (result.state === "spent") {
    return (
      <Gate title="This link is used up" action={SIGN_IN}>
        A setup link works exactly once, and this one has already been used. If
        that was you, sign in below — otherwise ask for a fresh link.
      </Gate>
    );
  }

  if (result.state === "expired") {
    return (
      <Gate title="This link has expired" action={SIGN_IN}>
        Setup links are good for 48 hours. This one timed out before it was
        used, so it needs replacing — ask for a fresh link.
      </Gate>
    );
  }

  if (result.state === "already_set") {
    return (
      <Gate title="Your password is already set" action={SIGN_IN}>
        This account has a password, so a setup link cannot change it. Sign in
        below, or ask for a reset if you no longer know it.
      </Gate>
    );
  }

  return (
    <Gate title="We don't recognize that link" action={SIGN_IN}>
      This address does not match any setup link we issued. It may have been
      copied incompletely — check the whole link from your email, or ask for a
      fresh one.
    </Gate>
  );
}
