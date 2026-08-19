# Convex setup (internal notes)

`convex/_generated/` does not exist yet. Nothing in the app may import from it
until it is generated.

To generate it (requires Convex auth):

```sh
npx convex login
npx convex dev --once
```

That provisions/links a deployment, pushes `schema.ts` + `convex.config.ts`
(registering the agent, rateLimiter, and resend components), and writes
`convex/_generated/`.

Server-side secrets live in the Convex deployment, not in Next:

```sh
npx convex env set RESEND_API_KEY <value>
npx convex env set ANTHROPIC_API_KEY <value>
npx convex env set TURNSTILE_SECRET_KEY <value>
# Prod only: fail closed if the Turnstile secret ever goes missing.
npx convex env set TURNSTILE_REQUIRED true
```

The Next app only needs `NEXT_PUBLIC_CONVEX_URL` (and
`NEXT_PUBLIC_TURNSTILE_SITE_KEY`) — see `.env.local.example`.
