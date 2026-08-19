import type { MetadataRoute } from "next";

// SEO P1-2: explicit AI-crawler allow groups. A bot matching a specific group
// IGNORES the wildcard group entirely, so every group must re-state the /crew
// disallow. Never disallow Googlebot/Bingbot; never block Google-Extended (it
// gates Gemini grounding visibility, not Search ranking).
export default function robots(): MetadataRoute.Robots {
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
