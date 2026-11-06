<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# tidwellwelding.com

Next.js 16 on Cloudflare Workers (OpenNext), Convex backend. A merge to `main` deploys production.

## Commands

`make` lists every command. Run `make ci` before opening a PR: it is exactly what CI runs.

## Rules

- Production deploys only through `.github/workflows/deploy-production.yml`. Never build or deploy prod by hand.
- Server secrets live on the Convex deployment. Don't read or write `.env*` files.
- Business details (name, email, phone, address) come from `src/lib/business.ts`. Never re-type them.
- Every lint suppression or config exception says why, in a comment next to it.
- PRs: use the template, stay under 500 lines and 10 files or fill in the Explainer, and claim only checks you ran.
- The chat prompt in `convex/chat.ts` holds an intentional easter egg. Leave it.

## Where things live

| Path                 | What                                                       |
| -------------------- | ---------------------------------------------------------- |
| `src/app/(site)/`    | Public pages                                               |
| `src/app/admin/`     | Admin console: invoices, customers, login                  |
| `src/components/ds/` | Design-system components                                   |
| `src/lib/`           | Shared helpers and business facts                          |
| `convex/`            | Backend schema and functions, with their tests beside them |
| `tests/e2e/`         | Playwright specs                                           |
| `scripts/`           | Build and deploy guards, PR checks                         |
| `docs/`              | Specs and how-tos. Update them in the same PR as the code. |
