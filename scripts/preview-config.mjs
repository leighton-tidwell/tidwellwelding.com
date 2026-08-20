#!/usr/bin/env node
// Emits wrangler.preview.jsonc: a throwaway Worker config for one PR.
//
// Previews get their OWN Worker (tidwellwelding-pr-N) rather than a version of
// the production Worker, because a whole Worker can be deleted on PR close and
// an uploaded version cannot. Everything about that is safety-critical:
//
//   • `routes` is STRIPPED. The production config binds tidwellwelding.com and
//     www as custom domains; deploying a preview that inherited them would
//     point the live domain at unreviewed code. Never reintroduce it here.
//   • `workers_dev` is forced on so the preview gets its own *.workers.dev URL
//     (production keeps it off to avoid duplicate indexable hosts; robots.ts
//     disallows *.workers.dev regardless).
//   • WORKER_SELF_REFERENCE is repointed at the preview Worker so it doesn't
//     call back into production.
//   • CREW_ACCESS_KEY is set to a throwaway value so /crew stays gated here
//     exactly as it is in production.

import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const prNumber = process.argv[2];
if (!prNumber) {
  console.error("usage: node scripts/preview-config.mjs <pr-number>");
  process.exit(1);
}

const name = `tidwellwelding-pr-${prNumber}`;

// Strip JSONC comments before parsing.
const raw = readFileSync("wrangler.jsonc", "utf8");
const config = JSON.parse(
  raw.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, ""),
);

config.name = name;
delete config.routes; // never let a preview answer for the real domain
config.workers_dev = true;
config.preview_urls = false; // the Worker's own subdomain is the preview

if (Array.isArray(config.services)) {
  config.services = config.services.map((s) =>
    s.binding === "WORKER_SELF_REFERENCE" ? { ...s, service: name } : s,
  );
}

config.vars = {
  ...(config.vars ?? {}),
  CREW_ACCESS_KEY: randomBytes(12).toString("hex"),
};

writeFileSync("wrangler.preview.jsonc", JSON.stringify(config, null, 2) + "\n");
console.log(`[preview-config] ${name} — routes stripped, workers_dev on`);
