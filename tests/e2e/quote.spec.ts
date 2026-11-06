import { expect, test } from "@playwright/test";

/**
 * @live — the full quote happy path against the local stack. Step 3 calls the
 * estimator, which talks to the Anthropic fake (local/fakes.mjs); the submit
 * writes a quote row and sends the owner email through the Resend fake, which
 * this test then reads back.
 */
const FAKES = `http://127.0.0.1:${process.env.FAKES_PORT ?? "4010"}`;

test("quote happy path: job → contact → estimate → slot → confirmation", {
  tag: "@live",
}, async ({ page }) => {
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
  const reference = page.getByText(/Your reference is Q-\d{4}-\d{3,4}\./);
  await expect(reference).toBeVisible();
  const requestId = (await reference.textContent())?.match(
    /Q-\d{4}-\d{3,4}/,
  )?.[0];

  // The owner email really went out, with the callback invite attached.
  await expect
    .poll(async () => {
      const emails = (await (await fetch(`${FAKES}/emails`)).json()) as {
        subject: string;
        attachments?: { filename: string }[];
      }[];
      const owner = emails.find((e) =>
        e.subject.startsWith(`Quote request ${requestId}`),
      );
      return owner?.attachments?.map((a) => a.filename.endsWith(".ics"));
    })
    .toEqual([true]);
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
});
