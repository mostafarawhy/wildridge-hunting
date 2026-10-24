"use client";

import { useState } from "react";

interface AuthInputProps {
  id: string;
  type?: "text" | "email" | "password";
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
  error?: string;
}

export default function AuthInput({
  id,
  type = "text",
  label,
  placeholder,
  value,
  onChange,
  disabled = false,
  autoComplete,
  required = false,
  hint,
  error,
}: AuthInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const inputType =
    type === "password" ? (showPassword ? "text" : "password") : type;

  return (
    <div className="space-y-1.5">
    
      <style>{`
        .auth-input-focusable:focus-visible {
          outline: none;
          border-color: var(--color-auth-input-border-focus) !important;
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-action-primary) 6%, transparent);
        }
        .auth-input-focusable.auth-input-error:focus-visible {
          border-color: var(--color-auth-error-border) !important;
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-error) 8%, transparent);
        }
      `}</style>

      <label
        htmlFor={id}
        className="block text-body font-medium"
        style={{ color: "var(--color-auth-label-text)" }}
      >
        {label}
        {required && (
          <span
            aria-hidden="true"
            style={{ color: "var(--color-error)" }}
            className="ms-0.5"
          >
            {" *"}
          </span>
        )}
      </label>

      <div className="relative">
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          required={required}
          aria-invalid={!!error}
          aria-describedby={
            error ? `${id}-error` : hint ? `${id}-hint` : undefined
          }
          className={[
            "w-full h-12 px-4 text-body outline-none transition-all duration-150",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "auth-input-focusable",
            error ? "auth-input-error" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{
            backgroundColor: "var(--color-auth-input-bg)",
            border: error
              ? "1.5px solid var(--color-auth-error-border)"
              : "1.5px solid var(--color-auth-input-border)",
            borderRadius: "var(--radius-none)",
            color: "var(--color-auth-input-text)",
          }}
        />


        {type === "password" && (
          <button
            type="button"
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword((p) => !p)}
            disabled={disabled}
            className="absolute inset-y-0 end-0 flex items-center pe-4 transition-opacity hover:opacity-70 disabled:opacity-30"
            style={{ color: "var(--color-auth-input-placeholder)" }}
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>

      {hint && !error && (
        <p
          id={`${id}-hint`}
          className="text-body-sm"
          style={{ color: "var(--color-content-tertiary)" }}
        >
          {hint}
        </p>
      )}
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-body-sm"
          style={{ color: "var(--color-auth-error-text)" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
