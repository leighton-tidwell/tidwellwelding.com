import type { MetadataRoute } from "next";

const BASE = "https://tidwellwelding.com";

// Truthful lastmod (SEO P0-7). Google uses <lastmod> only when it is
// consistently accurate; Bing leans on it harder. Bump a route's date ONLY
// when its visible content meaningfully changes — never automate this to the
// build date. priority/changefreq are deliberately absent (Google ignores
// both).
//
// All public routes. /crew is private (robots-disallowed) and /search ships
// noindexed — both deliberately excluded.
const ROUTE_LASTMOD: Record<string, string> = {
  "/": "2026-08-19",
  "/services": "2026-08-19",
  "/services/fabrication": "2026-08-19",
  "/services/structural": "2026-08-19",
  "/services/pipe": "2026-08-19",
  "/services/equipment": "2026-08-19",
  "/services/mobile": "2026-08-19",
  "/services/emergency": "2026-08-19",
  "/work": "2026-08-19",
  "/about": "2026-08-19",
  "/contact": "2026-08-19",
  "/quote": "2026-08-19",
  "/welder/granbury-tx": "2026-08-19",
  "/welder/fort-worth-tx": "2026-08-19",
  "/welder/stephenville-tx": "2026-08-19",
};

// scripts/indexnow-ping.mjs duplicates this route list — keep the two in sync.
export default function sitemap(): MetadataRoute.Sitemap {
  return Object.entries(ROUTE_LASTMOD).map(([path, lastModified]) => ({
    url: `${BASE}${path}`,
    lastModified,
  }));
}
