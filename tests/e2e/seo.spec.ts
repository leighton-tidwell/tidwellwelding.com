import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ timeout: 120_000 });

/** Exact <title> per page, from the SEO spec. */
const TITLES: Record<string, string> = {
  "/":
    "Welding & Fabrication in Granbury, TX | 24/7 Mobile Welder | Tidwell Specialty Welding",
  "/services":
    "Welding Services: Fabrication, Pipe, Equipment Repair | Granbury & Fort Worth | TSWS",
  "/services/fabrication":
    "Custom Metal Fabrication in Granbury, TX | Tidwell Specialty Welding",
  "/services/structural":
    "Staircase & Handrail Welding in Granbury, TX | Tidwell Specialty Welding",
  "/services/pipe": "Pipe Welding in Granbury, TX | Tidwell Specialty Welding",
  "/services/equipment":
    "Heavy Equipment Welding Repair in Granbury, TX | Tidwell Specialty Welding",
  "/services/mobile":
    "Mobile Welding, Granbury TX to DFW & Stephenville | Tidwell Specialty Welding",
  "/services/emergency":
    "24/7 Emergency Welding, Granbury TX to DFW & Stephenville | Tidwell Specialty Welding",
  "/work":
    "Welding & Fabrication Job Log | Tidwell Specialty Welding, Granbury TX",
  "/about":
    "Eric Tidwell, Welder Since 2011 | Tidwell Specialty Welding, Granbury TX",
  "/contact":
    "Contact a Welder Now: (817) 894-6357 | Granbury to Stephenville | TSWS",
  "/quote":
    "Free Welding Quotes | We Beat Any Bid | Tidwell Specialty Welding, Granbury TX",
  "/welder/granbury-tx":
    "Welding & Fabrication in Granbury, TX | Free Quotes, We Beat Any Bid | Tidwell Specialty Welding",
  "/welder/fort-worth-tx":
    "Welder in Fort Worth, TX | Free Quotes, We Beat Any Bid | Tidwell Specialty Welding",
  "/welder/stephenville-tx":
    "Welder in Stephenville, TX | Free Quotes, We Beat Any Bid | Tidwell Specialty Welding",
  "/search": "Search | Tidwell Specialty Welding",
  "/crew": "Crew console | TSWS",
};

/** Every URL the sitemap must list — apex-absolute, in the P0-7 map's order. */
const SITEMAP_URLS = [
  "https://tidwellwelding.com/",
  "https://tidwellwelding.com/services",
  "https://tidwellwelding.com/services/fabrication",
  "https://tidwellwelding.com/services/structural",
  "https://tidwellwelding.com/services/pipe",
  "https://tidwellwelding.com/services/equipment",
  "https://tidwellwelding.com/services/mobile",
  "https://tidwellwelding.com/services/emergency",
  "https://tidwellwelding.com/work",
  "https://tidwellwelding.com/about",
  "https://tidwellwelding.com/contact",
  "https://tidwellwelding.com/quote",
  "https://tidwellwelding.com/welder/granbury-tx",
  "https://tidwellwelding.com/welder/fort-worth-tx",
  "https://tidwellwelding.com/welder/stephenville-tx",
];

type JsonLdNode = Record<string, unknown>;

async function readJsonLd(page: Page): Promise<JsonLdNode[]> {
  const raw = await page
    .locator("script[type='application/ld+json']")
    .allTextContents();
  return raw.map((text) => JSON.parse(text) as JsonLdNode);
}

for (const [path, title] of Object.entries(TITLES)) {
  test(`title tag on ${path} matches exactly`, async ({ page }) => {
    await page.goto(path, { timeout: 60_000 });
    expect(await page.title()).toBe(title);
  });
}

