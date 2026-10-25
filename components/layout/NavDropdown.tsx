"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { ChevronDown } from "@/components/ui";
import type { NavColumn } from "./nav-types";
import MegaPanelPhoto from "./MegaPanelPhoto";
import type { FocalPoint } from "@/lib/utils/focal-point";

interface NavDropdownProps {
  label: string;
  href: string;
  columns: NavColumn[];
  allLabel: string;
  megaImage?: string;
  megaFocus?: FocalPoint;
}

const CLOSE_DELAY_MS = 150;

export default function NavDropdown({
  label,
  href,
  columns,
  allLabel,
  megaImage,
  megaFocus,
}: NavDropdownProps) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(false);
  const panelId = useId();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const suppressFocusOpen = useRef(false);

  const clearTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const openNow = () => {
    clearTimer();
    setOpen(true);
    setSeen(true);
  };

  const closeNow = () => {
    clearTimer();
    setOpen(false);
  };

  const closeSoon = () => {
    clearTimer();
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  return (
    <li
      className={megaImage ? undefined : "relative"}
      onMouseEnter={openNow}
      onMouseLeave={closeSoon}
      onFocus={() => {
        if (suppressFocusOpen.current) {
          suppressFocusOpen.current = false;
          return;
        }
        openNow();
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          closeNow();
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          closeNow();
          suppressFocusOpen.current = true;
          buttonRef.current?.focus();
        }
      }}
    >
      <div className="flex items-center">
        <Link
          href={href}
          className="shop-nav-link flex items-center gap-1 text-label tracking-widest uppercase transition-colors duration-150"
          style={{
            color: open
              ? "var(--color-content-primary)"
              : "var(--color-content-secondary)",
          }}
        >
          {label}
        </Link>
        <button
          ref={buttonRef}
          type="button"
          className="flex items-center ps-1"
          style={{
            color: "var(--color-content-secondary)",
            paddingBlock: "16px",
            marginBlock: "-16px",
            paddingInlineEnd: "28px",
            marginInlineEnd: "-28px",
          }}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={label}
          onClick={openNow}
        >
          <span
            className="transition-transform duration-200"
            style={{ transform: open ? "rotate(180deg)" : undefined }}
          >
            <ChevronDown />
          </span>
        </button>
      </div>

      {!megaImage ? (
        <div
          id={panelId}
          className="absolute top-full start-0 pt-2 transition-all duration-200"
          style={{
            zIndex: "var(--z-dropdown)",
            opacity: open ? 1 : 0,
            visibility: open ? "visible" : "hidden",
            pointerEvents: open ? "auto" : "none",
            transform: open ? "translateY(0)" : "translateY(4px)",
          }}
        >
          <ul
            className="flex flex-col py-2 min-w-[200px]"
            style={{
              backgroundColor: "var(--color-surface-sunken)",
              border: "1px solid var(--color-border-default)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-lg)",
            }}
            role="list"
          >
            {columns.flatMap((col, colIndex) => [
              <li key={`${col.href}:all`}>
                {colIndex > 0 && (
                  <div
                    style={{
                      height: "1px",
                      backgroundColor: "var(--color-border-default)",
                      margin: "4px 0",
                    }}
                  />
                )}
                <Link
                  href={col.href}
                  onClick={closeNow}
                  className="block px-4 py-2 text-label tracking-widest uppercase transition-colors duration-150"
                  style={{
                    color: "var(--color-content-tertiary)",
                    fontSize: "var(--text-eyebrow)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.color =
                      "var(--color-content-primary)";
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      "var(--color-surface-raised)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.color =
                      "var(--color-content-tertiary)";
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      "transparent";
                  }}
                >
                  {`${allLabel} ${col.label}`}
                </Link>
              </li>,
              ...col.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={closeNow}
                    className="block px-4 py-2 text-label tracking-widest uppercase transition-colors duration-150"
                    style={{
                      color: "var(--color-content-secondary)",
                      fontSize: "var(--text-label)",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.color =
                        "var(--color-content-primary)";
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        "var(--color-surface-raised)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.color =
                        "var(--color-content-secondary)";
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        "transparent";
                    }}
                  >
                    {link.label}
                  </Link>
                </li>
              )),
            ])}
          </ul>
        </div>
      ) : (
      <div
        id={panelId}
        className="absolute inset-x-0 top-full transition-all duration-200"
        style={{
          backgroundColor: "var(--color-surface-sunken)",
          borderTop: "1px solid var(--color-border-default)",
          borderBottom: "1px solid var(--color-border-default)",
          boxShadow: "var(--shadow-lg)",
          zIndex: "var(--z-dropdown)",
          opacity: open ? 1 : 0,
          visibility: open ? "visible" : "hidden",
          pointerEvents: open ? "auto" : "none",
        }}
      >
        <div className="mx-auto max-w-[1440px] px-6 lg:px-10 py-8 flex items-start gap-14">
          <Link
            href={href}
            onClick={closeNow}
            className="group relative block overflow-hidden"
            style={{
              flex: "none",
              width: "280px",
              aspectRatio: "4 / 3",
              backgroundColor: "var(--color-surface-raised)",
              border: "1px solid var(--color-border-default)",
            }}
          >
            <MegaPanelPhoto
              imageUrl={megaImage}
              focus={megaFocus}
              label={label}
              allLabel={allLabel}
              show={seen}
            />
          </Link>

          <div
            className="self-stretch"
            style={{
              width: "1px",
              backgroundColor: "var(--color-border-default)",
            }}
          />

          <div className="flex gap-12">
            {columns.map((col) => (
              <div key={col.href} className="flex flex-col" style={{ width: "200px" }}>
                <Link
                  href={col.href}
                  onClick={closeNow}
                  className="text-label tracking-widest uppercase mb-3"
                  style={{
                    color: "var(--color-content-primary)",
                    fontWeight: 600,
                  }}
                >
                  {col.label}
                </Link>
                <ul className="flex flex-col" role="list">
                  {col.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        onClick={closeNow}
                        className="block text-body py-1.5 transition-colors duration-150"
                        style={{ color: "var(--color-content-secondary)" }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color =
                            "var(--color-content-primary)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color =
                            "var(--color-content-secondary)";
                        }}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}
    </li>
  );
}
