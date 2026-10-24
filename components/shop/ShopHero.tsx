import Image from "next/image";
import type { ReactNode } from "react";
import { focalPosition, type FocalPoint } from "@/lib/utils/focal-point";

interface ShopHeroProps {
  imageSrc: string;
  focus?: FocalPoint;
  children: ReactNode;
}

export default function ShopHero({ imageSrc, focus, children }: ShopHeroProps) {
  return (
    <div
      className="relative flex flex-col items-center justify-center py-12 px-6 overflow-hidden"
      style={{
        backgroundColor: "var(--color-surface-sunken)",
        borderBottom: "1px solid var(--color-border-default)",
        minHeight: "350px",
      }}
    >
      <Image
        src={imageSrc}
        alt="shop-hero"
        fill
        className="object-cover"
        style={{ opacity: 1, objectPosition: focalPosition(focus ?? { x: 50, y: 70 }) }}
        priority
        aria-hidden="true"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.25) 100%)",
        }}
      />
      <div className="relative flex flex-col items-center gap-5">{children}</div>
    </div>
  );
}
