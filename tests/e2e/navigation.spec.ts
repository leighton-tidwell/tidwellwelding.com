import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ timeout: 120_000 });

/** Width in px of the red seam under a desktop nav link (0 = inactive). */
async function seamWidth(page: Page, label: string): Promise<number> {
  return page
    .locator(".site-nav a", { hasText: label })
    .locator(".site-nav__seam")
    .evaluate((el) => (el as HTMLElement).offsetWidth);
}

test.describe("desktop header", () => {
  test("header links navigate and the active seam moves", async ({ page }) => {
    await page.goto("/", { timeout: 60_000 });

    const nav = page.locator(".site-nav");
    await expect(nav).toBeVisible();

    // Home starts active: seam under Home, none under Services.
    await expect(
      nav.getByRole("link", { name: "Home", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    expect(await seamWidth(page, "Home")).toBeGreaterThan(0);
    expect(await seamWidth(page, "Services")).toBe(0);

    const stops: { label: string; url: string; h1: string | RegExp }[] = [
      { label: "Services", url: "/services", h1: "Ask for the spec" },
      { label: "Work", url: "/work", h1: "The work speaks" },
      { label: "About", url: "/about", h1: "16 years on the torch" },
      { label: "Contact", url: "/contact", h1: "Eric answers" },
    ];

    let previous = "Home";
    for (const stop of stops) {
      await nav.getByRole("link", { name: stop.label, exact: true }).click();
      await expect(page).toHaveURL(stop.url, { timeout: 30_000 });
      await expect(page.locator("h1")).toContainText(stop.h1, {
        timeout: 30_000,
      });

      // Active state (and its seam) moved to the clicked link.
      const active = nav.getByRole("link", { name: stop.label, exact: true });
      await expect(active).toHaveAttribute("aria-current", "page");
      expect(await seamWidth(page, stop.label)).toBeGreaterThan(0);
      expect(await seamWidth(page, previous)).toBe(0);
      previous = stop.label;
    }

    // And back home.
    await nav.getByRole("link", { name: "Home", exact: true }).click();
    await expect(page).toHaveURL("/", { timeout: 30_000 });
    expect(await seamWidth(page, "Home")).toBeGreaterThan(0);
    expect(await seamWidth(page, "Contact")).toBe(0);
  });

  // SEO P1-4: footer service links moved from /services#anchor to the
  // dedicated per-service routes.
  test("footer service links land on the dedicated service pages", async ({
    page,
  }) => {
    const links: { label: string; url: string; h1: string }[] = [
      { label: "Fabrication", url: "/services/fabrication", h1: "Built to the spec" },
      { label: "Staircases & handrail", url: "/services/structural", h1: "pass the walk" },
      { label: "Pipe welding", url: "/services/pipe", h1: "Roots that pass" },
      { label: "Heavy equipment repair", url: "/services/equipment", h1: "holds under load" },
      { label: "Mobile welding", url: "/services/mobile", h1: "carries the shop" },
      { label: "Emergency & on-call", url: "/services/emergency", h1: "book appointments" },
    ];

    for (const link of links) {
      await page.goto("/", { timeout: 60_000 });
      await page
        .locator("footer nav[aria-label='Services']")
        .getByRole("link", { name: link.label, exact: true })
        .click();
      await expect(page).toHaveURL(link.url, { timeout: 30_000 });
      await expect(page.locator("h1")).toContainText(link.h1, {
        timeout: 30_000,
      });
    }
  });

  // SEO P0-5 + P1-1: the footer's town links and Search link resolve.
  test("footer service-area and search links land on real routes", async ({
    page,
  }) => {
    const areas: { label: string; url: string; h1: string }[] = [
      {
        label: "Welder in Granbury, TX",
        url: "/welder/granbury-tx",
        h1: "the home town",
      },
      {
        label: "Welder in Fort Worth, TX",
        url: "/welder/fort-worth-tx",
        h1: "rolls to Fort Worth",
      },
      {
        label: "Welder in Stephenville, TX",
        url: "/welder/stephenville-tx",
        h1: "forty minutes down",
      },
    ];
    for (const area of areas) {
      await page.goto("/", { timeout: 60_000 });
      await page
        .locator("footer nav[aria-label='Service areas']")
        .getByRole("link", { name: area.label, exact: true })
        .click();
      await expect(page).toHaveURL(area.url, { timeout: 30_000 });
      await expect(page.locator("h1")).toContainText(area.h1, {
        timeout: 30_000,
      });
    }

    await page.goto("/", { timeout: 60_000 });
    await page
      .locator("footer nav[aria-label='Company']")
      .getByRole("link", { name: "Search", exact: true })
      .click();
    await expect(page).toHaveURL("/search", { timeout: 30_000 });
    await expect(page.locator("h1")).toContainText("Find it fast", {
      timeout: 30_000,
    });
  });

  // The admin console must not be publicly linked; /admin is direct-URL only.
  test("public chrome contains no link to /admin", async ({ page }) => {
    for (const path of ["/", "/contact"]) {
      await page.goto(path, { timeout: 60_000 });
      await expect(page.locator("a[href^='/admin']")).toHaveCount(0);
      await expect(page.locator("body")).not.toContainText("Crew login");
    }
  });
});

test.describe("mobile header (390px)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("hamburger opens the sheet and its links navigate", async ({ page }) => {
    await page.goto("/", { timeout: 60_000 });

    // Desktop nav is hidden; the toggle is shown instead.
    await expect(page.locator(".site-nav")).toBeHidden();
    const toggle = page.getByRole("button", { name: "Open the menu" });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    await toggle.click();
    await expect(
      page.getByRole("button", { name: "Close the menu" }),
    ).toHaveAttribute("aria-expanded", "true");
    const sheet = page.locator("#site-menu");
    await expect(sheet).toBeVisible();

    // A sheet link navigates and the sheet closes on the route change.
    await sheet.getByRole("link", { name: "Work", exact: true }).click();
    await expect(page).toHaveURL("/work", { timeout: 30_000 });
    await expect(page.locator("h1")).toContainText("The work speaks", {
      timeout: 30_000,
    });
    await expect(sheet).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Open the menu" }),
    ).toHaveAttribute("aria-expanded", "false");
  });
});
