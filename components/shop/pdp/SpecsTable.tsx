import { getSpecLabel, getSpecValue } from "@/lib/utils/specs";

interface SpecsTableProps {
  specs: Array<{
    labelEn: string;
    labelAr: string;
    labelRu?: string | null;
    valueEn: string;
    valueAr: string;
    valueRu?: string | null;
  }>;
  locale: string;
}

export default function SpecsTable({ specs, locale }: SpecsTableProps) {
  return (
    <div className="flex flex-col">
      {specs.map((spec, i) => (
        <div
          key={spec.labelEn}
          className="flex items-center justify-between py-2.5"
          style={{
            borderBottom:
              i < specs.length - 1
                ? "1px solid var(--color-shop-divider)"
                : "none",
          }}
        >
          <span
            className="text-body-sm"
            style={{ color: "var(--color-content-tertiary)" }}
          >
            {getSpecLabel(spec, locale)}
          </span>
          <span
            className="text-body-sm"
            style={{
              color: "var(--primitive-black)",
              fontWeight: "var(--font-medium)",
            }}
          >
            {getSpecValue(spec, locale)}
          </span>
        </div>
      ))}
    </div>
  );
}
