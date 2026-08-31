import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ timeout: 180_000 });

/**
 * These specs drive the real dev Convex deployment. The owner account and its
 * password are created by tests/e2e/admin.setup.ts before the suite runs, which
 * writes the credentials to tests/e2e/.admin-credentials.json.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

type Credentials = { email: string; password: string; usedSetupToken: string };

function credentials(): Credentials {
  const file = path.join(__dirname, ".admin-credentials.json");
  return JSON.parse(readFileSync(file, "utf8")) as Credentials;
}

/**
 * Login is rate limited (10 attempts / 15 min per email) — a real security
 * control, not a test obstacle. Signing in once per worker and replaying the
 * session token keeps the suite from exhausting its own budget.
 */
let cachedSessionToken: string | null = null;

async function signIn(page: Page) {
  const { email, password } = credentials();

  if (cachedSessionToken) {
    await page.goto("/admin", { timeout: 60_000 });
    await page.evaluate(
      ([key, token]) => window.sessionStorage.setItem(key, token),
      ["tsws_admin_session", cachedSessionToken] as const,
    );
    await page.reload();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible({
      timeout: 20_000,
    });
    return;
  }

  await page.goto("/admin", { timeout: 60_000 });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible({
    timeout: 20_000,
  });
  cachedSessionToken = await page.evaluate(() =>
    window.sessionStorage.getItem("tsws_admin_session"),
  );
}

/** Next.js injects its own role="alert" route announcer, so scope to ours. */
function formAlert(page: Page) {
  return page.locator("p[role='alert']");
}

/** A unique customer name per run so repeated runs never collide. */
function uniqueName(prefix: string) {
  return `${prefix} ${Date.now().toString().slice(-7)}`;
}

