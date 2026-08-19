import { expect, test } from "@playwright/test";

test.describe.configure({ timeout: 120_000 });

/** Job-log counts per category (job-log.tsx JOBS array). */
const CATEGORY_COUNTS: { chip: string; count: number }[] = [
  { chip: "Fabrication", count: 2 },
  { chip: "Structural", count: 2 },
  { chip: "Equipment", count: 1 },
  { chip: "Pipe", count: 2 },
  { chip: "All jobs", count: 7 },
];

test("filter chips filter the job cards", async ({ page }) => {
  await page.goto("/work", { timeout: 60_000 });

  const cards = page.locator("article");
  await expect(cards).toHaveCount(7, { timeout: 30_000 });

  for (const { chip, count } of CATEGORY_COUNTS) {
    const button = page.getByRole("button", { name: chip, exact: true });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(cards).toHaveCount(count);

    // Every visible card belongs to the selected category.
    if (chip !== "All jobs") {
      for (let i = 0; i < count; i++) {
        await expect(cards.nth(i)).toContainText(
          `JOB — ${chip.toUpperCase()}`,
        );
      }
    }
  }
});

test("every video on /work has a poster", async ({ page }) => {
  await page.goto("/work", { timeout: 60_000 });

  // 2 job-card videos (All filter) + 8 field-wall videos. The pending
  // self-hosted TikTok tiles (/media/tiktok-clip-N.mp4) may add more.
  const videos = page.locator("video");
  await expect
    .poll(async () => videos.count(), { timeout: 30_000 })
    .toBeGreaterThanOrEqual(10);

  const entries = await videos.evaluateAll((els) =>
    els.map((el) => ({
      src: el.getAttribute("src") ?? "",
      poster: el.getAttribute("poster") ?? "",
    })),
  );
  const core = entries.filter((e) => !e.src.includes("/media/tiktok-clip-"));
  expect(core).toHaveLength(10);
  for (const entry of core) {
    expect(entry.poster, `${entry.src} is missing its poster`).toMatch(
      /^\/media\/.+\.jpg$/,
    );
  }
});

test("TikTok row mounts lazily without breaking layout", async ({ page }) => {
  await page.goto("/work", { timeout: 60_000 });

  // Scroll the TikTok wall toward the viewport; the IntersectionObserver
  // (or the idle callback) mounts the three tiles.
  await page
    .locator("h2", { hasText: "watch the" })
    .scrollIntoViewIfNeeded();

  // The page ships three official TikTok blockquote embeds, mounted lazily
  // by an IntersectionObserver; TikTok's embed.js then upgrades each
  // blockquote to an iframe. What the upgraded iframe renders (and whether
  // TikTok serves content to a headless browser at all) is third-party
  // behavior we don't own — assert only our contract: three tiles mount
  // (blockquote, upgraded iframe, or self-hosted <video> fallback), inside
  // portrait plates we lay out, without breaking the page.
  const TILE_SELECTOR = [
    "blockquote.tiktok-embed",
    'iframe[src*="tiktok.com/embed"]',
    'video[src*="/media/tiktok-clip-"]',
  ].join(", ");

  await expect
    .poll(() => page.locator(TILE_SELECTOR).count(), { timeout: 20_000 })
    .toBeGreaterThanOrEqual(3);

  // Each tile sits in one of our three chamfered plates: rendered, portrait.
  // (Mid-upgrade a hidden blockquote can coexist with its injected iframe,
  // so count unique plates, not tile elements.)
  const plates = await page.evaluate((selector) => {
    const tiles = document.querySelectorAll(selector);
    const unique = new Set<Element>();
    for (const el of tiles) {
      unique.add(el.closest("div[style*='clip-path']") ?? el.parentElement!);
    }
    return [...unique].map((plate) => {
      const box = plate.getBoundingClientRect();
      return { width: box.width, height: box.height };
    });
  }, TILE_SELECTOR);
  expect(plates).toHaveLength(3);
  for (const plate of plates) {
    expect(plate.width).toBeGreaterThan(0);
    expect(plate.height).toBeGreaterThan(plate.width); // portrait tile
  }

  // Self-hosted clips (if that's what shipped) must measure portrait too.
  const clips = page.locator("video[src*='/media/tiktok-clip-']");
  if ((await clips.count()) > 0) {
    const boxes = await clips.evaluateAll((els) =>
      els.map((el) => {
        const box = el.getBoundingClientRect();
        return { width: box.width, height: box.height };
      }),
    );
    for (const box of boxes) {
      expect(box.width).toBeGreaterThan(0);
      expect(box.height).toBeGreaterThan(box.width); // portrait tile
    }
  }

  // The page never scrolls horizontally once the tiles are in.
  const overflowPx = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflowPx).toBeLessThanOrEqual(1);
});
