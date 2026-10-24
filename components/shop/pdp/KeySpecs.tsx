import { getSpecLabel, getSpecValue } from "@/lib/utils/specs";

type KeySpec = Parameters<typeof getSpecLabel>[0] &
  Parameters<typeof getSpecValue>[0];

interface KeySpecsProps {
  specs: KeySpec[];
  locale: string;
  compact?: boolean;
}

export default function KeySpecs({
  specs,
  locale,
  compact = false,
}: KeySpecsProps) {
  if (specs.length === 0) return null;

  const shown = specs.slice(0, 3);

  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${Math.min(shown.length, 3)}, minmax(0, 1fr))`,
        borderTop: "1px solid var(--primitive-black)",
        borderBottom: "1px solid var(--color-shop-divider)",
      }}
    >
      {shown.map((spec, i) => (
        <div
          key={spec.labelEn}
          style={{
            padding: compact ? "0.5rem 0.625rem" : "0.75rem 0.875rem",
            paddingInlineStart: i === 0 ? 0 : undefined,
            borderInlineStart:
              i > 0 ? "1px solid var(--color-shop-divider)" : undefined,
            minWidth: 0,
          }}
        >
          <p
            className="text-eyebrow tracking-widest uppercase"
            style={{
              color: "var(--color-content-tertiary)",
              overflowWrap: "anywhere",
            }}
          >
            {getSpecLabel(spec, locale)}
          </p>
          <p
            className={compact ? "text-body-sm" : "text-body-sm lg:text-body"}
            style={{
              color: "var(--primitive-black)",
              fontWeight: "var(--font-medium)",
              fontVariantNumeric: "tabular-nums",
              marginTop: "0.25rem",
              overflowWrap: "anywhere",
            }}
          >
            {getSpecValue(spec, locale)}
          </p>
        </div>
      ))}
    </div>
  );
}
