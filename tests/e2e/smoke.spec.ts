import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ timeout: 120_000 });

/**
 * Every public route: 200, exactly one h1, a distinctive string, and no
 * uncaught page errors on load. Third-party embeds (TikTok, Google Maps,
 * Turnstile) run their own scripts — errors originating there are not ours
 * and are filtered out.
 */
const ROUTES: { path: string; h1Contains: string | RegExp }[] = [
  { path: "/", h1Contains: "robot ran them" },
  { path: "/services", h1Contains: "Ask for the spec" },
  { path: "/services/fabrication", h1Contains: "Built to the spec" },
  { path: "/services/structural", h1Contains: "pass the walk" },
  { path: "/services/pipe", h1Contains: "Roots that pass" },
  { path: "/services/equipment", h1Contains: "holds under load" },
  { path: "/services/mobile", h1Contains: "carries the shop" },
  { path: "/services/emergency", h1Contains: "book appointments" },
  { path: "/work", h1Contains: "The work speaks" },
  { path: "/about", h1Contains: "16 years on the torch" },
  { path: "/contact", h1Contains: "Eric answers" },
  { path: "/quote", h1Contains: "Get working numbers" },
  { path: "/welder/granbury-tx", h1Contains: "the home town" },
  { path: "/welder/fort-worth-tx", h1Contains: "rolls to Fort Worth" },
  { path: "/welder/stephenville-tx", h1Contains: "forty minutes down" },
  { path: "/search", h1Contains: "Find it fast" },
  { path: "/crew", h1Contains: "Crew console" },
];

const THIRD_PARTY = /tiktok\.com|google\.com|gstatic\.com|googleapis\.com|challenges\.cloudflare\.com|doubleclick\.net/;

function collectPageErrors(page: Page): Error[] {
  const errors: Error[] = [];
  page.on("pageerror", (err) => {
    if (THIRD_PARTY.test(err.stack ?? "") || THIRD_PARTY.test(err.message)) return;
    errors.push(err);
  });
  return errors;
}

for (const route of ROUTES) {
  test(`${route.path} loads clean`, async ({ page }) => {
    const errors = collectPageErrors(page);

    const response = await page.goto(route.path, {
      waitUntil: "load",
      timeout: 60_000,
    });
    expect(response, `no response for ${route.path}`).not.toBeNull();
    expect(response!.status(), `${route.path} should return 200`).toBe(200);

    // Exactly one h1, containing the page's distinctive string.
    await expect(page.locator("h1")).toHaveCount(1, { timeout: 15_000 });
    await expect(page.locator("h1")).toContainText(route.h1Contains);

    // Let hydration finish so late uncaught errors are caught too.
    await page.waitForTimeout(1_500);
    expect(
      errors.map((e) => e.message),
      `${route.path} raised uncaught page errors`,
    ).toEqual([]);
  });
}