test.describe("access control", () => {
  test("the sign-in screen shows no data before authenticating", async ({ page }) => {
    await page.goto("/admin", { timeout: 60_000 });

    await expect(page.getByRole("heading", { name: "Shop admin" })).toBeVisible();
    // Nothing from the console may render behind the gate.
    await expect(page.getByRole("heading", { name: "Invoices" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
  });

  test("a wrong password is rejected and does not sign anyone in", async ({ page }) => {
    const { email } = credentials();
    await page.goto("/admin", { timeout: 60_000 });

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("definitely-not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    // Either rejection is correct: bad credentials, or the rate limiter
    // stepping in. What must never happen is getting in.
    await expect(formAlert(page)).toContainText(
      /incorrect|did not match|too many/i,
    );
    await expect(page.getByRole("heading", { name: "Invoices" })).toHaveCount(0);
  });

  test("an unknown email fails the same way, revealing nothing", async ({ page }) => {
    await page.goto("/admin", { timeout: 60_000 });

    await page.getByLabel("Email").fill("nobody@example.com");
    await page.getByLabel("Password").fill("some-long-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(formAlert(page)).toContainText(
      /incorrect|did not match|too many/i,
    );
    await expect(page.getByRole("heading", { name: "Invoices" })).toHaveCount(0);
  });

});

test.describe("the set-password link burns after one use", () => {
  test("the token already used during setup is refused a second time", async ({
    page,
  }) => {
    const { usedSetupToken } = credentials();

    await page.goto(`/admin/set-password?token=${usedSetupToken}`, {
      timeout: 60_000,
    });
    await page.getByLabel("New password").fill("another-long-password-1");
    await page.getByLabel("Confirm password").fill("another-long-password-1");
    await page.getByRole("button", { name: "Save password" }).click();

    await expect(formAlert(page)).toContainText(/no longer valid/i);
    await expect(page.getByRole("heading", { name: "You are set" })).toHaveCount(0);
  });

  test("a made-up token is refused", async ({ page }) => {
    await page.goto("/admin/set-password?token=deadbeefdeadbeefdeadbeef", {
      timeout: 60_000,
    });
    await page.getByLabel("New password").fill("another-long-password-1");
    await page.getByLabel("Confirm password").fill("another-long-password-1");
    await page.getByRole("button", { name: "Save password" }).click();

    await expect(formAlert(page)).toContainText(/no longer valid/i);
  });

  test("mismatched confirmations never reach the server", async ({ page }) => {
    await page.goto("/admin/set-password?token=whatever", { timeout: 60_000 });
    await page.getByLabel("New password").fill("a-long-enough-password");
    await page.getByLabel("Confirm password").fill("a-different-password-x");
    await page.getByRole("button", { name: "Save password" }).click();

    await expect(formAlert(page)).toContainText(/do not match/i);
  });
});

test.describe("invoicing, end to end", () => {
  test("build the reference invoice and get the balance right", async ({ page }) => {
    await signIn(page);

    // A customer to bill.
    const name = uniqueName("Bishop");
    await page.getByRole("button", { name: "Customers" }).click();
    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Phone").fill("(972) 999-7505");
    await page.getByRole("button", { name: "Save customer" }).click();
    await expect(page.getByText(name)).toBeVisible({ timeout: 15_000 });

    // Start an invoice for them.
    await page.getByRole("button", { name: "Invoices" }).click();
    await page.getByLabel("Customer").selectOption({ label: name });
    await page.getByRole("button", { name: "Create invoice" }).click();
    await expect(page.locator("h1.admin-title")).toContainText(/^TSWS-\d{6}/, { timeout: 15_000 });

    // The seven lines from the owner's real invoice, fuel split onto its own
    // row. Totals must land on $9,518.08.
    const lines: [string, string, string, string][] = [
      ["1", "ea", "LiftMaster LA400UL dual-swing operator", "2999.00"],
      ["25", "hr", "Fabrication, installation and mobilization labor", "175.00"],
      ["1", "lot", "Fuel — mobilization surcharge", "44.08"],
      ["1", "ea", "Steel tubing and fabrication consumables", "1124.60"],
      ["1", "ea", "Paint and finishing supplies", "150.00"],
      ["1", "ea", "Concrete", "50.00"],
      ["1", "ea", "Plasma-cutting consumables", "50.00"],
    ];

    for (let i = 0; i < lines.length; i += 1) {
      if (i > 0) await page.getByRole("button", { name: "Add line" }).click();
      const row = page.getByRole("group", { name: `Line item ${i + 1}` });
      const [qty, unit, description, rate] = lines[i];
      await row.getByLabel("Qty").fill(qty);
      await row.getByLabel("Unit").selectOption(unit);
      await row.getByLabel("Description of work / materials").fill(description);
      await row.getByLabel("Rate").fill(rate);
    }

    await page.getByRole("button", { name: "Save changes" }).click();

    // The number the owner actually cares about.
    await expect(page.getByText("$9,518.08").first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("$8,792.68")).toBeVisible();
    await expect(page.getByText("$725.40")).toBeVisible();
  });

  test("downloading produces a real PDF and blocks repeat clicks", async ({
    page,
  }) => {
    await signIn(page);

    const name = uniqueName("Download");
    await page.getByRole("button", { name: "Customers" }).click();
    await page.getByLabel("Name").fill(name);
    await page.getByRole("button", { name: "Save customer" }).click();
    await expect(page.getByText(name)).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Invoices" }).click();
    await page.getByLabel("Customer").selectOption({ label: name });
    await page.getByRole("button", { name: "Create invoice" }).click();

    const row = page.getByRole("group", { name: "Line item 1" });
    await row.getByLabel("Qty").fill("4");
    await row.getByLabel("Unit").selectOption("hr");
    await row.getByLabel("Description of work / materials").fill("Gate repair");
    await row.getByLabel("Rate").fill("175.00");
    await page.getByRole("button", { name: "Save changes" }).click();

    const button = page.getByRole("button", { name: /Download PDF/ });
    const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
    await button.click();

    // While it works the control must lock, or an impatient tap fires again.
    await expect(page.getByRole("button", { name: /Building the PDF/ })).toBeVisible();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^TSWS-\d{6}(-\d+)?\.pdf$/);

    // Prove the bytes are a PDF, not an error page saved with a .pdf name.
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const bytes = Buffer.concat(chunks);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(bytes.byteLength).toBeGreaterThan(1000);

    // And it recovers: the button comes back for a second download.
    await expect(button).toBeEnabled({ timeout: 30_000 });
  });

  test("a customer's invoices and billed total appear on their page", async ({
    page,
  }) => {
    await signIn(page);

    const name = uniqueName("Ledger");
    await page.getByRole("button", { name: "Customers" }).click();
    await page.getByLabel("Name").fill(name);
    await page.getByRole("button", { name: "Save customer" }).click();
    await expect(page.getByText(name)).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Invoices" }).click();
    await page.getByLabel("Customer").selectOption({ label: name });
    await page.getByRole("button", { name: "Create invoice" }).click();

    const row = page.getByRole("group", { name: "Line item 1" });
    await row.getByLabel("Qty").fill("1");
    await row.getByLabel("Description of work / materials").fill("Gate");
    await row.getByLabel("Rate").fill("1000.00");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("$1,082.50").first()).toBeVisible({
      timeout: 20_000,
    });

    // The customer page rolls it up.
    await page.getByRole("button", { name: "Customers" }).click();
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await expect(page.getByText("$1,082.50 billed")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("status is the owner's to set by hand", async ({ page }) => {
    await signIn(page);

    const name = uniqueName("Status");
    await page.getByRole("button", { name: "Customers" }).click();
    await page.getByLabel("Name").fill(name);
    await page.getByRole("button", { name: "Save customer" }).click();
    await expect(page.getByText(name)).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Invoices" }).click();
    await page.getByLabel("Customer").selectOption({ label: name });
    await page.getByRole("button", { name: "Create invoice" }).click();

    await page.getByLabel("Status").selectOption("paid");
    await page.getByRole("button", { name: "All invoices" }).click();
    await expect(page.getByText("paid").first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the editor is usable and the balance stays visible", async ({ page }) => {
    await signIn(page);

    const name = uniqueName("Phone");
    await page.getByRole("button", { name: "Customers" }).click();
    await page.getByLabel("Name").fill(name);
    await page.getByRole("button", { name: "Save customer" }).click();
    await expect(page.getByText(name)).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Invoices" }).click();
    await page.getByLabel("Customer").selectOption({ label: name });
    await page.getByRole("button", { name: "Create invoice" }).click();

    const row = page.getByRole("group", { name: "Line item 1" });
    await row.getByLabel("Qty").fill("2");
    await row.getByLabel("Unit").selectOption("hr");
    await row.getByLabel("Description of work / materials").fill("Site work");
    await row.getByLabel("Rate").fill("175.00");
    await page.getByRole("button", { name: "Save changes" }).click();

    // The sticky footer keeps the balance on screen while editing.
    const sticky = page.locator(".admin-sticky-total");
    await expect(sticky).toBeVisible();
    await expect(sticky).toContainText("$378.88");

    // Nothing may overflow the viewport horizontally.
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(scrollWidth).toBeLessThanOrEqual(390);
  });

  test("touch targets are big enough to hit", async ({ page }) => {
    await signIn(page);
    // 44px is the WCAG 2.2 target-size guidance; below that is a miss on a
    // phone held in a work glove.
    const button = page.getByRole("button", { name: "Customers" }).first();
    const box = await button.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe("accessibility", () => {
  test("the sign-in screen has no axe violations", async ({ page }) => {
    await page.goto("/admin", { timeout: 60_000 });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test("the set-password screen has no axe violations", async ({ page }) => {
    await page.goto("/admin/set-password?token=example", { timeout: 60_000 });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test("the console and invoice editor have no axe violations", async ({ page }) => {
    await signIn(page);

    const listResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(listResults.violations).toEqual([]);

    const name = uniqueName("Axe");
    await page.getByRole("button", { name: "Customers" }).click();
    await page.getByLabel("Name").fill(name);
    await page.getByRole("button", { name: "Save customer" }).click();
    await expect(page.getByText(name)).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Invoices" }).click();
    await page.getByLabel("Customer").selectOption({ label: name });
    await page.getByRole("button", { name: "Create invoice" }).click();
    await expect(page.locator("h1.admin-title")).toContainText(/^TSWS-\d{6}/, { timeout: 15_000 });

    const editorResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(editorResults.violations).toEqual([]);
  });
});

/**
 * Runs last on purpose: signing out destroys the shared session token, and a
 * fresh login costs one of the ten attempts the rate limiter allows per window.
 */
test.describe("signing out", () => {
  test("returns to the gate and does not survive a reload", async ({ page }) => {
    await signIn(page);
    await page.getByRole("button", { name: "Sign out" }).click();

    await expect(page.getByRole("heading", { name: "Shop admin" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "Shop admin" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Invoices" })).toHaveCount(0);

    cachedSessionToken = null;
  });
});
