"use client";

import { useId, useState } from "react";
import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  ReactNode,
  ChangeEvent,
  FocusEvent,
} from "react";

/* ─────────────────────────────────────────────────────────────────────────
 * FloatingInput — the core input primitive for the entire checkout.
 *
 * The label sits inside the input border (top-left) when the input has a
 * value or is focused; otherwise it sits centered as a placeholder.
 * Required marker (red asterisk) is inline with the label.
 *
 * RTL-safe via logical properties (ps/pe, start/end).
 * Numeric content (phone, postcode) should pass dir="ltr" via inputProps.
 * ─────────────────────────────────────────────────────────────────────── */

interface FloatingInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id" | "placeholder"
> {
  label: string;
  required?: boolean;
  optional?: string;
  error?: string | null;
}

export function FloatingInput({
  label,
  required,
  optional,
  error,
  className = "",
  value,
  defaultValue,
  onChange,
  onFocus,
  onBlur,
  disabled,
  ...rest
}: FloatingInputProps) {
  const reactId = useId();
  const [focused, setFocused] = useState(false);
  const [hasValue, setHasValue] = useState(
    Boolean(defaultValue ?? value ?? ""),
  );

  const isFloating = focused || hasValue;
  const hasError = Boolean(error);

  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <input
          {...rest}
          id={reactId}
          value={value}
          defaultValue={defaultValue}
          disabled={disabled}
          onChange={(e) => {
            setHasValue(e.target.value.length > 0);
            onChange?.(e);
          }}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            setHasValue(e.target.value.length > 0);
            onBlur?.(e);
          }}
          className={
            "peer h-14 w-full px-4 pt-5 pb-1.5 bg-white text-neutral-900 " +
            "text-[0.9375rem] outline-none transition-colors tabular-nums " +
            "border " +
            (hasError
              ? "border-[var(--color-error)] focus:border-[var(--color-error)]"
              : "border-neutral-300 focus:border-[var(--color-auth-input-border-focus)] hover:border-neutral-400") +
            " disabled:bg-neutral-50 disabled:cursor-not-allowed " +
            "rounded-none placeholder-transparent " +
            className
          }
          /* keep the placeholder for the floating-label CSS sibling trick;
             we hide it visually via placeholder-transparent above */
          placeholder={label}
        />
        <label
          htmlFor={reactId}
          className="pointer-events-none absolute start-4 top-1.5 text-[0.6875rem] font-medium tracking-wide text-neutral-500"
        >
          <span>{label}</span>
          {required && (
            <span className="text-[var(--color-error)] ms-1">*</span>
          )}
          {optional && !isFloating && (
            <span className="text-neutral-400 ms-1.5">({optional})</span>
          )}
        </label>
      </div>
      {error && (
        <p className="text-[0.6875rem] text-[var(--color-error)] mt-0.5 ps-1">
          {error}
        </p>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * FloatingSelect — same visual contract as FloatingInput, for <select>.
 * Label always floats (selects have no empty visual state).
 * ─────────────────────────────────────────────────────────────────────── */

interface FloatingSelectProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "id"
> {
  label: string;
  required?: boolean;
  error?: string | null;
  children: ReactNode;
}

export function FloatingSelect({
  label,
  required,
  error,
  className = "",
  children,
  ...rest
}: FloatingSelectProps) {
  const reactId = useId();
  const hasError = Boolean(error);

  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <select
          {...rest}
          id={reactId}
          className={
            "peer h-14 w-full ps-4 pe-10 pt-5 pb-1.5 bg-white text-neutral-900 " +
            "text-[0.9375rem] outline-none transition-colors appearance-none cursor-pointer " +
            "border " +
            (hasError
              ? "border-[var(--color-error)] focus:border-[var(--color-error)]"
              : "border-neutral-300 focus:border-[var(--color-auth-input-border-focus)] hover:border-neutral-400") +
            " disabled:bg-neutral-50 disabled:cursor-not-allowed " +
            "rounded-none " +
            className
          }
        >
          {children}
        </select>
        <label
          htmlFor={reactId}
          className="pointer-events-none absolute start-4 top-1.5 text-[0.6875rem] font-medium tracking-wide text-neutral-500"
        >
          <span>{label}</span>
          {required && (
            <span className="text-[var(--color-error)] ms-1">*</span>
          )}
        </label>
        <svg
          className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-neutral-500"
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
        >
          <path
            d="M1 1L5 5L9 1"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {error && (
        <p className="text-[0.6875rem] text-[var(--color-error)] mt-0.5 ps-1">
          {error}
        </p>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * FloatingPhone — same visual contract as FloatingInput, for tel inputs.
 * A non-editable dial-code segment sits at the inline-start inside the border.
 * ─────────────────────────────────────────────────────────────────────── */

interface FloatingPhoneProps {
  label: string;
  required?: boolean;
  error?: string | null;
  dialCode: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}

export function FloatingPhone({
  label,
  required,
  error,
  dialCode,
  value,
  onChange,
  onBlur,
  disabled,
}: FloatingPhoneProps) {
  const reactId = useId();
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(error);

  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <div
          className={
            "h-14 w-full border transition-colors rounded-none " +
            (disabled ? "bg-neutral-50 " : "bg-white ") +
            (hasError
              ? "border-[var(--color-error)]"
              : focused
                ? "border-[var(--color-auth-input-border-focus)]"
                : "border-neutral-300 hover:border-neutral-400")
          }
        >
          <div dir="ltr" className="flex items-end h-full">
            <label
              htmlFor={reactId}
              className="shrink-0 ps-4 pb-1.5 text-[0.9375rem] text-neutral-500 tabular-nums select-none"
            >
              {dialCode}
            </label>
            <input
              id={reactId}
              type="tel"
              dir="ltr"
              value={value}
              onChange={onChange}
              onFocus={() => setFocused(true)}
              onBlur={(e) => {
                setFocused(false);
                onBlur?.(e);
              }}
              disabled={disabled}
              className="flex-1 min-w-0 pt-5 pb-1.5 ps-1.5 pe-4 bg-transparent text-neutral-900 text-[0.9375rem] outline-none tabular-nums disabled:cursor-not-allowed placeholder-transparent"
              placeholder={label}
            />
          </div>
        </div>
        <label
          htmlFor={reactId}
          className="pointer-events-none absolute start-4 top-1.5 text-[0.6875rem] font-medium tracking-wide text-neutral-500"
        >
          <span>{label}</span>
          {required && (
            <span className="text-[var(--color-error)] ms-1">*</span>
          )}
        </label>
      </div>
      {error && (
        <p className="text-[0.6875rem] text-[var(--color-error)] mt-0.5 ps-1">
          {error}
        </p>
      )}
    </div>
  );
}

interface SectionHeadingProps {
  title: string;
  requiredHelper?: string;
}

export function SectionHeading({ title, requiredHelper }: SectionHeadingProps) {
  return (
    <div className="mb-7">
      <h2 className="text-[1.25rem] leading-tight font-semibold text-neutral-900">
        {title}
      </h2>
      {requiredHelper && (
        <p className="mt-2 text-[0.75rem] text-neutral-500">
          <span className="text-[var(--color-error)]">*</span>{" "}
          {requiredHelper}
        </p>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Checkbox — small square checkbox with custom check, used in opt-ins.
 * ─────────────────────────────────────────────────────────────────────── */

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  required?: boolean;
  hint?: string;
  error?: string | null;
}

export function Checkbox({
  checked,
  onChange,
  label,
  required,
  hint,
  error,
}: CheckboxProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-start gap-3 cursor-pointer group">
        <span
          className={
            "relative mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center border transition-colors " +
            (checked
              ? "bg-[var(--color-action-primary)] border-[var(--color-action-primary)]"
              : "bg-white border-neutral-400 group-hover:border-neutral-700")
          }
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="sr-only"
          />
          {checked && (
            <svg width="11" height="9" viewBox="0 0 10 8" fill="none">
              <path
                d="M1 4L3.5 6.5L9 1"
                stroke="white"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
        <span className="text-[0.875rem] text-neutral-700 leading-snug pt-0.5">
          {label}
          {required && (
            <span className="text-[var(--color-error)] ms-1">*</span>
          )}
          {hint && (
            <span className="text-neutral-400 ms-1.5 text-[0.8125rem]">
              ({hint})
            </span>
          )}
        </span>
      </label>
      {error && (
        <p className="text-[0.6875rem] text-[var(--color-error)] mt-0.5 ps-8">
          {error}
        </p>
      )}
    </div>
  );
}
