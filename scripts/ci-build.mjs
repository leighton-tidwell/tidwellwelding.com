#!/usr/bin/env node
// Build entry point for Cloudflare Workers Builds.
//
// Workers Builds runs the build command on EVERY branch it is configured to
// watch, then swaps only the deploy step for non-production branches. So the
// branch guard has to live here: `convex deploy` pushes backend functions to
// the Convex production deployment, and a feature branch must never do that.
//
// main            -> deploy Convex prod, then build with the prod URL injected
// any other ref   -> build only; public URLs come from .env.production
//
// Locally (no WORKERS_CI_BRANCH) this behaves like main, matching `pnpm run deploy`.

import { spawnSync } from "node:child_process";

const branch = process.env.WORKERS_CI_BRANCH;
const isProductionBuild = branch === undefined || branch === "main";

const command = isProductionBuild ? "pnpm" : "pnpm";
const args = isProductionBuild
  ? ["run", "build:cf"]
  : ["exec", "opennextjs-cloudflare", "build"];

console.log(
  `[ci-build] branch=${branch ?? "<local>"} → ${
    isProductionBuild
      ? "Convex prod deploy + Worker build"
      : "Worker build only (Convex untouched)"
  }`,
);

const result = spawnSync(command, args, { stdio: "inherit" });
process.exit(result.status ?? 1);
