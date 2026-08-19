import { expect, test } from "@playwright/test";

test.describe.configure({ timeout: 240_000 });

/**
 * A11y regression guard (WCAG 1.4.10 Reflow, findings P2-11): the axe audit
 * once caught a 47px horizontal overflow at 390px on every route (header
 * toggle pushed off-screen). Fixed via the <=479px wordmark rule in
 * globals.css — this pins the invariant: no route may scroll horizontally
 * at a 390px viewport.
 */
const ROUTES = [
  "/",
  "/services",
  "/services/fabrication",
  "/services/structural",
  "/services/pipe",
  "/services/equipment",
  "/services/mobile",
  "/services/emergency",
  "/work",
  "/about",
  "/contact",
  "/quote",
  "/welder/granbury-tx",
  "/welder/fort-worth-tx",
  "/welder/stephenville-tx",
  "/search",
];

test("no horizontal overflow on any public route at 390px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const path of ROUTES) {
    await page.goto(path, { waitUntil: "load", timeout: 60_000 });
    // Give hydration/layout a beat before measuring.
    await page.waitForTimeout(500);

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    expect(
      scrollWidth,
      `${path} overflows horizontally at 390px (scrollWidth ${scrollWidth} > clientWidth ${clientWidth})`,
    ).toBeLessThanOrEqual(clientWidth);
  }
});
