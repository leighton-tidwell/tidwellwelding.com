import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ timeout: 120_000 });

/** The internal hourly rates must never render anywhere in the console. */
async function expectNoHourlyRates(page: Page, context: string) {
  const body = await page.locator("body").innerText();
  expect(body, `"$150" leaked in ${context}`).not.toContain("$150");
  expect(body, `"$100" leaked in ${context}`).not.toContain("$100");
}

/**
 * /crew is deliberately unlinked from public chrome (direct URL only).
 * Under the dev server CREW_ACCESS_KEY is unset, so the route renders
 * keyless; in production it 404s without ?key=<CREW_ACCESS_KEY>.
 */
async function login(page: Page) {
  await page.goto("/crew", { timeout: 60_000 });
  await expect(page.locator("h1")).toContainText("Crew console");
  await page.getByRole("button", { name: /Eric Tidwell/ }).click();
  await page.getByLabel("PIN").fill("4271");
  await page.getByRole("button", { name: "Open the console" }).click();
  await expect(page.getByText("Eric Tidwell · Owner")).toBeVisible({
    timeout: 15_000,
  });
}

test("PIN login opens the console with all owner tabs", async ({ page }) => {
  await login(page);

  for (const tab of ["Inbox", "Jobs", "Schedule", "Invoices", "Customers"]) {
    await expect(
      page.locator(".crew-tabs").getByRole("button", { name: tab, exact: true }),
    ).toBeVisible();
  }
});

test("inbox shows the seed quotes", async ({ page }) => {
  await login(page);

  await expect(page.getByText(/Quote inbox · \d+ open/)).toBeVisible();
  const seeds: { id: string; title: string }[] = [
    { id: "Q-2026-118", title: "Commercial staircase package" },
    { id: "Q-2026-121", title: "Frac tank seam leak" },
    { id: "Q-2026-124", title: "Ranch entry gate build" },
  ];
  for (const seed of seeds) {
    await expect(page.getByText(seed.id, { exact: true })).toBeVisible();
    await expect(page.getByText(seed.title).first()).toBeVisible();
  }
});

test("no $150 or $100 hourly rate text anywhere in the console", async ({
  page,
}) => {
  await login(page);

  // Inbox, including the internal bid draft panel once drafted.
  await expectNoHourlyRates(page, "inbox");
  await page.getByRole("button", { name: "Draft the bid" }).click();
  await expect(page.getByText("Bid range")).toBeVisible({ timeout: 15_000 });
  await expectNoHourlyRates(page, "inbox with drafted bid");

  // Every other tab.
  for (const tab of ["Jobs", "Schedule", "Invoices", "Customers"]) {
    await page
      .locator(".crew-tabs")
      .getByRole("button", { name: tab, exact: true })
      .click();
    await expectNoHourlyRates(page, `${tab} tab`);
  }
});
