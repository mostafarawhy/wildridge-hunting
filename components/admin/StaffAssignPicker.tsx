"use client";

import { useEffect, useRef, useState } from "react";
import type { StaffRole } from "@/app/generated/prisma/client";
import { STAFF_ROLE_LABELS } from "@/lib/utils/staff-permissions";

type R = StaffRole;

interface StaffOption {
  id: string;
  name: string;
  email: string;
  role?: R;
}

interface StaffAssignPickerProps {
  id: string;
  label: string;
  staff: StaffOption[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}

function roleLabel(role: R): string {
  return STAFF_ROLE_LABELS[role];
}

export default function StaffAssignPicker({
  id,
  label,
  staff,
  value,
  onChange,
  disabled,
}: StaffAssignPickerProps) {
  const [open, setOpen] = useState(false);
  const [triggerFocused, setTriggerFocused] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const listboxId = `${id}-listbox`;

  const trimmedQuery = query.trim().toLowerCase();
  const filteredStaff = trimmedQuery
    ? staff.filter((s) => {
        if (s.name.toLowerCase().includes(trimmedQuery)) return true;
        if (s.email.toLowerCase().includes(trimmedQuery)) return true;
        if (!s.role) return false;
        const rawRole = s.role.toLowerCase();
        if (rawRole.includes(trimmedQuery)) return true;
        if (rawRole.replace(/_/g, " ").includes(trimmedQuery)) return true;
        return roleLabel(s.role).toLowerCase().includes(trimmedQuery);
      })
    : staff;

  const optionCount = 1 + filteredStaff.length;
  const selected = staff.find((s) => s.id === value);

  function openPanel() {
    if (disabled) return;
    setQuery("");
    const idx =
      value === ""
        ? 0
        : (() => {
            const i = staff.findIndex((s) => s.id === value);
            return i === -1 ? 0 : i + 1;
          })();
    setActive(idx);
    setOpen(true);
  }

  function selectOption(optionId: string) {
    onChange(optionId);
    setOpen(false);
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector(
      `[data-index="${active}"]`,
    ) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  const borderColor =
    triggerFocused || open
      ? "var(--color-auth-input-border-focus)"
      : "var(--color-auth-input-border)";

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: "0.375rem",
      }}
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
      </label>

      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        {...(open ? { "aria-controls": listboxId } : {})}
        onFocus={() => setTriggerFocused(true)}
        onBlur={() => setTriggerFocused(false)}
        onClick={() => (open ? setOpen(false) : openPanel())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            openPanel();
          }
        }}
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
          cursor: disabled ? "not-allowed" : "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
          }}
        >
          {selected ? selected.name : "Unassigned"}
        </span>
        <svg
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          style={{ flexShrink: 0 }}
        >
          <path
            d="M2.5 4.5L6 8L9.5 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            insetInlineStart: 0,
            width: "320px",
            maxWidth: "calc(100vw - 2rem)",
            zIndex: 50,
            backgroundColor: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 0,
            boxShadow: "0 8px 32px rgba(0,0,0,0.13)",
          }}
        >
          <input
            ref={searchRef}
            role="combobox"
            aria-label="Search staff"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-activedescendant={`${id}-opt-${active}`}
            dir="ltr"
            placeholder="Search name, email, role…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, optionCount - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (active === 0) {
                  selectOption("");
                } else {
                  const s = filteredStaff[active - 1];
                  if (s) selectOption(s.id);
                }
              } else if (e.key === "Escape") {
                e.stopPropagation();
                setOpen(false);
                triggerRef.current?.focus();
              } else if (e.key === "Tab") {
                setOpen(false);
              }
            }}
            style={{
              width: "100%",
              padding: "0.5rem 0.75rem",
              fontSize: "var(--text-body)",
              color: "#0b0b0b",
              border: "none",
              borderBottom: "1px solid var(--color-shop-divider)",
              outline: "none",
              boxSizing: "border-box",
            }}
          />

          <ul
            ref={listRef}
            role="listbox"
            id={listboxId}
            style={{
              height: "240px",
              overflowY: "auto",
              margin: 0,
              padding: 0,
              listStyle: "none",
            }}
          >
            <li
              role="option"
              id={`${id}-opt-0`}
              data-index={0}
              aria-selected={value === ""}
              onMouseEnter={() => setActive(0)}
              onMouseDown={(e) => {
                e.preventDefault();
                selectOption("");
              }}
              style={{
                padding: "0.5rem 0.75rem",
                cursor: "pointer",
                backgroundColor:
                  active === 0 ? "var(--color-auth-form-bg)" : "#fff",
                fontSize: "var(--text-body)",
                color: "#6b6b6b",
              }}
            >
              Unassigned
            </li>

            {filteredStaff.length === 0 && (
              <li
                role="presentation"
                style={{
                  padding: "0.5rem 0.75rem",
                  fontSize: "var(--text-body-sm)",
                  color: "#6b6b6b",
                }}
              >
                No staff match
              </li>
            )}

            {filteredStaff.map((s, idx) => {
              const i = idx + 1;
              const isSelected = s.id === value;
              return (
                <li
                  key={s.id}
                  role="option"
                  id={`${id}-opt-${i}`}
                  data-index={i}
                  aria-selected={isSelected}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectOption(s.id);
                  }}
                  style={{
                    padding: "0.5rem 0.75rem",
                    cursor: "pointer",
                    backgroundColor:
                      active === i ? "var(--color-auth-form-bg)" : "#fff",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "var(--text-body)",
                        color: "#0b0b0b",
                        fontWeight: isSelected
                          ? "var(--font-semibold)"
                          : "var(--font-medium)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        minWidth: 0,
                      }}
                    >
                      {s.name}
                      {isSelected && (
                        <span
                          aria-hidden="true"
                          style={{ color: "var(--color-action-primary)" }}
                        >
                          {" "}
                          ✓
                        </span>
                      )}
                    </span>
                    {s.role && (
                      <span
                        style={{
                          fontSize: "var(--text-label)",
                          fontWeight: "var(--font-semibold)",
                          textTransform: "uppercase",
                          letterSpacing: "var(--tracking-wide)",
                          padding: "0.125rem 0.5rem",
                          border: "1px solid var(--color-shop-divider)",
                          color: "#6b6b6b",
                          backgroundColor: "#fff",
                          flexShrink: 0,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {roleLabel(s.role)}
                      </span>
                    )}
                  </div>
                  <p
                    dir="ltr"
                    style={{
                      fontSize: "var(--text-body-sm)",
                      color: "#6b6b6b",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      margin: 0,
                    }}
                  >
                    {s.email}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
