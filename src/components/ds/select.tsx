"use client";

import {
  useId,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from "react";
import Icon from "@/components/ds/icon";

export type SelectOption = { value: string; label: string } | string;

export type SelectProps = {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  size?: "sm" | "md" | "lg";
  options: SelectOption[];
  /** Rendered as a disabled empty first option. */
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  /** Receives the selected value first; the raw event second. */
  onChange?: (value: string, event: ChangeEvent<HTMLSelectElement>) => void;
  name?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
};

export default function Select({
  label,
  hint,
  error,
  required = false,
  size = "md",
  options,
  placeholder,
  value,
  defaultValue,
  onChange,
  name,
  id,
  disabled = false,
  className,
  style,
}: SelectProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const [focused, setFocused] = useState(false);

  const controlClasses = [
    "tsws-control",
    focused ? "tsws-control--focused" : null,
    error ? "tsws-control--error" : null,
    disabled ? "tsws-control--disabled" : null,
    size !== "md" ? `tsws-control--${size}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const normalized = options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option,
  );

  return (
    <div
      className={className ? `tsws-field ${className}` : "tsws-field"}
      style={style}
    >
      {label ? (
        <label className="tsws-field__label" htmlFor={fieldId}>
          {label}
          {required ? (
            <span className="tsws-field__req" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}
      <div className={controlClasses}>
        <select
          id={fieldId}
          className="tsws-control__input tsws-select"
          name={name}
          disabled={disabled}
          required={required}
          value={value}
          defaultValue={
            value === undefined
              ? (defaultValue ?? (placeholder ? "" : undefined))
              : undefined
          }
          aria-invalid={error ? true : undefined}
          aria-describedby={
            error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined
          }
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(event) => onChange?.(event.target.value, event)}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {normalized.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="tsws-select__chev" aria-hidden="true">
          <Icon name="chevron-down" size={16} />
        </span>
        <span className="tsws-control__seam" aria-hidden="true" />
      </div>
      {error ? (
        <div className="tsws-field__error" id={`${fieldId}-error`} role="alert">
          {error}
        </div>
      ) : hint ? (
        <div className="tsws-field__hint" id={`${fieldId}-hint`}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export { Select };
