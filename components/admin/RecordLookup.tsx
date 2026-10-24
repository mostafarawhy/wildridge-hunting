"use client";

import { useEffect, useRef, useState } from "react";
import { searchTicketLinkTargetsAction } from "@/lib/actions/tickets";
import type { TicketLinkOption } from "@/lib/db/queries/ticket";
import type { TicketLinkKind } from "@/lib/utils/ticket-status";

interface RecordLookupProps {
  id: string;
  label: string;
  kind: TicketLinkKind;
  value: TicketLinkOption | null;
  onChange: (v: TicketLinkOption | null) => void;
  locked?: boolean;
  disabled?: boolean;
  required?: boolean;
}

const SEARCH_PLACEHOLDER: Record<TicketLinkKind, string> = {
  order: "Order #, customer name or email…",
  quote: "Quote #, customer name or email…",
  b2b: "Company, trade licence or email…",
  verification: "Customer name or email…",
  customer: "Name or email…",
};

export default function RecordLookup({
  id,
  label,
  kind,
  value,
  onChange,
  locked,
  disabled,
  required,
}: RecordLookupProps) {
  const [open, setOpen] = useState(false);
  const [triggerFocused, setTriggerFocused] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [options, setOptions] = useState<TicketLinkOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const requestSeqRef = useRef(0);

  const listboxId = `${id}-listbox`;
  const trimmedQuery = query.trim();
  const showNoneOption = !required;
  const optionCount = (showNoneOption ? 1 : 0) + options.length;
  const noneLabel = kind === "customer" ? "No customer" : "None";

  function openPanel() {
    if (disabled || locked) return;
    setQuery("");
    setActive(0);
    setOptions([]);
    setError(null);
    setOpen(true);
  }

  function selectOption(option: TicketLinkOption | null) {
    onChange(option);
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

  useEffect(() => {
    if (!open) return;
    if (trimmedQuery.length < 2) return;
    const seq = ++requestSeqRef.current;
    const timer = setTimeout(() => {
      setLoading(true);
      searchTicketLinkTargetsAction({ kind, query: trimmedQuery }).then(
        (result) => {
          if (requestSeqRef.current !== seq) return;
          setLoading(false);
          if (result.success) {
            setOptions(result.data);
            setError(null);
          } else {
            setError(result.error);
            setOptions([]);
          }
        },
      )
        .catch(() => {
          if (requestSeqRef.current !== seq) return;
          setLoading(false);
          setOptions([]);
          setError("Search failed. Try again.");
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [open, query, kind, trimmedQuery]);

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
        {required && (
          <span
            aria-hidden="true"
            style={{ color: "var(--color-error)", lineHeight: 1 }}
          >
            *
          </span>
        )}
      </label>

      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup={locked ? undefined : "listbox"}
        aria-expanded={locked ? undefined : open}
        {...(open && !locked ? { "aria-controls": listboxId } : {})}
        onFocus={() => setTriggerFocused(true)}
        onBlur={() => setTriggerFocused(false)}
        onClick={() => {
          if (locked) return;
          if (open) setOpen(false);
          else openPanel();
        }}
        onKeyDown={(e) => {
          if (locked) return;
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
          backgroundColor: locked
            ? "var(--color-auth-form-bg)"
            : "var(--color-auth-input-bg)",
          border: `1.5px solid ${borderColor}`,
          borderRadius: "var(--radius-none)",
          outline: "none",
          transition: "border-color 150ms",
          opacity: disabled ? 0.5 : 1,
          cursor: locked ? "default" : disabled ? "not-allowed" : "pointer",
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
          {value ? (
            <>
              <span style={{ fontWeight: "var(--font-medium)" }}>
                {value.label}
              </span>
              {value.sublabel && (
                <span style={{ color: "#6b6b6b" }}> · {value.sublabel}</span>
              )}
            </>
          ) : (
            <span style={{ color: "var(--color-auth-input-placeholder)" }}>
              Search…
            </span>
          )}
        </span>
        {!locked && (
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
        )}
      </button>

      {open && !locked && (
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
            aria-label={label}
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-activedescendant={optionCount > 0 ? `${id}-opt-${active}` : undefined}
            dir="ltr"
            placeholder={SEARCH_PLACEHOLDER[kind]}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
              setLoading(e.target.value.trim().length >= 2);
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
                if (showNoneOption && active === 0) {
                  selectOption(null);
                } else {
                  const idx = showNoneOption ? active - 1 : active;
                  const opt = options[idx];
                  if (opt) selectOption(opt);
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
            {showNoneOption && (
              <li
                role="option"
                id={`${id}-opt-0`}
                data-index={0}
                aria-selected={value === null}
                onMouseEnter={() => setActive(0)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectOption(null);
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
                {noneLabel}
              </li>
            )}

            {trimmedQuery.length < 2 ? (
              <li
                role="presentation"
                style={{
                  padding: "0.5rem 0.75rem",
                  fontSize: "var(--text-body-sm)",
                  color: "#6b6b6b",
                }}
              >
                Type at least 2 characters
              </li>
            ) : loading ? (
              <li
                role="presentation"
                style={{
                  padding: "0.5rem 0.75rem",
                  fontSize: "var(--text-body-sm)",
                  color: "#6b6b6b",
                }}
              >
                Searching…
              </li>
            ) : error ? (
              <li
                role="presentation"
                style={{
                  padding: "0.5rem 0.75rem",
                  fontSize: "var(--text-body-sm)",
                  color: "#6b6b6b",
                }}
              >
                {error}
              </li>
            ) : options.length === 0 ? (
              <li
                role="presentation"
                style={{
                  padding: "0.5rem 0.75rem",
                  fontSize: "var(--text-body-sm)",
                  color: "#6b6b6b",
                }}
              >
                No matches
              </li>
            ) : (
              options.map((opt, idx) => {
                const i = (showNoneOption ? 1 : 0) + idx;
                const isSelected =
                  value?.id === opt.id && value?.kind === opt.kind;
                return (
                  <li
                    key={opt.id}
                    role="option"
                    id={`${id}-opt-${i}`}
                    data-index={i}
                    aria-selected={isSelected}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectOption(opt);
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
                        fontSize: "var(--text-body)",
                        color: "#0b0b0b",
                        fontWeight: isSelected
                          ? "var(--font-semibold)"
                          : "var(--font-medium)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {opt.label}
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
                      {opt.sublabel}
                    </p>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
