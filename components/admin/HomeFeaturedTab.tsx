"use client";

import { useState } from "react";
import FadeImage from "@/components/ui/FadeImage";
import FeaturedProductPickerModal from "@/components/admin/FeaturedProductPickerModal";
import { formatAED } from "@/lib/utils/currency";
import { FEATURED_LIMITS } from "@/lib/utils/featured-collection";
import type {
  FeaturedEditorItem,
  FeaturedPickerItem,
} from "@/lib/db/queries/collections";

interface Props {
  shown: boolean;
  items: FeaturedEditorItem[];
  pickerItems: FeaturedPickerItem[];
  switchRow: React.ReactNode;
  headingField: React.ReactNode;
  busy: boolean;
  error?: string;
  onShownChange: (next: boolean) => void;
  onMove: (index: number, step: -1 | 1) => void;
  onRemove: (index: number) => void;
  onAdd: (picked: FeaturedPickerItem[]) => void;
}

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #e8e8e8",
  borderRadius: "0",
  padding: "1.5rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.875rem",
  minWidth: 0,
};

const hintStyle: React.CSSProperties = {
  fontSize: "var(--text-body-sm)",
  color: "var(--color-content-tertiary)",
  margin: 0,
};

const blackButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "2.5rem",
  paddingInline: "1.25rem",
  fontSize: "var(--text-body-sm)",
  fontWeight: "var(--font-bold)",
  letterSpacing: "var(--tracking-widest)",
  textTransform: "uppercase",
  backgroundColor: "#0b0b0b",
  color: "#ffffff",
  border: "none",
  borderRadius: "0",
  cursor: "pointer",
};

const smallBlackButton: React.CSSProperties = {
  height: "1.75rem",
  paddingInline: "0.625rem",
  fontSize: "var(--text-body-sm)",
  fontWeight: "var(--font-bold)",
  backgroundColor: "#0b0b0b",
  color: "#ffffff",
  border: "none",
  borderRadius: "0",
  cursor: "pointer",
};

const linkBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  fontSize: "var(--text-body-sm)",
  color: "#0b0b0b",
  textDecoration: "underline",
  cursor: "pointer",
};

function Switch({
  enabled,
  disabled,
  label,
  onToggle,
}: {
  enabled: boolean;
  disabled: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      style={{
        display: "inline-flex",
        alignItems: "center",
        width: "2.5rem",
        height: "1.375rem",
        padding: "0.1875rem",
        backgroundColor: enabled
          ? "var(--color-action-primary)"
          : "var(--color-auth-input-border)",
        border: "none",
        borderRadius: "9999px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "background-color 150ms",
        flexShrink: 0,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: "1rem",
          height: "1rem",
          borderRadius: "9999px",
          backgroundColor: "#ffffff",
          transform: enabled ? "translateX(1.125rem)" : "translateX(0)",
          transition: "transform 150ms",
        }}
      />
    </button>
  );
}

