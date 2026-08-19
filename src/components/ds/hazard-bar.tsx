import type { CSSProperties } from "react";

export type HazardBarProps = {
  variant?: "amber" | "red" | "steel";
  /** Bar height, e.g. "4px", 6. Defaults to var(--hazard-bar-h) (10px). */
  height?: string | number;
  /** Tape-scroll loop. Use at most once per screen. */
  animated?: boolean;
  className?: string;
  style?: CSSProperties;
};

export default function HazardBar({
  variant = "amber",
  height,
  animated = false,
  className,
  style,
}: HazardBarProps) {
  const classes = [
    "tsws-hazard",
    variant !== "amber" ? `tsws-hazard--${variant}` : null,
    animated ? "tsws-hazard--animated" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      style={height !== undefined ? { height, ...style } : style}
      aria-hidden="true"
    />
  );
}

export { HazardBar };
