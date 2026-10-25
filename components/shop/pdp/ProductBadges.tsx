import { useTranslations } from "next-intl";
import { StarOutlineIcon } from "@/components/ui/icons";
import { formatMultiplier } from "@/lib/utils/loyalty-points";

interface ProductBadgesProps {
  isNew?: boolean;
  onSale?: boolean;
  pointsBoost?: number | null;
}

export default function ProductBadges({
  isNew,
  onSale,
  pointsBoost,
}: ProductBadgesProps) {
  const t = useTranslations("shop");

  if (!isNew && !onSale && !pointsBoost) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {onSale && (
        <span
          className="text-eyebrow tracking-widest uppercase px-2 py-1"
          style={{
            border: "1px solid var(--color-action-primary)",
            color: "var(--color-action-primary)",
            borderRadius: "var(--radius-xs)",
          }}
        >
          {t("badge_sale")}
        </span>
      )}
      {isNew && (
        <span
          className="text-eyebrow tracking-widest uppercase px-2 py-1"
          style={{
            border: "1px solid var(--color-accent)",
            color: "var(--color-accent-text)",
            borderRadius: "var(--radius-xs)",
          }}
        >
          {t("badge_new")}
        </span>
      )}
      {pointsBoost ? (
        <span
          className="text-eyebrow tracking-widest uppercase px-2 py-1"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
            backgroundColor: "color-mix(in srgb, var(--color-accent) 16%, #ffffff)",
            border: "1px solid color-mix(in srgb, var(--color-accent) 40%, #ffffff)",
            color: "var(--color-accent-dark)",
            borderRadius: "var(--radius-xs)",
          }}
        >
          <StarOutlineIcon size={11} />
          {t("badge_points_boost", {
            multiplier: formatMultiplier(pointsBoost),
          })}
        </span>
      ) : null}
    </div>
  );
}
