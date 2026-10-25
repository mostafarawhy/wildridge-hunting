import { formatAED } from "@/lib/utils/currency";

interface ProductPriceProps {
  price: number;
  compareAtPrice?: number;
}

export default function ProductPrice({
  price,
  compareAtPrice,
}: ProductPriceProps) {
  return (
    <div className="flex items-baseline gap-3">
      <span
        className="whitespace-nowrap text-[length:var(--text-heading)] lg:text-[length:var(--text-display-sm)]"
        style={{
          color: "var(--primitive-black)",
          fontWeight: "var(--font-bold)",
        }}
      >
        {formatAED(price)}
      </span>
      {compareAtPrice && compareAtPrice > price && (
        <span
          style={{
            color: "var(--color-content-tertiary)",
            fontSize: "var(--text-body-lg)",
            textDecoration: "line-through",
          }}
        >
          {formatAED(compareAtPrice)}
        </span>
      )}
    </div>
  );
}
