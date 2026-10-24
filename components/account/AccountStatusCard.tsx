import { getTranslations } from "next-intl/server";
import { formatDisplayDate } from "@/lib/utils/date";

type VerificationStatus =
  | "NOT_REQUIRED"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED";
type B2BStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "SUSPENDED"
  | "EXPIRED"
  | null;

interface Props {
  role: "B2C" | "B2B";
  verificationStatus: VerificationStatus;
  verifiedAt: string | null;
  createdAt: string;
  b2bStatus: B2BStatus;
  locale: string;
}

interface BadgeTokens {
  border: string;
  text: string;
}

const verificationTokens: Record<VerificationStatus, BadgeTokens> = {
  APPROVED: {
    border: "var(--primitive-green)",
    text: "var(--primitive-green)",
  },
  PENDING: {
    border: "var(--primitive-amber)",
    text: "var(--primitive-amber)",
  },
  REJECTED: {
    border: "var(--color-action-primary)",
    text: "var(--color-action-primary)",
  },
  EXPIRED: {
    border: "var(--color-action-primary)",
    text: "var(--color-action-primary)",
  },
  NOT_REQUIRED: {
    border: "var(--primitive-muted-gray)",
    text: "var(--primitive-muted-gray)",
  },
};

const b2bTokens: Record<NonNullable<B2BStatus>, BadgeTokens> = {
  APPROVED: {
    border: "var(--primitive-green)",
    text: "var(--primitive-green)",
  },
  PENDING: {
    border: "var(--primitive-amber)",
    text: "var(--primitive-amber)",
  },
  REJECTED: {
    border: "var(--color-action-primary)",
    text: "var(--color-action-primary)",
  },
  SUSPENDED: {
    border: "var(--primitive-amber)",
    text: "var(--primitive-amber)",
  },
  EXPIRED: {
    border: "var(--primitive-muted-gray)",
    text: "var(--primitive-muted-gray)",
  },
};

function Badge({ tokens, label }: { tokens: BadgeTokens; label: string }) {
  return (
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
        border: `1px solid ${tokens.border}`,
        color: tokens.text,
        borderRadius: "var(--radius-none)",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function StatusRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
        padding: "0.75rem 0",
        borderBottom: "1px solid var(--color-shop-divider)",
      }}
    >
      <span
        style={{
          fontSize: "var(--text-body-sm)",
          color: "var(--color-content-tertiary)",
          fontWeight: "var(--font-medium)",
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

export default async function AccountStatusCard({
  role,
  verificationStatus,
  verifiedAt,
  createdAt,
  b2bStatus,
  locale,
}: Props) {
  const t = await getTranslations("account.status");

  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid var(--color-shop-divider)",
        borderRadius: "var(--radius-none)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "3px",
          backgroundColor: "var(--color-action-primary)",
        }}
      />
      <div style={{ padding: "1.25rem 1.5rem" }}>
        <p
          style={{
            fontSize: "var(--text-eyebrow)",
            fontWeight: "var(--font-bold)",
            letterSpacing: "var(--tracking-widest)",
            textTransform: "uppercase",
            color: "var(--color-action-primary)",
            marginBottom: "0.75rem",
          }}
        >
          {t("title")}
        </p>

        <StatusRow label={t("accountType")}>
          <Badge
            tokens={verificationTokens.NOT_REQUIRED}
            label={role === "B2B" ? t("typeB2B") : t("typeB2C")}
          />
        </StatusRow>

        <StatusRow label={t("verificationLabel")}>
          <Badge
            tokens={verificationTokens[verificationStatus]}
            label={t(`v${verificationStatus}` as keyof typeof t)}
          />
        </StatusRow>

        {b2bStatus !== null && (
          <StatusRow label={t("b2bLabel")}>
            <Badge
              tokens={b2bTokens[b2bStatus]}
              label={t(`b${b2bStatus}` as keyof typeof t)}
            />
          </StatusRow>
        )}

        <div
          style={{
            paddingTop: "0.875rem",
            fontSize: "var(--text-body-sm)",
            color: "var(--color-content-tertiary)",
          }}
        >
          {t("memberSince")}{" "}
          <span
            style={{
              fontWeight: "var(--font-semibold)",
              color: "var(--color-action-primary)",
            }}
          >
            {formatDisplayDate(createdAt, locale)}
          </span>
          {verificationStatus === "APPROVED" && verifiedAt && (
            <span style={{ marginInlineStart: "1rem" }}>
              · {t("verifiedOn")}{" "}
              <span
                style={{
                  fontWeight: "var(--font-semibold)",
                  color: "var(--color-action-primary)",
                }}
              >
                {formatDisplayDate(verifiedAt, locale)}
              </span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
