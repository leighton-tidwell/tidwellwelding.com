import type { CSSProperties, ReactNode } from "react";

export type BadgeProps = {
  variant?: "default" | "accent" | "solid" | "ok" | "warn" | "danger" | "idle";
  /** Renders the square status dot before the label. */
  dot?: boolean;
  /** Arc-flicker animation on the dot. */
  live?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

export default function Badge({
  variant = "default",
  dot = false,
  live = false,
  className,
  style,
  children,
}: BadgeProps) {
  const classes = [
    "tsws-badge",
    variant !== "default" ? `tsws-badge--${variant}` : null,
    live ? "tsws-badge--live" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} style={style}>
      {dot ? <span className="tsws-badge__dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

export { Badge };
