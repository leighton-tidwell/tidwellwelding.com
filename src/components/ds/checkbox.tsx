"use client";

import {
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from "react";

export type CheckboxProps = {
  label?: ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean, event: ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  name?: string;
  value?: string;
  className?: string;
  style?: CSSProperties;
};

export default function Checkbox({
  label,
  checked,
  defaultChecked = false,
  onChange,
  disabled = false,
  name,
  value,
  className,
  style,
}: CheckboxProps) {
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
        type="checkbox"
        checked={checked}
        defaultChecked={checked === undefined ? defaultChecked : undefined}
        disabled={disabled}
        name={name}
        value={value}
        onChange={(event) => {
          if (checked === undefined) setInternal(event.target.checked);
          onChange?.(event.target.checked, event);
        }}
      />
      <span className="tsws-check__box" aria-hidden="true">
        <svg
          className="tsws-check__tick"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 12.5 9.5 18 20 6" />
        </svg>
      </span>
      {label ? <span className="tsws-check__label">{label}</span> : null}
    </label>
  );
}

export { Checkbox };
