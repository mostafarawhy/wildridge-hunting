"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import FadeImage from "@/components/ui/FadeImage";
import { useZoom } from "@/hooks/useZoom";

interface ZoomableImageProps {
  src: string;
  alt: string;
  sizes?: string;
  className?: string;
  containerStyle?: React.CSSProperties;
}

export default function ZoomableImage({
  src,
  alt,
  sizes = "(max-width: 1024px) 100vw, 55vw",
  className,
  containerStyle,
}: ZoomableImageProps) {
  const t = useTranslations("shop");
  const containerRef = useRef<HTMLDivElement>(null);
  const { scale, offset, isZoomed, isDragging, resetZoom, handlers } = useZoom({
    containerRef,
  });

  return (
    <div
      ref={containerRef}
      {...handlers}
      className={className}
      style={{
        position: "relative",
        overflow: "hidden",
        cursor: isZoomed ? (isDragging ? "grabbing" : "grab") : "zoom-in",
        touchAction: "none",
        userSelect: "none",
        ...containerStyle,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`,
          transformOrigin: "center center",
          transition: isDragging ? "none" : "transform 0.15s ease-out",
          position: "relative",
        }}
      >
        <FadeImage
          src={src}
          alt={alt}
          fill
          className="object-contain p-8"
          sizes={sizes}
          priority
          draggable={false}
          fade={false}
        />
      </div>

      {!isZoomed ? (
        <div
          className="absolute bottom-3 text-xs pointer-events-none"
          style={{
            insetInlineEnd: "0.75rem",
            color: "var(--color-text-secondary, #888)",
            backgroundColor: "rgba(255,255,255,0.85)",
            padding: "4px 8px",
            borderRadius: "4px",
            backdropFilter: "blur(4px)",
          }}
        >
          {t("zoom_hint")}
        </div>
      ) : (
        <button
          type="button"
          onClick={resetZoom}
          className="absolute bottom-3 text-xs"
          style={{
            insetInlineEnd: "0.75rem",
            color: "var(--color-text-secondary, #888)",
            backgroundColor: "rgba(255,255,255,0.9)",
            border: "1px solid var(--color-shop-divider)",
            padding: "4px 8px",
            borderRadius: "4px",
            cursor: "pointer",
            backdropFilter: "blur(4px)",
          }}
        >
          {t("zoom_reset")}
        </button>
      )}
    </div>
  );
}
