import { useTranslations } from "next-intl";
import type { CustomerAddressProjection } from "@/lib/db/queries/account";
import { formatDisplayDate } from "@/lib/utils/date";
import { getCountryName } from "@/lib/data/countries";

interface Props {
  address: CustomerAddressProjection;
  locale: string;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  isSettingDefault?: boolean;
  isDeleting?: boolean;
  selectable?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}

export default function AddressCard({
  address,
  locale,
  onEdit,
  onDelete,
  onSetDefault,
  isSettingDefault = false,
  isDeleting = false,
  selectable = false,
  isSelected = false,
  onSelect,
}: Props) {
  const t = useTranslations("account.addresses");

  const borderColor = selectable
    ? isSelected
      ? "var(--color-action-primary)"
      : "var(--color-auth-form-border)"
    : address.isDefault
      ? "var(--color-action-primary)"
      : "var(--color-auth-form-border)";

  return (
    <div
      {...(selectable
        ? {
            role: "button" as const,
            tabIndex: 0,
            onClick: onSelect,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect?.();
              }
            },
          }
        : {})}
      style={{
        backgroundColor: "#ffffff",
        border: `1px solid ${borderColor}`,
        borderRadius: "var(--radius-none)",
        padding: "1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        position: "relative",
        ...(selectable ? { cursor: "pointer" } : {}),
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "0.5rem",
        }}
      >
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}
        >
          {address.label && (
            <p
              style={{
                fontSize: "var(--text-eyebrow)",
                fontWeight: "var(--font-bold)",
                letterSpacing: "var(--tracking-widest)",
                textTransform: "uppercase",
                color: "var(--color-action-primary)",
                margin: 0,
              }}
            >
              {address.label}
            </p>
          )}
          <p
            style={{
              fontSize: "var(--text-body)",
              fontWeight: "var(--font-semibold)",
              color: "var(--color-action-primary)",
              margin: 0,
            }}
          >
            {address.fullName}
          </p>
        </div>
        {address.isDefault && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "0.1875rem 0.5rem",
              fontSize: "var(--text-eyebrow)",
              fontWeight: "var(--font-black)",
              letterSpacing: "var(--tracking-wide)",
              textTransform: "uppercase",
              backgroundColor: "transparent",
              border: "1px solid var(--primitive-green)",
              color: "var(--primitive-green)",
              borderRadius: "var(--radius-none)",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {t("defaultBadge")}
          </span>
        )}
      </div>

      <address
        style={{
          fontStyle: "normal",
          fontSize: "var(--text-body-sm)",
          color: "var(--color-content-tertiary)",
          lineHeight: "var(--leading-relaxed)",
          display: "flex",
          flexDirection: "column",
          gap: "0.125rem",
        }}
      >
        <span>
          {address.addressLine1}
          {address.addressLine2 && `, ${address.addressLine2}`}
        </span>
        <span>
          {address.city}, {address.emirate}
          {address.postalCode && ` ${address.postalCode}`}
        </span>
        <span>{getCountryName(address.country)}</span>
        <span dir="ltr" style={{ display: "inline-block" }}>
          {address.phone}
        </span>
      </address>

      <p
        style={{
          fontSize: "var(--text-body-sm)",
          color: "var(--color-content-tertiary)",
          margin: 0,
        }}
      >
        {t("addedOn", { date: formatDisplayDate(address.createdAt, locale) })}
      </p>

      {!selectable && (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          paddingTop: "0.5rem",
          borderTop: "1px solid var(--color-auth-form-border)",
        }}
      >
        <button
          type="button"
          onClick={onEdit}
          style={{
            fontSize: "var(--text-body-sm)",
            fontWeight: "var(--font-medium)",
            color: "var(--color-auth-label-text)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            textDecoration: "underline",
            textUnderlineOffset: "3px",
          }}
        >
          {t("edit")}
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={isDeleting}
          style={{
            fontSize: "var(--text-body-sm)",
            fontWeight: "var(--font-medium)",
            color: "var(--color-error)",
            background: "none",
            border: "none",
            cursor: isDeleting ? "not-allowed" : "pointer",
            padding: 0,
            textDecoration: "underline",
            textUnderlineOffset: "3px",
            opacity: isDeleting ? 0.5 : 1,
          }}
        >
          {isDeleting ? t("deleting") : t("delete")}
        </button>
        {!address.isDefault && (
          <button
            type="button"
            onClick={onSetDefault}
            disabled={isSettingDefault}
            style={{
              fontSize: "var(--text-body-sm)",
              fontWeight: "var(--font-medium)",
              color: "var(--color-auth-label-text)",
              background: "none",
              border: "none",
              cursor: isSettingDefault ? "not-allowed" : "pointer",
              padding: 0,
              marginInlineStart: "auto",
              opacity: isSettingDefault ? 0.5 : 1,
            }}
          >
            {t("setAsDefault")}
          </button>
        )}
      </div>
      )}
    </div>
  );
}
