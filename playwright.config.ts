import { defineConfig, devices } from "@playwright/test";

// Local: run through `make e2e`, which starts the Docker stack and exports
// NEXT_PUBLIC_CONVEX_URL and WEB_PORT for the dev server below. No Turnstile
// keys locally, so the captcha passes in dev mode.
// Remote: E2E_BASE_URL points the suite at a deployed site (`make e2e-remote`,
// `make smoke`) and no server is started.
const PORT = process.env.WEB_PORT ?? "3311";
const remote = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./tests/e2e",
  // A flaky test is a bug to fix, not to retry past.
  retries: 0,
  use: {
    baseURL: remote ?? `http://localhost:${PORT}`,
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
  webServer: remote
    ? undefined
    : {
        command: `pnpm exec next dev --port ${PORT}`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
