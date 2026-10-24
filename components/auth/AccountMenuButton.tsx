"use client";

import Image from "next/image";

interface AccountMenuButtonProps {
  open: boolean;
  onClick: () => void;
  ariaLabel: string;
  ariaControls?: string;
  busy?: boolean;
  avatarSrc?: string | null;
}

export default function AccountMenuButton({
  open,
  onClick,
  ariaLabel,
  ariaControls,
  busy = false,
  avatarSrc,
}: AccountMenuButtonProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-expanded={open}
      aria-haspopup="menu"
      aria-controls={ariaControls}
      aria-busy={busy ? "true" : undefined}
      disabled={busy}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "2.5rem",
        height: "2.5rem",
        background: "none",
        border: "none",
        cursor: busy ? "default" : "pointer",
        color: "var(--color-content-primary)",
        transition: "opacity 150ms",
      }}
      className={
        busy
          ? "focus-visible:outline-2 focus-visible:outline-offset-2"
          : "hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2"
      }
    >
      {busy ? (
        <span
          aria-hidden="true"
          className="btn-spinner"
          style={{
            display: "inline-block",
            width: "20px",
            height: "20px",
            border: "2px solid currentColor",
            borderTopColor: "transparent",
            borderRadius: "50%",
            marginInlineEnd: 0,
            flexShrink: 0,
          }}
        />
      ) : avatarSrc ? (
        <Image
          src={avatarSrc}
          width={40}
          height={40}
          alt=""
          style={{ objectFit: "contain", display: "block" }}
        />
      ) : (
        <UserIcon />
      )}
    </button>
  );
}

function UserIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="7"
        r="4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
