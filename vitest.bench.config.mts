// Throwaway harness for the issue #10 PDF renderer spike. Kept out of
// vitest.config.mts on purpose: `make test` must not run benchmarks.
// Run with: pnpm exec vitest run --config vitest.bench.config.mts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "bench",
    environment: "node",
    include: ["bench/**/*.bench.test.ts"],
    testTimeout: 1_800_000,
    // Timings are the output here, so nothing may run beside anything else.
    fileParallelism: false,
    maxConcurrency: 1,
    isolate: true,
    hookTimeout: 1_800_000,
  },
  plugins: [react()],
});