export default function HomeFeaturedTab({
  shown,
  items,
  pickerItems,
  switchRow,
  headingField,
  busy,
  error,
  onShownChange,
  onMove,
  onRemove,
  onAdd,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const pickedSkus = new Set(items.map((item) => item.sku));
  const available = pickerItems.filter((item) => !pickedSkus.has(item.sku));
  const placesLeft = Math.max(0, FEATURED_LIMITS.max - items.length);

  return (
    <>
      <div style={cardStyle}>
        {switchRow}
        {headingField}
      </div>

      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Switch
            enabled={shown}
            disabled={busy}
            label="Show this section on the homepage"
            onToggle={() => onShownChange(!shown)}
          />
          <span
            style={{
              fontSize: "var(--text-body)",
              fontWeight: "var(--font-medium)",
              color: "var(--color-auth-label-text)",
            }}
          >
            Show this section on the homepage
          </span>
        </div>
        <p style={hintStyle}>
          Hidden, the homepage goes from the hero straight to the collection tiles.
        </p>
      </div>

      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: "var(--text-body-lg)",
              fontWeight: "var(--font-bold)",
              color: "#0b0b0b",
            }}
          >
            Products ({items.length} of {FEATURED_LIMITS.max})
          </h3>
          <button
            type="button"
            disabled={busy || placesLeft === 0}
            onClick={() => setPickerOpen(true)}
            style={{
              ...blackButton,
              opacity: busy || placesLeft === 0 ? 0.5 : 1,
              cursor: busy || placesLeft === 0 ? "not-allowed" : "pointer",
            }}
          >
            Add products
          </button>
        </div>
        <p style={hintStyle}>
          Visitors see 4 at a time; more than 4 adds arrows. Only products live on the
          shop can be added. Show at least 4.
        </p>

        {items.length === 0 ? (
          <p style={hintStyle}>No products picked yet.</p>
        ) : (
          <ol
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              border: "1px solid #e8e8e8",
            }}
          >
            {items.map((item, index) => (
              <li
                key={item.sku}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.625rem 0.75rem",
                  borderBottom: index < items.length - 1 ? "1px solid #e8e8e8" : "none",
                }}
              >
                <span
                  style={{
                    width: "1.5rem",
                    flexShrink: 0,
                    textAlign: "center",
                    fontSize: "var(--text-body-sm)",
                    color: "#6b6b6b",
                  }}
                >
                  {index + 1}
                </span>
                <div
                  style={{
                    position: "relative",
                    width: 44,
                    height: 44,
                    flexShrink: 0,
                    backgroundColor: "var(--color-auth-input-bg)",
                    border: "1px solid var(--color-auth-input-border)",
                    overflow: "hidden",
                  }}
                >
                  <FadeImage
                    src={item.imageUrl}
                    alt={item.nameEn}
                    fill
                    sizes="44px"
                    className="object-contain"
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.125rem",
                    minWidth: 0,
                    flex: 1,
                  }}
                >
                  <span
                    style={{
                      fontSize: "var(--text-body)",
                      fontWeight: 500,
                      color: "#0b0b0b",
                    }}
                  >
                    {item.nameEn}
                  </span>
                  <span style={{ fontSize: 13, color: "#6b6b6b" }}>
                    {item.brand?.nameEn ? `${item.brand.nameEn} · ` : ""}
                    <span dir="ltr">{formatAED(item.price, "en")}</span>
                  </span>
                  {!item.live && (
                    <span style={{ fontSize: 13, color: "#991b1b" }}>
                      Not on the shop — remove it to save
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <button
                    type="button"
                    aria-label={`Move ${item.nameEn} up`}
                    disabled={busy || index === 0}
                    onClick={() => onMove(index, -1)}
                    style={{
                      ...smallBlackButton,
                      opacity: busy || index === 0 ? 0.4 : 1,
                      cursor: busy || index === 0 ? "not-allowed" : "pointer",
                    }}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${item.nameEn} down`}
                    disabled={busy || index === items.length - 1}
                    onClick={() => onMove(index, 1)}
                    style={{
                      ...smallBlackButton,
                      opacity: busy || index === items.length - 1 ? 0.4 : 1,
                      cursor:
                        busy || index === items.length - 1 ? "not-allowed" : "pointer",
                    }}
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${item.nameEn}`}
                    disabled={busy}
                    onClick={() => onRemove(index)}
                    style={linkBtn}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}

        {error && (
          <p
            role="alert"
            style={{
              margin: 0,
              fontSize: "var(--text-body-sm)",
              color: "var(--color-auth-error-text)",
            }}
          >
            {error}
          </p>
        )}
      </div>

      <FeaturedProductPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        items={available}
        placesLeft={placesLeft}
        onAdd={(skus) => {
          const bySku = new Map(available.map((item) => [item.sku, item]));
          onAdd(
            skus
              .map((sku) => bySku.get(sku))
              .filter((item): item is FeaturedPickerItem => !!item),
          );
        }}
      />
    </>
  );
}
