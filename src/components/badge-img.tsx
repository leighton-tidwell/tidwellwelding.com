"use client";

import type { CSSProperties } from "react";

// The badge PNGs arrive in /public after launch prep; until then, hide the
// broken-image glyph so the wordmark carries the brand on its own.
export function BadgeImg({
  src,
  alt,
  className,
  style,
}: {
  src: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  );
}
