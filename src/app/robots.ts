import type { MetadataRoute } from "next";
import { headers } from "next/headers";

// Version previews are served from *.workers.dev and are byte-identical copies
// of the live site. Indexing them would split ranking signal across duplicate
// hosts, so preview hosts get a blanket disallow. Matching on the preview host
// (rather than allow-listing the canonical one) keeps localhost and CI honest.
function isPreviewHost(host: string): boolean {
  return host.endsWith(".workers.dev");
}

// SEO P1-2: explicit AI-crawler allow groups. A bot matching a specific group
// IGNORES the wildcard group entirely, so every group must re-state the /crew
// disallow. Never disallow Googlebot/Bingbot; never block Google-Extended (it
// gates Gemini grounding visibility, not Search ranking).
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host") ?? "";

  if (isPreviewHost(host)) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: "/crew",
      },
      {
        userAgent: [
          "OAI-SearchBot",
          "ChatGPT-User",
          "GPTBot",
          "Claude-SearchBot",
          "Claude-User",
          "ClaudeBot",
          "PerplexityBot",
          "Perplexity-User",
          "Google-Extended",
        ],
        allow: "/",
        disallow: "/crew",
      },
    ],
    sitemap: "https://tidwellwelding.com/sitemap.xml",
  };
}
