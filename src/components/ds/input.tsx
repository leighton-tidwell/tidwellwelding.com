"use client";

import {
  useId,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type HTMLInputTypeAttribute,
  type ReactNode,
} from "react";

export type InputProps = {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  size?: "sm" | "md" | "lg";
  /** Renders a textarea. */
  multiline?: boolean;
  rows?: number;
  /** Leading adornment inside the plate, e.g. "$" or an <Icon />. */
  adornment?: ReactNode;
  value?: string;
  defaultValue?: string;
  /** Receives the string value first; the raw event second. */
  onChange?: (
    value: string,
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  placeholder?: string;
  type?: HTMLInputTypeAttribute;
  name?: string;
  id?: string;
  disabled?: boolean;
  autoComplete?: string;
  inputMode?: "text" | "tel" | "email" | "numeric" | "decimal" | "search" | "url";
  maxLength?: number;
  className?: string;
  style?: CSSProperties;
};

export default function Input({
  label,
  hint,
  error,
  required = false,
  size = "md",
  multiline = false,
  rows = 4,
  adornment,
  value,
  defaultValue,
  onChange,
  placeholder,
  type = "text",
  name,
  id,
  disabled = false,
  autoComplete,
  inputMode,
  maxLength,
  className,
  style,
}: InputProps) {
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

  const shared = {
    id: fieldId,
    className: "tsws-control__input",
    name,
    placeholder,
    disabled,
    required,
    maxLength,
    value,
    defaultValue,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error
      ? `${fieldId}-error`
      : hint
        ? `${fieldId}-hint`
        : undefined,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange?.(event.target.value, event),
  };

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
        {adornment ? (
          <span className="tsws-control__adorn" aria-hidden="true">
            {adornment}
          </span>
        ) : null}
        {multiline ? (
          <textarea {...shared} rows={rows} />
        ) : (
          <input {...shared} type={type} autoComplete={autoComplete} inputMode={inputMode} />
        )}
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

export { Input };
