#!/usr/bin/env node
// PR size gate: at most 500 changed lines and 10 files against main.
// Lockfiles and generated code don't count. Over the limit, the PR body must
// carry a filled-in "## Explainer" section (CI passes it as PR_BODY; locally
// the body is read with `gh pr view` when the branch has a PR).
import { execFileSync } from "node:child_process";

const MAX_LINES = 500;
const MAX_FILES = 10;
const IGNORED = [/^pnpm-lock\.yaml$/, /^convex\/_generated\//, /\.snap$/];

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

const base = git("merge-base", "HEAD", process.env.BASE_REF ?? "origin/main");
const files = git("diff", "--numstat", base, "HEAD")
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    const [added, deleted, path] = line.split("\t");
    // Binary files report "-"; count them as one line.
    return { path, lines: (Number(added) || 1) + (Number(deleted) || 0) };
  })
  .filter(({ path }) => !IGNORED.some((re) => re.test(path)));

const lines = files.reduce((sum, f) => sum + f.lines, 0);
const summary = `${lines} lines in ${files.length} files (limit ${MAX_LINES} / ${MAX_FILES})`;

if (lines <= MAX_LINES && files.length <= MAX_FILES) {
  console.log(`pr-size: ok, ${summary}`);
  process.exit(0);
}

let body = process.env.PR_BODY;
if (body === undefined) {
  try {
    body = execFileSync("gh", ["pr", "view", "--json", "body", "-q", ".body"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    body = "";
  }
}

const explainer = body.split(/^## Explainer\s*$/m)[1]?.split(/^## /m)[0] ?? "";
const filled = explainer.replace(/<!--[\s\S]*?-->/g, "").trim().length > 0;

if (filled) {
  console.log(`pr-size: over the limit with an explainer, ${summary}`);
  process.exit(0);
}

console.error(
  `pr-size: ${summary}.\n` +
    "Split the work into a stack of smaller PRs, or fill in the PR body's " +
    '"## Explainer" section: what changed, why, and how the pieces connect.',
);
process.exit(1);
