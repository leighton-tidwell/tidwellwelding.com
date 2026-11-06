# Local stack

`make dev` runs everything on your machine. Docker runs two containers (`compose.yaml`), and Next runs on the host with hot reload.

| Piece    | What it is                                                                                                                               |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `convex` | Self-hosted Convex backend. `make up` pushes `convex/` to it, and `make dev` keeps it in sync as you edit.                               |
| `fakes`  | `local/fakes.mjs`: stand-ins for Anthropic and Resend. Chat, the estimator and email work end to end with fixed replies and no API keys. |
| Next     | `next dev`, pointed at the local backend. `make dev` prints its URL.                                                                     |

- **Data:** `make seed` loads the owner account `owner@tidwellwelding.test` / `local-only-password`, plus sample customers, invoices and a quote. `make reset` wipes everything and seeds again.
- **Email:** sent mail lands in the Resend fake, and `GET http://127.0.0.1:$FAKES_PORT/emails` lists it. `tests/e2e/quote.spec.ts` reads it there.
- **Config:** backend env vars are in `local/convex.env`. They're all harmless local defaults, with no real secrets.
- **Ports:** each git worktree gets its own port block and compose project, so agents can run stacks side by side. Run `make -p | grep _PORT` to see them, or override one with `make dev WEB_PORT=3000`.
- **Logs:** `make logs` shows backend, fakes and web-server output.

`.env.local` is not needed. The harness exports the local URLs, and those override anything in it.
