"use client";

import { forwardRef } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      fullWidth = false,
      disabled,
      children,
      className = "",
      style,
      ...rest
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={[
          "btn-link",
          `btn-link--${variant}`,
          `btn-link--${size}`,
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          fullWidth ? "w-full" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        style={style}
        {...rest}
      >
        {loading && (
          <span
            aria-hidden="true"
            className="btn-spinner"
            style={{
              display: "inline-block",
              width: "0.875em",
              height: "0.875em",
              border: "2px solid currentColor",
              borderTopColor: "transparent",
              borderRadius: "50%",
              marginInlineEnd: children ? "0.5em" : 0,
              flexShrink: 0,
            }}
          />
        )}

        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
export default Button;
