// IndexNow deploy-time ping (SEO P0-6).
//
// Pushes URLs to Bing/Yandex/Naver/Seznam/Yep in one call. Google does not
// participate (the sitemap covers Google). Runs from the deploy machine on
// purpose — NEVER ping IndexNow from Worker runtime code: Cloudflare Workers
// share egress IPs and get 429'd even at 1 req/day.
//
// Etiquette:
// - Only ping URLs whose content actually changed.
// - Don't re-ping unchanged URLs.
// - Wait 5+ minutes before resubmitting the same URL.
//
// Usage:
//   node scripts/indexnow-ping.mjs               # pings every sitemap URL
//   node scripts/indexnow-ping.mjs /a,/b/c       # pings a comma-separated subset of paths
//
// Never fails the deploy: exits 0 on 4xx/5xx and on network errors.

const HOST = "tidwellwelding.com";
const KEY = "b543e58c574cee4254c2b8c951f0ec90"; // served at https://tidwellwelding.com/<KEY>.txt (public/<KEY>.txt)
const ENDPOINT = "https://api.indexnow.org/indexnow";

// Duplicated from src/app/sitemap.ts — keep the two lists in sync.
const SITEMAP_PATHS = [
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
];

const arg = process.argv[2];
const paths = arg
  ? arg
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => (p.startsWith("/") ? p : `/${p}`))
  : SITEMAP_PATHS;

const urlList = paths.map((p) => `https://${HOST}${p}`);

try {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: HOST, key: KEY, urlList }),
  });
  if (res.status === 200 || res.status === 202) {
    console.log(`IndexNow: ${res.status} — submitted ${urlList.length} URL(s)`);
  } else {
    const body = await res.text().catch(() => "");
    console.error(`IndexNow: HTTP ${res.status} — not failing the deploy. ${body}`.trim());
  }
} catch (err) {
  console.error(`IndexNow: ping failed — not failing the deploy. ${err?.message ?? err}`);
}
process.exit(0);
