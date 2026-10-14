import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [react()],
        test: {
          name: "convex",
          environment: "edge-runtime",
          include: ["convex/**/*.test.{ts,tsx}"],
          // PDF rendering costs ~17ms per invoice line locally and ~96ms on CI
          // runners, so a 100-line invoice takes ~1.7s here and ~9.6s there.
          // Vitest's 5s default sat inside that spread: four tests in
          // invoicePdf.test.ts ran at 76-192% of it, and the build flipped
          // red on roughly half of all runs. See issue #10.
          testTimeout: 30_000,
          server: {
            deps: {
              // convex-test relies on import.meta.glob; keep it processed by Vite.
              inline: ["convex-test"],
            },
          },
        },
      },
      {
        plugins: [react()],
        resolve: {
          alias: {
            "@": path.resolve(rootDir, "src"),
          },
        },
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}"],
          setupFiles: ["./tests/setup/ui.ts"],
          css: false,
        },
      },
    ],
  },
});
