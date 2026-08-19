import type { CSSProperties, MouseEventHandler, ReactNode } from "react";

export type TagProps = {
  selected?: boolean;
  selectable?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  /** Shows the ✕ affordance when provided. */
  onRemove?: MouseEventHandler<HTMLButtonElement>;
  removeLabel?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

export default function Tag({
  selected = false,
  selectable = false,
  onClick,
  onRemove,
  removeLabel = "Remove",
  className,
  style,
  children,
}: TagProps) {
  const classes = [
    "tsws-tag",
    selectable ? "tsws-tag--selectable" : null,
    selected ? "tsws-tag--selected" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const remove = onRemove ? (
    <button
      type="button"
      className="tsws-tag__remove"
      onClick={onRemove}
      aria-label={removeLabel}
    >
      ✕
    </button>
  ) : null;

  if (selectable || onClick) {
    return (
      <button
        type="button"
        className={classes}
        style={style}
        onClick={onClick}
        aria-pressed={selectable ? selected : undefined}
      >
        {children}
        {remove}
      </button>
    );
  }

  return (
    <span className={classes} style={style}>
      {children}
      {remove}
    </span>
  );
}

export { Tag };
