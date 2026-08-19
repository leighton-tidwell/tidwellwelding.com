import type { CSSProperties, MouseEventHandler, ReactNode } from "react";

export type CardProps = {
  variant?: "default" | "plate" | "light";
  interactive?: boolean;
  /** The 3px red top rule. Defaults on, per the design. */
  rule?: boolean;
  /** Mono uppercase kicker above the title. */
  eyebrow?: ReactNode;
  title?: ReactNode;
  /** Media slot above the body (image/video); clipped by the card. */
  media?: ReactNode;
  /** Footer row divided by a hairline. */
  footer?: ReactNode;
  onClick?: MouseEventHandler<HTMLDivElement>;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

export default function Card({
  variant = "default",
  interactive = false,
  rule = true,
  eyebrow,
  title,
  media,
  footer,
  onClick,
  className,
  style,
  children,
}: CardProps) {
  const classes = [
    "tsws-card",
    variant !== "default" ? `tsws-card--${variant}` : null,
    interactive ? "tsws-card--interactive" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const body =
    typeof children === "string" ? (
      <p className="tsws-card__text">{children}</p>
    ) : (
      children
    );

  return (
    <div className={classes} style={style} onClick={onClick}>
      {rule ? <div className="tsws-card__rule" aria-hidden="true" /> : null}
      {media ? <div className="tsws-card__media">{media}</div> : null}
      <div className="tsws-card__body">
        {eyebrow ? <div className="tsws-card__eyebrow">{eyebrow}</div> : null}
        {title ? <div className="tsws-card__title">{title}</div> : null}
        {body}
      </div>
      {footer ? <div className="tsws-card__footer">{footer}</div> : null}
    </div>
  );
}

export { Card };
