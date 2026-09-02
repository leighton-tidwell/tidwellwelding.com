import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * Icons inside buttons sat a few pixels high: `.tsws-icon` is inline-grid with
 * `vertical-align: baseline`, so the flex row put it on the text baseline
 * rather than the optical centre of the label.
 */
test("icons are vertically centred against their button label", async ({
  page,
}) => {
  const creds = JSON.parse(
    fs.readFileSync(path.join(__dirname, ".admin-credentials.json"), "utf8"),
  );

  await page.goto("/admin");
  await page.getByLabel("Email").fill(creds.email);
  await page.getByLabel("Password").fill(creds.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible({
    timeout: 20_000,
  });

  const offsets = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".tsws-btn"))
      .map((btn) => {
        const icon = btn.querySelector(".tsws-icon");
        const label = btn.querySelector(".tsws-btn__label");
        if (!icon || !label) return null;
        const i = icon.getBoundingClientRect();
        const l = label.getBoundingClientRect();
        return {
          text: (btn.textContent || "").trim().slice(0, 24),
          delta: i.top + i.height / 2 - (l.top + l.height / 2),
        };
      })
      .filter(Boolean),
  );

  expect(offsets.length).toBeGreaterThan(0);
  for (const entry of offsets as Array<{ text: string; delta: number }>) {
    // Sub-pixel rounding is fine; a visible few-pixel lift is not.
    expect(
      Math.abs(entry.delta),
      `"${entry.text}" icon off-centre`,
    ).toBeLessThan(1);
  }
});
