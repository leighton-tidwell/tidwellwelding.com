"use client";

import {
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
  useState,
} from "react";

export type SwitchProps = {
  label?: ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean, event: ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  name?: string;
  /** Shows the mono ON/OFF state text. Defaults on, per the design. */
  showState?: boolean;
  className?: string;
  style?: CSSProperties;
};

export default function Switch({
  label,
  checked,
  defaultChecked = false,
  onChange,
  disabled = false,
  name,
  showState = true,
  className,
  style,
}: SwitchProps) {
  const [internal, setInternal] = useState(defaultChecked);
  const isOn = checked ?? internal;

  const classes = [
    "tsws-switch",
    isOn ? "tsws-switch--on" : null,
    disabled ? "tsws-switch--disabled" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <label className={classes} style={style}>
      <input
        type="checkbox"
        // biome-ignore lint/a11y/useAriaPropsForRole: the native checkbox already exposes checked state.
        role="switch"
        checked={checked}
        defaultChecked={checked === undefined ? defaultChecked : undefined}
        disabled={disabled}
        name={name}
        onChange={(event) => {
          if (checked === undefined) setInternal(event.target.checked);
          onChange?.(event.target.checked, event);
        }}
      />
      <span className="tsws-switch__track" aria-hidden="true">
        <span className="tsws-switch__knob" />
      </span>
      {label ? <span>{label}</span> : null}
      {showState ? (
        <span className="tsws-switch__state" aria-hidden="true">
          {isOn ? "On" : "Off"}
        </span>
      ) : null}
    </label>
  );
}

export { Switch };
