# Tidwell Specialty Welding Services

**Live site: [tidwellwelding.com](https://tidwellwelding.com)**

Marketing and quote-intake site for a mobile welding and fabrication business in Granbury, Texas. Built from a Claude Design system: stamped-steel dark theme, chamfered plates, hazard striping, and a working welder's voice.

## Stack

- **Next.js 16** (App Router) deployed to **Cloudflare Workers** via [OpenNext](https://opennext.js.org/cloudflare)
- **Convex** backend: quote intake, AI estimator, shop chat bot, rate limiting
- **Resend** transactional email with `.ics` calendar invites for callback slots
- **Cloudflare Turnstile** CAPTCHA on every AI-facing action
- **Claude** (Anthropic API): Sonnet 5 drafts research-calibrated quote estimates with confidence gating; Haiku 4.5 answers shop questions

## Features

- 4-step quote flow: describe the job, get AI-drafted working numbers, pick a callback slot; the owner gets an email with every detail plus a calendar invite
- Confidence-gated estimates: vague jobs show hours and a call-Eric prompt instead of dollars
- Daily cached material-price research feeding the estimator (one web search per day, not per quote)
- Per-service and per-town SEO pages, on-site search, structured data, IndexNow
- WCAG 2.2 AA: zero axe violations across every route and viewport
- 236 unit/integration tests (vitest) + 56 e2e specs (Playwright, including WebKit checks)

## Development

<!-- preview pipeline smoke test -->

```bash
pnpm install
npx convex dev        # backend, hot reload
pnpm dev              # site on localhost:3000
pnpm test             # vitest (convex + ui projects)
pnpm test:e2e         # playwright
pnpm run deploy       # OpenNext build → wrangler deploy → IndexNow ping
```

Environment: `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in `.env.local` (see `.env.local.example`); `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, and `TURNSTILE_SECRET_KEY` live on the Convex deployment.

---

Site by [TDWL Development](https://www.tdwl.dev/)
