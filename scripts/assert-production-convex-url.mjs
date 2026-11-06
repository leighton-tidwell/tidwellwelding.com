#!/usr/bin/env node
// Fails a PRODUCTION build whose inlined NEXT_PUBLIC_CONVEX_URL is not the
// production Convex deployment.
//
// Why this exists: `NEXT_PUBLIC_*` is inlined by Next at BUILD time, and Next
// loads `.env.local` at HIGHER precedence than `.env.production`. So a
// production build run by hand on a dev machine silently froze that machine's
// `convex dev` URL into the shipped client bundle, and the live site talked to
// the dev backend. Nothing failed; it just pointed at the wrong database.
//
// "Production build" is NOT sniffed from NODE_ENV or CI env vars here. Both are
// true for preview builds and for a plain local `pnpm build`, which legitimately
// target a non-production deployment — sniffing would make this guard fire on
// builds that are perfectly fine. Instead the two production build entry points
// opt in explicitly by calling this script:
//
//   • package.json `build:cf` (what `pnpm run deploy` and scripts/ci-build.mjs run)
//   • .github/workflows/deploy-production.yml
//
// Everything else — `next dev`, `convex dev`, preview builds, `pnpm test` —
// never invokes it.
//
// The expected value is read from, in order:
//   1. $EXPECTED_PRODUCTION_CONVEX_URL  (escape hatch / override)
//   2. NEXT_PUBLIC_CONVEX_URL in .env.production  (the committed source of truth)
// so the production URL is not hardcoded in this file.

import { readFileSync } from "node:fs";

const VAR = "NEXT_PUBLIC_CONVEX_URL";
const OVERRIDE_VAR = "EXPECTED_PRODUCTION_CONVEX_URL";

// Next's env precedence for a production build, highest first. `process.env`
// outranks every file, which is how `convex deploy --cmd-url-env-var-name`
// injects the deployment it just pushed to.
const ENV_FILES = [
  ".env.production.local",
  ".env.local",
  ".env.production",
  ".env",
];

/** Minimal dotenv reader: returns the value of `key`, or undefined. */
function readFromFile(file, key) {
  let raw;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return undefined; // file absent is normal
  }
  for (const line of raw.split("\n")) {
    const match = /^\s*(?:export\s+)?([\w.-]+)\s*=\s*(.*)$/.exec(line);
    if (!match || match[1] !== key) continue;
    return match[2]
      .trim()
      .replace(/^(['"])(.*)\1$/, "$2")
      .replace(/\s+#.*$/, "")
      .trim();
  }
  return undefined;
}

/** Resolve `key` the way Next will when it inlines it. */
function resolve(key) {
  if (process.env[key])
    return { value: process.env[key], source: "process.env" };
  for (const file of ENV_FILES) {
    const value = readFromFile(file, key);
    if (value) return { value, source: file };
  }
  return { value: undefined, source: "unset" };
}

const expected =
  process.env[OVERRIDE_VAR] || readFromFile(".env.production", VAR);

if (!expected) {
  console.error(
    `[convex-url-guard] FAIL: cannot determine the expected production URL.\n` +
      `  Set $${OVERRIDE_VAR}, or restore ${VAR} in .env.production.`,
  );
  process.exit(1);
}

const actual = resolve(VAR);

if (actual.value !== expected) {
  console.error(
    [
      `[convex-url-guard] FAIL: production build would inline the wrong Convex deployment.`,
      ``,
      `  expected ${VAR}: ${expected}`,
      `  resolved ${VAR}: ${actual.value ?? "<unset>"}   (from ${actual.source})`,
      ``,
      actual.source === ".env.local"
        ? `  .env.local overrides .env.production in Next. Do not run production\n` +
          `  builds by hand on a dev machine — let .github/workflows/deploy-production.yml\n` +
          `  do it, where 'convex deploy --cmd-url-env-var-name' injects the real URL.`
        : `  Build via 'convex deploy --cmd ... --cmd-url-env-var-name ${VAR}' so the\n` +
          `  URL always matches the deployment the backend was just pushed to.`,
      ``,
      `  Refusing to build. Nothing was deployed.`,
    ].join("\n"),
  );
  process.exit(1);
}

console.log(
  `[convex-url-guard] OK: ${VAR}=${actual.value} (from ${actual.source})`,
);
