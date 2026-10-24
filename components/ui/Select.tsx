"use client";

import { forwardRef, useState } from "react";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  id: string;
  error?: string;
  hint?: string;
  optional?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      id,
      error,
      hint,
      optional,
      disabled,
      children,
      style,
      className = "",
      ...rest
    },
    ref,
  ) => {
    const [focused, setFocused] = useState(false);

    const borderColor = error
      ? "var(--color-auth-input-border-focus)"
      : focused
        ? "var(--color-auth-input-border-focus)"
        : "var(--color-auth-input-border)";

    return (
      <div
        style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}
      >
        <label
          htmlFor={id}
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "0.25rem",
            fontSize: "var(--text-body)",
            fontWeight: "var(--font-medium)",
            color: "var(--color-auth-label-text)",
          }}
        >
          {label}
          {optional && (
            <span
              style={{
                fontSize: "var(--text-body-sm)",
                fontWeight: "var(--font-normal)",
                color: "var(--color-auth-input-placeholder)",
              }}
            >
              {optional}
            </span>
          )}
          {rest.required && (
            <span
              aria-hidden="true"
              style={{ color: "var(--color-error)", lineHeight: 1 }}
            >
              *
            </span>
          )}
        </label>

        <select
          ref={ref}
          id={id}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={
            error ? `${id}-error` : hint ? `${id}-hint` : undefined
          }
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          className={className}
          style={{
            width: "100%",
            padding: "0.625rem 0.875rem",
            fontSize: "var(--text-body)",
            color: "var(--color-auth-input-text)",
            backgroundColor: "var(--color-auth-input-bg)",
            border: `1.5px solid ${borderColor}`,
            borderRadius: "var(--radius-none)",
            outline: "none",
            transition: "border-color 150ms",
            opacity: disabled ? 0.5 : 1,
            cursor: disabled ? "not-allowed" : "default",
            appearance: "auto",
            ...style,
          }}
          {...rest}
        >
          {children}
        </select>

        {error ? (
          <p
            role="alert"
            id={`${id}-error`}
            style={{
              fontSize: "var(--text-body-sm)",
              color: "var(--color-auth-error-text)",
              margin: 0,
            }}
          >
            {error}
          </p>
        ) : hint ? (
          <p
            id={`${id}-hint`}
            style={{
              fontSize: "var(--text-body-sm)",
              color: "var(--color-content-tertiary)",
              margin: 0,
            }}
          >
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);

Select.displayName = "Select";
export default Select;
