import { Fragment } from "react";
import Image from "next/image";
import { isPreviewSrc } from "@/lib/utils/images";
import type { LinkSlot } from "./link-slot";

interface CollectionTile {
  eyebrow: string;
  title: string;
  href: string;
  photoUrl: string;
}

interface CollectionTilesViewProps {
  tiles: CollectionTile[];
  shopNowLabel: string;
  link: LinkSlot;
}

export default function CollectionTilesView({
  tiles,
  shopNowLabel,
  link,
}: CollectionTilesViewProps) {
  return (
    <section
      className="w-full"
      style={{ backgroundColor: "var(--color-surface-base)" }}
      aria-label="Shop by collection"
    >
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        style={{ minHeight: "520px" }}
      >
        {tiles.map((tile, index) => (
          <Fragment key={index}>
            {link({
              href: tile.href,
              className: "group relative overflow-hidden",
              style: { minHeight: "420px" },
              children: (
                <>
                  <div
                    className="absolute inset-0 transition-transform duration-700 group-hover:scale-[1.04]"
                    style={{ backgroundColor: "var(--primitive-black)" }}
                  >
                    <Image
                      src={tile.photoUrl}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover"
                      style={{ objectPosition: "center" }}
                      unoptimized={isPreviewSrc(tile.photoUrl)}
                    />
                  </div>

                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.3) 100%)",
                    }}
                  />

                  {index < tiles.length - 1 && (
                    <div
                      className="absolute top-0 end-0 bottom-0 w-px hidden lg:block"
                      style={{
                        backgroundColor: "var(--color-border-default)",
                      }}
                    />
                  )}

                  <div className="absolute bottom-0 start-0 end-0 p-8 lg:p-10">
                    <p
                      className="mb-2 text-eyebrow uppercase"
                      style={{ color: "var(--color-content-secondary)" }}
                    >
                      {tile.eyebrow}
                    </p>
                    <h3
                      className="mb-5 text-heading font-bold uppercase lg:text-heading-desktop"
                      style={{ color: "var(--color-content-primary)" }}
                    >
                      {tile.title}
                    </h3>
                    <span
                      className="inline-flex items-center gap-2 text-body uppercase font-medium"
                      style={{
                        color: "var(--color-content-primary)",
                        borderBottom: "1px solid currentColor",
                      }}
                    >
                      {shopNowLabel}
                      <span aria-hidden="true" className="inline-block flip-rtl">→</span>
                    </span>
                  </div>
                </>
              ),
            })}
          </Fragment>
        ))}
      </div>
    </section>
  );
}
