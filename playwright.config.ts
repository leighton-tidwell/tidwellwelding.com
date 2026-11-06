import { defineConfig, devices } from "@playwright/test";

// Run through `make e2e`: it starts the local Docker stack and exports
// NEXT_PUBLIC_CONVEX_URL and WEB_PORT, which the dev server below inherits.
// No Turnstile keys locally, so the captcha passes in dev mode.
const PORT = process.env.WEB_PORT ?? "3311";

export default defineConfig({
  testDir: "./tests/e2e",
  // A flaky test is a bug to fix, not to retry past.
  retries: 0,
  use: {
    baseURL: `http://localhost:${PORT}`,
  },
  projects: [
    // Provisions a disposable admin account (and exercises the real one-time
    // setup link) before the admin specs run.
    {
      name: "admin-setup",
      testMatch: /admin\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["admin-setup"],
    },
  ],
  webServer: {
    command: `pnpm exec next dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
