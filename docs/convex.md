# Convex

`convex/_generated/` is committed. Regenerate it after changing the schema or function signatures with `npx convex dev --once`.

Server-side secrets live on each Convex deployment, not in the Next app:

```sh
npx convex env set RESEND_API_KEY <value>
npx convex env set ANTHROPIC_API_KEY <value>
npx convex env set TURNSTILE_SECRET_KEY <value>
# Prod only: fail closed if the Turnstile secret ever goes missing.
npx convex env set TURNSTILE_REQUIRED true
```

The Next app only needs `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (see `.env.local.example`).

## Failed quote attempts

A submission that `quotes.submitQuote` rejects (verification, a cap, the rate
limiter, anything unanticipated) is recorded in `failedQuotes` with the reason
and whether a Turnstile token was sent — but only when the attempt carries a
10-digit phone or a valid email, so a lost lead is still callable. It is a
table of its own so nothing that lists the owner's real requests shows an
unverified attempt as a confirmed one. Rows are pruned 90 days after they
land, by a bounded sweep on the next write; there is no cron. Nothing in the
admin console reads this table yet.