test("home page LocalBusiness JSON-LD parses with the legal name", async ({
  page,
}) => {
  await page.goto("/", { timeout: 60_000 });
  const nodes = await readJsonLd(page);
  // P0-3: @type is a multi-type array — the valid pattern for a specific
  // LocalBusiness subtype (no `Welder` type exists in schema.org).
  const business = nodes.find((n) => {
    const type = n["@type"];
    return Array.isArray(type)
      ? type.includes("LocalBusiness")
      : type === "LocalBusiness";
  });
  expect(business, "LocalBusiness JSON-LD block missing").toBeTruthy();
  expect(business!["@type"]).toEqual([
    "HomeAndConstructionBusiness",
    "LocalBusiness",
  ]);
  expect(business!["legalName"]).toBe("Tidwell Specialty Welding Services, LLC");
  expect(business!["@context"]).toBe("https://schema.org");
  expect(business!["name"]).toBe("Tidwell Specialty Welding");
});

test("/contact FAQPage JSON-LD matches the rendered FAQ", async ({ page }) => {
  await page.goto("/contact", { timeout: 60_000 });
  const nodes = await readJsonLd(page);
  const faqPage = nodes.find((n) => n["@type"] === "FAQPage");
  expect(faqPage, "FAQPage JSON-LD block missing").toBeTruthy();

  const mainEntity = faqPage!["mainEntity"] as {
    "@type": string;
    name: string;
    acceptedAnswer: { "@type": string; text: string };
  }[];
  expect(Array.isArray(mainEntity)).toBe(true);
  expect(mainEntity.length).toBeGreaterThan(0);

  // The summary holds the question span plus a decorative icon span.
  const renderedQuestions = await page
    .locator(".contact-faq details summary > span:not(.tsws-icon)")
    .allTextContents();
  const renderedAnswers = await page
    .locator(".contact-faq details .contact-faq__a")
    .allTextContents();

  expect(mainEntity.map((q) => q.name)).toEqual(renderedQuestions);
  expect(mainEntity.map((q) => q.acceptedAnswer.text)).toEqual(renderedAnswers);
});

test("sitemap.xml lists exactly the 15 public routes with truthful lastmod", async ({
  request,
}) => {
  const res = await request.get("/sitemap.xml");
  expect(res.status()).toBe(200);
  const xml = await res.text();

  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  expect(urls.sort()).toEqual([...SITEMAP_URLS].sort());

  // /crew is private and /search is noindexed — neither may ever appear.
  expect(urls.some((u) => u.includes("/crew"))).toBe(false);
  expect(urls.some((u) => u.includes("/search"))).toBe(false);

  // P0-7: every URL carries a literal ISO-date lastmod; priority/changefreq
  // are gone (Google ignores both; a build-date lastmod would train Google
  // to ignore lastmod entirely).
  const lastmods = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map(
    (m) => m[1],
  );
  expect(lastmods.length).toBe(urls.length);
  for (const lastmod of lastmods) {
    expect(lastmod).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  }
  expect(xml).not.toContain("<priority>");
  expect(xml).not.toContain("<changefreq>");
});

test("robots.txt keeps the wildcard and explicit AI-crawler groups, each disallowing /crew", async ({
  request,
}) => {
  const res = await request.get("/robots.txt");
  expect(res.status()).toBe(200);
  const body = await res.text();

  // Split into user-agent groups (blank-line separated blocks).
  const groups = body
    .split(/\n\s*\n/)
    .filter((block) => /user-agent:/i.test(block));

  const wildcard = groups.find((g) => /user-agent:\s*\*/i.test(g));
  expect(wildcard, "wildcard group missing").toBeTruthy();
  expect(wildcard!).toMatch(/Disallow:\s*\/crew/i);

  // P1-2: a bot matching a specific group IGNORES the wildcard group, so the
  // explicit AI group must re-state the /crew disallow itself.
  const AI_BOTS = [
    "OAI-SearchBot",
    "ChatGPT-User",
    "GPTBot",
    "Claude-SearchBot",
    "Claude-User",
    "ClaudeBot",
    "PerplexityBot",
    "Perplexity-User",
    "Google-Extended",
  ];
  for (const bot of AI_BOTS) {
    const group = groups.find((g) =>
      new RegExp(`user-agent:\\s*${bot}\\s*$`, "im").test(g),
    );
    expect(group, `no explicit group for ${bot}`).toBeTruthy();
    expect(group!, `${bot} group must disallow /crew`).toMatch(
      /Disallow:\s*\/crew/i,
    );
  }

  expect(body).toMatch(
    /Sitemap:\s*https:\/\/tidwellwelding\.com\/sitemap\.xml/i,
  );
});

