"use client";

import {
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from "react";

export type RadioProps = {
  label?: ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  /** Receives this radio's value when selected. */
  onChange?: (value: string, event: ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  name?: string;
  value?: string;
  className?: string;
  style?: CSSProperties;
};

export default function Radio({
  label,
  checked,
  defaultChecked = false,
  onChange,
  disabled = false,
  name,
  value = "",
  className,
  style,
}: RadioProps) {
  const [internal, setInternal] = useState(defaultChecked);
  const isChecked = checked ?? internal;

  const classes = [
    "tsws-check",
    isChecked ? "tsws-check--checked" : null,
    disabled ? "tsws-check--disabled" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <label className={classes} style={style}>
      <input
        type="radio"
        checked={checked}
        defaultChecked={checked === undefined ? defaultChecked : undefined}
        disabled={disabled}
        name={name}
        value={value}
        onChange={(event) => {
          if (checked === undefined) setInternal(event.target.checked);
          onChange?.(value, event);
        }}
      />
      <span className="tsws-check__box tsws-radio__box" aria-hidden="true">
        <span className="tsws-radio__dot" />
      </span>
      {label ? <span className="tsws-check__label">{label}</span> : null}
    </label>
  );
}

export { Radio };
