"use client";

import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";

export default function BackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => { startNavigationProgress(); router.back(); }}
      className="flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors"
      style={{
        width: "32px",
        height: "32px",
        borderRadius: "50%",
        backgroundColor: "var(--color-shop-divider)",
        color: "var(--primitive-black)",
        border: "none",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "var(--color-action-primary)";
        e.currentTarget.style.color = "var(--primitive-white)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "var(--color-shop-divider)";
        e.currentTarget.style.color = "var(--primitive-black)";
      }}
    >
      <svg
        className="flip-rtl"
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 8L2 12L6 16" />
        <path d="M2 12H22" />
      </svg>
    </button>
  );
}
