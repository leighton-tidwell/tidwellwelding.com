import { defineConfig, devices } from "@playwright/test";

// E2E runs against the DEV Convex deployment via .env.local (loaded by `next dev`).
// Intentionally no TURNSTILE-related env here: dev mode passes without captcha.
// E2E_PORT reuses an already-running dev server on another port (Next 16
// allows only one dev server per project dir): E2E_PORT=3355 pnpm test:e2e
const PORT = process.env.E2E_PORT ?? "3311";

export default defineConfig({
  testDir: "./tests/e2e",
  retries: 1,
  use: {
    baseURL: `http://localhost:${PORT}`,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
