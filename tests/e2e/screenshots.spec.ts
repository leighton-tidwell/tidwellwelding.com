import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

/**
 * Not a test: drives the console to capture screenshots for review.
 * Run with: E2E_PORT=3399 pnpm exec playwright test tests/e2e/screenshots.spec.ts
 */
const OUT = "/tmp/tsws-shots";

function credentials() {
  const file = path.join(__dirname, ".admin-credentials.json");
  return JSON.parse(readFileSync(file, "utf8")) as {
    email: string;
    password: string;
  };
}

test("capture the console", async ({ page }) => {
  const { email, password } = credentials();

  // 1. Login
  await page.goto("/admin", { timeout: 60_000 });
  await page.screenshot({ path: `${OUT}/01-login.png`, fullPage: true });

  // 2. Set password screen
  await page.goto("/admin/set-password?token=example-token", { timeout: 60_000 });
  await page.screenshot({ path: `${OUT}/02-set-password.png`, fullPage: true });

  // Sign in for the rest.
  await page.goto("/admin", { timeout: 60_000 });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible({
    timeout: 20_000,
  });

  // 3. Invoice list
  await page.screenshot({ path: `${OUT}/03-invoices.png`, fullPage: true });

  // 4. Customers
  await page.getByRole("button", { name: "Customers" }).click();
  const name = `Bishop Fabrication ${Date.now().toString().slice(-5)}`;
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Company").fill("Bishop Fabrication LLC");
  await page.getByLabel("Phone").fill("(972) 999-7505");
  await page.getByLabel("Address").fill("4100 County Road 1004, Joshua TX 76058");
  await page.getByRole("button", { name: "Save customer" }).click();
  await expect(page.getByText(name)).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: `${OUT}/04-customers.png`, fullPage: true });

  // 5. The reference invoice, fully filled in
  await page.getByRole("button", { name: "Invoices" }).click();
  await page.getByLabel("Customer").selectOption({ label: name });
  await page.getByRole("button", { name: "Create invoice" }).click();
  await expect(page.locator("h1.admin-title")).toContainText(/^TSWS-/, {
    timeout: 15_000,
  });

  const lines: [string, string, string, string][] = [
    ["1", "ea", "LiftMaster LA400UL, dual-swing operator with solar panel", "2999.00"],
    ["25", "hr", "Fabrication, installation and mobilization labor", "175.00"],
    ["1", "lot", "Fuel — mobilization surcharge", "44.08"],
    ["1", "ea", "Steel tubing, metal and fabrication consumables", "1124.60"],
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
  await expect(page.getByText("$9,518.08").first()).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: `${OUT}/05-invoice-editor.png`, fullPage: true });

  // 6. Customer detail with the billed roll-up
  await page.getByRole("button", { name: "Customers" }).click();
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await expect(page.getByText(/billed/)).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: `${OUT}/06-customer-detail.png`, fullPage: true });

  // 7. Download the PDF for visual review
  await page.getByRole("button", { name: /TSWS-/ }).first().click();
  await expect(page.getByRole("button", { name: /Download PDF/ })).toBeVisible({
    timeout: 15_000,
  });
  const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
  await page.getByRole("button", { name: /Download PDF/ }).click();
  const download = await downloadPromise;
  await download.saveAs(`${OUT}/invoice.pdf`);
});

test("capture the phone view", async ({ page }) => {
  test.use;
  const { email, password } = credentials();
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("/admin", { timeout: 60_000 });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible({
    timeout: 20_000,
  });

  await page.getByRole("button", { name: /TSWS-/ }).first().click();
  await expect(page.locator(".admin-sticky-total")).toBeVisible({
    timeout: 15_000,
  });
  await page.screenshot({ path: `${OUT}/07-phone-editor.png`, fullPage: true });
});
