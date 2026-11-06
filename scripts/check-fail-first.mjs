#!/usr/bin/env node
// Fail-first gate: every NEW Vitest test on this branch must fail against
// main's code and pass against this branch's code. A test that passes both
// times can't catch the problem it claims to cover.
//
// How: check out the merge base in a temporary worktree, drop this branch's
// new/changed *.test.ts(x) files into it, and run just those files there.
// Tests that already existed on main (same file and name) are not checked.
// E2E specs are out of scope.
import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const root = git("rev-parse", "--show-toplevel");
const base = git("merge-base", "HEAD", process.env.BASE_REF ?? "origin/main");

// Tests added, changed or moved on this branch, plus every test file this
// branch touched on main's side (changed, renamed or deleted). A test counts
// as new only if its name exists in none of those, so moving or splitting a
// file doesn't make its old tests look new.
const changed = [];
const onMainFiles = new Set();
for (const line of git("diff", "--name-status", "-M", base, "HEAD").split(
  "\n",
)) {
  const [status = "", from, to] = line.split("\t");
  const isTest = (f) => f && /\.test\.tsx?$/.test(f);
  if (status[0] !== "A" && isTest(from)) onMainFiles.add(from);
  const now = to ?? from;
  if (status[0] !== "D" && isTest(now)) changed.push(now);
}

if (changed.length === 0) {
  console.log("fail-first: no new or changed unit tests");
  process.exit(0);
}

// realpath: Vitest reports resolved paths (/private/var on macOS).
const tmp = realpathSync(mkdtempSync(path.join(tmpdir(), "fail-first-")));
const baseDir = path.join(tmp, "base");

/** Run Vitest on `files` in `cwd`; returns Map<"file > test name", status>.
 * Not `vitest list`: it reports test.each names unexpanded. */
function vitest(cwd, files, label) {
  const results = new Map();
  if (files.length === 0) return results;
  const out = path.join(tmp, `${label}.json`);
  const args = ["run", "--reporter=json", `--outputFile=${out}`, ...files];
  // The binary directly: `pnpm exec` rejects the symlinked node_modules.
  spawnSync(path.join(root, "node_modules/.bin/vitest"), args, {
    cwd,
    stdio: "ignore",
  });
  if (!existsSync(out)) return results;
  const json = JSON.parse(readFileSync(out, "utf8"));
  for (const file of json.testResults) {
    const rel = path.relative(cwd, file.name);
    for (const t of file.assertionResults) {
      results.set(
        `${rel} > ${[...t.ancestorTitles, t.title].join(" > ")}`,
        t.status,
      );
    }
    // A file that fails to load (e.g. imports code main doesn't have) has no
    // per-test results; every test in it counts as failing on main.
    if (file.assertionResults.length === 0) results.set(`${rel} > *`, "failed");
  }
  return results;
}

try {
  git("worktree", "add", "--detach", baseDir, base);
  symlinkSync(
    path.join(root, "node_modules"),
    path.join(baseDir, "node_modules"),
  );

  const testName = (key) => key.slice(key.indexOf(" > ") + 3);
  const onMainBefore = new Set(
    [...vitest(baseDir, [...onMainFiles], "main-before").keys()].map(testName),
  );

  for (const f of changed) cpSync(path.join(root, f), path.join(baseDir, f));
  const onMain = vitest(baseDir, changed, "main-after");
  const onBranch = vitest(root, changed, "branch");

  const fresh = [...onBranch.keys()].filter(
    (name) => !onMainBefore.has(testName(name)) && !name.endsWith(" > *"),
  );
  const notFailingFirst = fresh.filter((name) => {
    const file = name.split(" > ")[0];
    return (
      onMain.get(name) !== "failed" && onMain.get(`${file} > *`) !== "failed"
    );
  });
  const notPassing = fresh.filter((name) => onBranch.get(name) !== "passed");

  if (notFailingFirst.length || notPassing.length) {
    for (const n of notFailingFirst)
      console.error(`  passes on main too: ${n}`);
    for (const n of notPassing)
      console.error(`  doesn't pass on this branch: ${n}`);
    console.error(
      "fail-first: a new test must fail against main's code and pass against yours.\n" +
        "Make it assert the specific behavior this change adds or fixes.",
    );
    process.exitCode = 1;
  } else {
    console.log(
      `fail-first: ok, ${fresh.length} new tests fail on main and pass here`,
    );
  }
} finally {
  git("worktree", "remove", "--force", baseDir);
  rmSync(tmp, { recursive: true, force: true });
}
