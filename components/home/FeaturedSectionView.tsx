import type { FeaturedProductItem } from "@/types/shop";
import type { LinkSlot } from "./link-slot";
import FeaturedProductsClient from "./FeaturedProductsClient";

interface FeaturedSectionViewProps {
  eyebrow: string;
  heading: string;
  seeAllLabel: string;
  items: FeaturedProductItem[];
  locale: string;
  isBusinessMode: boolean;
  link: LinkSlot;
}

export default function FeaturedSectionView({
  eyebrow,
  heading,
  seeAllLabel,
  items,
  locale,
  isBusinessMode,
  link,
}: FeaturedSectionViewProps) {
  return (
    <section
      className="w-full py-10 lg:py-14"
      style={{ backgroundColor: "var(--color-surface-inverse)" }}
      aria-label="Featured products"
    >
      <div className="mx-auto max-w-[1440px] px-6 lg:px-10">
        <div className="mb-12 flex items-end justify-between">
          <div>
            <p
              className="mb-2 text-eyebrow uppercase"
              style={{ color: "var(--color-content-tertiary)" }}
            >
              {eyebrow}
            </p>
            <h2
              className="text-heading font-bold uppercase lg:text-heading-desktop"
              style={{ color: "var(--color-content-inverse)" }}
            >
              {heading}
            </h2>
          </div>
          {link({
            href: "/shop",
            className:
              "hidden text-body uppercase transition-opacity duration-150 hover:opacity-60 lg:block",
            style: { color: "var(--color-content-inverse)" },
            children: seeAllLabel,
          })}
        </div>

        <FeaturedProductsClient
          items={items}
          locale={locale}
          isBusinessMode={isBusinessMode}
        />

        <div className="mt-12 text-center lg:hidden">
          {link({
            href: "/shop",
            className: "text-body uppercase",
            style: { color: "var(--color-content-inverse)" },
            children: seeAllLabel,
          })}
        </div>
      </div>
    </section>
  );
}
