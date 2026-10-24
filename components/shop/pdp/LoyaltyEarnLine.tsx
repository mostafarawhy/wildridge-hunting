import { useTranslations } from "next-intl";
import { StarOutlineIcon } from "@/components/ui/icons";
import { formatDisplayDate } from "@/lib/utils/date";
import { formatMultiplier } from "@/lib/utils/loyalty-points";

interface LoyaltyEarnLineProps {
  points: number;
  locale: string;
  boostMultiplier?: number | null;
  boostEndsAt?: string | null;
}

export default function LoyaltyEarnLine({
  points,
  locale,
  boostMultiplier,
  boostEndsAt,
}: LoyaltyEarnLineProps) {
  const t = useTranslations("shop");

  return (
    <div
      className="flex items-start"
      style={{
        gap: "0.5rem",
        marginTop: "0.75rem",
        borderInlineStart: "3px solid var(--color-accent)",
        paddingInlineStart: "0.75rem",
      }}
    >
      <span style={{ color: "var(--color-accent)", display: "flex", paddingBlockStart: "0.125rem" }}>
        <StarOutlineIcon size={16} />
      </span>
      <div className="flex flex-col" style={{ gap: "0.125rem" }}>
        <p
          className="text-body-sm"
          style={{ color: "var(--color-content-tertiary)", margin: 0 }}
        >
          {t.rich("points_earn", {
            points: points.toLocaleString("en-US"),
            b: (c) => (
              <span
                dir="ltr"
                style={{
                  color: "var(--color-accent-dark)",
                  fontWeight: "var(--font-semibold)",
                }}
              >
                {c}
              </span>
            ),
          })}
        </p>
        <p
          className="text-body-sm"
          style={{ color: "var(--color-content-tertiary)", margin: 0 }}
        >
          {boostMultiplier && boostEndsAt
            ? `${t("points_boost_until", {
                multiplier: formatMultiplier(boostMultiplier),
                date: formatDisplayDate(boostEndsAt, locale),
              })} `
            : ""}
          {t("points_on_delivery")}
        </p>
      </div>
    </div>
  );
}