test("/crew carries a noindex robots meta", async ({ page }) => {
  await page.goto("/crew", { timeout: 60_000 });
  const content = await page
    .locator("meta[name='robots']")
    .first()
    .getAttribute("content");
  expect(content).toContain("noindex");
});

test("/search carries a noindex robots meta and a self-canonical", async ({
  page,
}) => {
  await page.goto("/search", { timeout: 60_000 });
  const robots = await page
    .locator("meta[name='robots']")
    .first()
    .getAttribute("content");
  expect(robots).toContain("noindex");
  const canonical = await page
    .locator("link[rel='canonical']")
    .getAttribute("href");
  expect(canonical).toBe("https://tidwellwelding.com/search");
});

test("WebSite JSON-LD (with SearchAction) renders on the home page only", async ({
  page,
}) => {
  await page.goto("/", { timeout: 60_000 });
  const nodes = await readJsonLd(page);
  const site = nodes.find((n) => n["@type"] === "WebSite");
  expect(site, "WebSite JSON-LD block missing on /").toBeTruthy();
  expect(site!["@id"]).toBe("https://tidwellwelding.com/#website");
  expect(site!["name"]).toBe("Tidwell Specialty Welding");
  const action = site!["potentialAction"] as {
    target: { urlTemplate: string };
    "query-input": string;
  };
  // The urlTemplate must match /search's real query param (?q=).
  expect(action.target.urlTemplate).toBe(
    "https://tidwellwelding.com/search?q={search_term_string}",
  );
  expect(action["query-input"]).toBe("required name=search_term_string");

  await page.goto("/services", { timeout: 60_000 });
  const otherNodes = await readJsonLd(page);
  expect(otherNodes.find((n) => n["@type"] === "WebSite")).toBeUndefined();
});

test("every page carries exactly one LocalBusiness block referenced by #business", async ({
  page,
}) => {
  for (const path of ["/", "/services/pipe", "/welder/granbury-tx", "/search"]) {
    await page.goto(path, { timeout: 60_000 });
    const nodes = await readJsonLd(page);
    const businesses = nodes.filter((n) => {
      const type = n["@type"];
      return Array.isArray(type)
        ? type.includes("LocalBusiness")
        : type === "LocalBusiness";
    });
    expect(businesses, `${path} must carry exactly one LocalBusiness`).toHaveLength(1);
    expect(businesses[0]["@id"]).toBe("https://tidwellwelding.com/#business");
  }
});

test("town and service pages carry a BreadcrumbList whose last item has no `item`", async ({
  page,
}) => {
  const paths = [
    "/welder/granbury-tx",
    "/welder/fort-worth-tx",
    "/welder/stephenville-tx",
    "/services/fabrication",
    "/services/structural",
    "/services/pipe",
    "/services/equipment",
    "/services/mobile",
    "/services/emergency",
  ];
  for (const path of paths) {
    await page.goto(path, { timeout: 60_000 });
    const nodes = await readJsonLd(page);
    const crumbs = nodes.find((n) => n["@type"] === "BreadcrumbList");
    expect(crumbs, `${path} missing BreadcrumbList`).toBeTruthy();
    const items = crumbs!["itemListElement"] as {
      position: number;
      name: string;
      item?: string;
    }[];
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items[0].name).toBe("Home");
    expect(items[0].item).toBe("https://tidwellwelding.com/");
    // Google guideline: the final crumb (the page itself) carries no `item`.
    expect(items[items.length - 1].item).toBeUndefined();
    // The visible trail matches.
    await expect(page.locator("nav[aria-label='Breadcrumb']")).toBeVisible();
  }
});
