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
