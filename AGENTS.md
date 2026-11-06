<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project facts

- Business details (name, email, phone, address) live in `src/lib/business.ts` — import
  them, never re-type.
- Pull request bodies follow `.github/pull_request_template.md`: a short `## Summary`
  (what / why / how, in prose), then `## Proof` with the actual output of `pnpm lint`,
  `pnpm typecheck` and `pnpm test`, screenshots for anything user-visible, and a plain
  statement of what you did not verify. `gh pr create --body` does not pick the
  template up on its own — read it and follow it. Keep it short; detail goes in the
  diff or the issue.
