// Vitest/Vite supplies import.meta.glob at test runtime; Convex's deploy
// typecheck doesn't know it. Scoped shim so *.test.ts files typecheck.
interface ImportMeta {
  glob: (
    patterns: string | string[],
  ) => Record<string, () => Promise<unknown>>;
}
