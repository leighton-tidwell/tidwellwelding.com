import Link from "next/link";
import type { CSSProperties, MouseEventHandler, ReactNode } from "react";

export type ButtonProps = {
  variant?: "primary" | "secondary" | "ghost" | "quiet";
  size?: "sm" | "md" | "lg";
  block?: boolean;
  disabled?: boolean;
  /** Renders <Link> for internal paths, <a> for tel:/mailto:/external. */
  href?: string;
  type?: "button" | "submit" | "reset";
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  /** Marks the button busy while its action runs (e.g. generating a file).
   * Left undefined the attribute is omitted entirely. */
  ariaBusy?: boolean;
  target?: string;
  rel?: string;
  children?: ReactNode;
};

export default function Button({
  variant = "primary",
  size = "md",
  block = false,
  disabled = false,
  href,
  type = "button",
  iconLeft,
  iconRight,
  onClick,
  className,
  style,
  ariaLabel,
  ariaBusy,
  target,
  rel,
  children,
}: ButtonProps) {
  const classes = [
    "tsws-btn",
    `tsws-btn--${variant}`,
    `tsws-btn--${size}`,
    block ? "tsws-btn--block" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const inner = (
    <>
      {iconLeft}
      <span className="tsws-btn__label">{children}</span>
      {iconRight}
    </>
  );

  if (href && !disabled) {
    const isInternal = href.startsWith("/") || href.startsWith("#");
    if (isInternal) {
      return (
        <Link
          href={href}
          className={classes}
          style={style}
          onClick={onClick}
          aria-label={ariaLabel}
        >
          {inner}
        </Link>
      );
    }
    return (
      <a
        href={href}
        className={classes}
        style={style}
        onClick={onClick}
        aria-label={ariaLabel}
        target={target}
        rel={rel ?? (target === "_blank" ? "noopener" : undefined)}
      >
        {inner}
      </a>
    );
  }

  return (
    <button
      type={type}
      className={classes}
      style={style}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-busy={ariaBusy === undefined ? undefined : ariaBusy}
    >
      {inner}
    </button>
  );
}

export { Button };
