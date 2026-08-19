import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "convex",
          environment: "edge-runtime",
          include: ["convex/**/*.test.ts"],
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
