"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

// Real TikTok embeds on purpose: viewers can like, comment, and follow
// @__tdaddy__ from the card. The official embed.js renders the interactive
// player; we lazy-load it so it never touches the LCP path.
const EMBEDS = [
  { id: "7470163669494566186", title: "Pipeline weld in a tight spot" },
  { id: "7253502143955471658", title: "Heavy wall pipe practice" },
  { id: "7343271323164069166", title: "Back at it on some 12 in" },
] as const;

// TikTok's card is a fixed ~325px column with white chrome; the chamfered
// plate frames it instead of cropping it, so every button stays tappable.
const plateStyle: CSSProperties = {
  background: "#0d0e0f",
  border: "1px solid rgba(255,255,255,.1)",
  borderTop: "3px solid #c90314",
  clipPath:
    "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)",
  padding: "20px 16px 16px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 10,
  minHeight: 620,
};

export default function TikTokEmbeds() {
  const wallRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (mounted) return;
    const wall = wallRef.current;
    if (!wall) return;

    let cancelled = false;
    const show = () => {
      if (!cancelled) setMounted(true);
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          show();
          io.disconnect();
        }
      },
      { rootMargin: "600px" },
    );
    io.observe(wall);
    const idle = window.setTimeout(show, 4000);
    return () => {
      cancelled = true;
      io.disconnect();
      window.clearTimeout(idle);
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    if (document.querySelector('script[src*="tiktok.com/embed.js"]')) {
      // Re-running the loader upgrades any blockquotes added after first load.
      (window as unknown as { tiktokEmbed?: { lib?: { render?: () => void } } })
        .tiktokEmbed?.lib?.render?.();
      return;
    }
    const s = document.createElement("script");
    s.src = "https://www.tiktok.com/embed.js";
    s.async = true;
    document.body.appendChild(s);
  }, [mounted]);

  return (
    <div ref={wallRef} className="tt-wall">
      {/* The card's hard floor is TikTok's 288px minimum: columns must never
          drop below card + plate padding, or the page scrolls sideways. */}
      <style>{`
        .tt-wall{display:grid;gap:20px;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))}
        .tt-plate{overflow-x:auto}
        @media (max-width:359px){.tt-plate{padding-left:8px;padding-right:8px;align-items:flex-start}}
      `}</style>
      {EMBEDS.map((e) => (
        <div key={e.id} className="tt-plate" style={plateStyle}>
          {mounted ? (
            <blockquote
              className="tiktok-embed"
              cite={`https://www.tiktok.com/@__tdaddy__/video/${e.id}`}
              data-video-id={e.id}
              style={{ maxWidth: 325, minWidth: "min(288px, 100%)", width: "100%", margin: 0 }}
            >
              <section>
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href={`https://www.tiktok.com/@__tdaddy__/video/${e.id}`}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,.6)",
                  }}
                >
                  {e.title} — watch on TikTok
                </a>
              </section>
            </blockquote>
          ) : (
            <div
              aria-hidden="true"
              style={{
                width: "100%",
                maxWidth: 325,
                flex: 1,
                background: "#050505",
                display: "grid",
                placeItems: "center",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,.55)",
              }}
            >
              Loading the feed…
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
