import { expect, test } from "@playwright/test";

/**
 * @live — the full quote happy path. Step 3 triggers ONE real Anthropic call
 * through the dev Convex deployment (api.estimate.draftEstimate); if the
 * backend or model is unreachable the client falls back to the static
 * estimate, and both paths render the same estimate table. The submit writes
 * a real row to the DEV quotes table (name prefixed "E2E TEST" so it is easy
 * to spot) and may send a dev-test-mode email — acceptable.
 */
test(
  "quote happy path: job → contact → estimate → slot → confirmation",
  { tag: "@live" },
  async ({ page }) => {
    test.setTimeout(240_000);

    await page.goto("/quote", { timeout: 60_000 });
    await expect(page.locator("h1")).toContainText("Get working numbers");

    // ---- Step 1: the job -------------------------------------------------
    await page
      .getByLabel("Job type")
      .selectOption({ label: "Heavy equipment repair" });
    await page
      .getByLabel("What needs welding or building")
      .fill(
        "Cracked bucket ear on a 320 excavator. Crack runs about 8 in along the pin boss. (E2E TEST request — please disregard.)",
      );
    await page.getByRole("button", { name: "Send the details" }).click();

    // ---- Step 2: contact (name + 10-digit phone, no email) ---------------
    await expect(
      page.getByRole("heading", { name: "Where do we send the numbers" }),
    ).toBeVisible({ timeout: 15_000 });
    // Required-field labels render as "Name*" / "Phone*", so no exact match.
    await page.getByLabel("Name").fill("E2E TEST Playwright");
    await page.getByLabel("Phone").fill("8175550123");
    await page.getByRole("button", { name: "Run the estimate" }).click();

    // ---- Step 3: estimate (real AI draft or the static fallback) ---------
    // Both paths render the same panel: badge, line-item table, dollar
    // range and the AI disclaimer.
    await expect(page.getByText("AI draft — not a final quote")).toBeVisible({
      timeout: 90_000,
    });
    // Table header + at least one line item.
    await expect(page.locator(".qf-li-row").first()).toContainText("Task");
    expect(await page.locator(".qf-li-row").count()).toBeGreaterThanOrEqual(2);
    // Confidence gating: medium/high-confidence drafts render a dollar range
    // like "$750 – $1,750"; low-confidence drafts (and the static fallback)
    // withhold dollars and render the withheld line instead.
    await expect(
      page
        .getByText(/\$[\d,]+ – \$[\d,]+/)
        .or(page.getByText("Eric sets the number on the call"))
        .first(),
    ).toBeVisible();
    // Disclaimer.
    await expect(
      page.getByText(/An AI drafted these numbers from your description/),
    ).toBeVisible();

    // ---- Pick a callback slot and submit ---------------------------------
    const slot = page.locator(".qf-slot").first();
    await slot.click();
    await expect(slot).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Send the request" }).click();

    // ---- Step 4: confirmation with a Q- request id -----------------------
    await expect(
      page.getByRole("heading", { name: "Request sent." }),
    ).toBeVisible({ timeout: 60_000 });
    await expect(
      page.getByText(/Your reference is Q-\d{4}-\d{3,4}\./),
    ).toBeVisible();
    await expect(
      page.getByText(
        "A copy went to eric@tidwellwelding.com. Check your email for the recap.",
      ),
    ).toBeVisible();
    // The admin console is not publicly linked; the secondary CTA
    // points at the job log instead.
    await expect(
      page.getByRole("link", { name: "See the work" }),
    ).toHaveAttribute("href", "/work");
    await expect(page.locator("a[href^='/admin']")).toHaveCount(0);
  },
);
