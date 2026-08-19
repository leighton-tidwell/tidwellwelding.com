/**
 * Cloudflare Turnstile server-side verification.
 *
 * Plain helper (not a Convex function) — call it from actions. Uses fetch,
 * so no "use node" needed.
 *
 * Dev mode: when TURNSTILE_SECRET_KEY is unset on the deployment, every
 * request passes so the quote flow works without captcha keys configured.
 * Production guard: set TURNSTILE_REQUIRED=true on the prod deployment so a
 * deleted or mistyped secret fails closed instead of silently disabling bot
 * checks.
 */
export async function verifyTurnstile(
  token: string | undefined,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (process.env.TURNSTILE_REQUIRED === "true") {
      console.error(
        "TURNSTILE_REQUIRED is true but TURNSTILE_SECRET_KEY is unset. Failing closed.",
      );
      return false;
    }
    console.warn(
      "TURNSTILE_SECRET_KEY is unset. Skipping Turnstile verification (dev mode).",
    );
    return true;
  }
  if (!token) return false;
  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret, response: token }).toString(),
      },
    );
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error("Turnstile verification request failed", err);
    return false;
  }
}
