import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test as setup } from "@playwright/test";

/**
 * Provisions a disposable admin account on the DEV Convex deployment and walks
 * the real one-time setup link, so the rest of the suite has credentials and
 * the burn-on-use rule is exercised against the live backend rather than a mock.
 *
 * The owner's own account (eric@tidwellwelding.com) is never touched.
 */
const TEST_EMAIL = `e2e-admin-${Date.now()}@tidwellwelding.test`;
const TEST_PASSWORD = "e2e-password-not-a-secret";

function convexRun(fn: string, args: Record<string, unknown>): string {
  const out = execFileSync(
    "npx",
    ["convex", "run", fn, JSON.stringify(args)],
    { cwd: path.join(__dirname, "..", ".."), encoding: "utf8" },
  );
  // `convex run` prints the JSON return value on the last non-empty line.
  const lines = out.trim().split("\n").filter(Boolean);
  return JSON.parse(lines[lines.length - 1]) as string;
}

setup("provision an admin account through the real setup link", async ({ page }) => {
  const userId = convexRun("auth:createAdminUser", { email: TEST_EMAIL });
  const token = convexRun("auth:issueSetupToken", { userId });

  // Use the link exactly as the owner would.
  await page.goto(`/admin/set-password?token=${token}`, { timeout: 60_000 });
  await page.getByLabel("New password").fill(TEST_PASSWORD);
  await page.getByLabel("Confirm password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page.getByRole("heading", { name: "You are set" })).toBeVisible({
    timeout: 30_000,
  });

  // Prove the account works before the suite depends on it.
  await page.goto("/admin", { timeout: 60_000 });
  await page.getByLabel("Email").fill(TEST_EMAIL);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible({
    timeout: 30_000,
  });

  writeFileSync(
    path.join(__dirname, ".admin-credentials.json"),
    JSON.stringify(
      { email: TEST_EMAIL, password: TEST_PASSWORD, usedSetupToken: token },
      null,
      2,
    ),
  );
});
