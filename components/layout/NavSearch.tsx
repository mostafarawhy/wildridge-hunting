"use client";

import { Suspense, useEffect } from "react";
import { useTranslations } from "next-intl";
import SearchCombobox from "@/components/search/SearchCombobox";
import { usePathname } from "next/navigation";

interface NavSearchDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  locale: string;
}

function NavSearchInner({ isOpen, onClose }: NavSearchDrawerProps) {
  const tShop = useTranslations("shop");
  const tNav = useTranslations("nav");
  const pathname = usePathname();
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run on navigation only
  }, [pathname]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0"
          style={{
            zIndex: "calc(var(--z-dropdown) - 1)",
            backgroundColor: "rgba(11,11,11,0.55)",
          }}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <div
        role="search"
        aria-label={tNav("search")}
        className="absolute top-full inset-x-0 transition-all duration-300"
        style={{
          maxHeight: isOpen ? "calc(100dvh - var(--spacing-header))" : "0px",
          overflow: isOpen ? "visible" : "hidden",
          opacity: isOpen ? 1 : 0,
          backgroundColor: "var(--color-surface-sunken)",
          borderBottom: isOpen
            ? "1px solid var(--color-border-default)"
            : "none",
          zIndex: "var(--z-dropdown)",
        }}
      >
        <SearchCombobox
          variant="nav"
          placeholder={tShop("search_placeholder")}
          autoFocus={isOpen}
          onDone={onClose}
          actions={
            <>
              <button
                type="submit"
                className="text-label tracking-widest uppercase transition-opacity hover:opacity-70 h-9 px-4 max-sm:hidden"
                style={{
                  color: "var(--color-action-primary-fg)",
                  backgroundColor: "var(--color-action-primary)",
                }}
              >
                {tNav("search")}
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label={tShop("search_close")}
                className="transition-opacity hover:opacity-70 max-sm:inline-flex max-sm:shrink-0 max-sm:items-center max-sm:justify-center max-sm:w-11 max-sm:h-11"
                style={{ color: "var(--color-content-tertiary)" }}
              >
                <svg width="14" height="14" viewBox="0 0 10 10" fill="none">
                  <path
                    d="M1 1L9 9M9 1L1 9"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </>
          }
        />
      </div>
    </>
  );
}

export default function NavSearch(props: NavSearchDrawerProps) {
  return (
    <Suspense fallback={null}>
      <NavSearchInner {...props} />
    </Suspense>
  );
}
