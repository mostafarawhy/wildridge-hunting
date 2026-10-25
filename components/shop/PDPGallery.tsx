"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import FadeImage from "@/components/ui/FadeImage";
import ZoomableImage from "@/components/shop/pdp/ZoomableImage";

interface GalleryImage {
  src: string;
  alt: string;
}

interface PDPGalleryProps {
  images: GalleryImage[];
  productName: string;
  variant?: "page" | "modal";
}

const NAV_BUTTON_STYLE: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  transform: "translateY(-50%)",
  zIndex: 1,
  width: "36px",
  height: "36px",
  borderRadius: "9999px",
  backgroundColor: "var(--primitive-white)",
  border: "1px solid var(--color-shop-divider)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  padding: 0,
};

function Chevron({
  direction,
  flip,
  color = "var(--primitive-black)",
}: {
  direction: "left" | "right";
  flip: boolean;
  color?: string;
}) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      <polyline points={direction === "left" ? "15 18 9 12 15 6" : "9 18 15 12 9 6"} />
    </svg>
  );
}

const VIEWER_BUTTON_BG = "rgba(255,255,255,0.12)";

function GalleryViewer({
  images,
  productName,
  startIndex,
  flip,
  onClose,
}: {
  images: GalleryImage[];
  productName: string;
  startIndex: number;
  flip: boolean;
  onClose: (index: number) => void;
}) {
  const t = useTranslations("shop");
  const [index, setIndex] = useState(startIndex);
  const indexRef = useRef(startIndex);
  const closeRef = useRef<HTMLButtonElement>(null);
  const swipeStartX = useRef<number | null>(null);
  const count = images.length;

  function go(delta: number) {
    const next = (indexRef.current + delta + count) % count;
    indexRef.current = next;
    setIndex(next);
  }

  function jump(next: number) {
    indexRef.current = next;
    setIndex(next);
  }

  useEffect(() => {
    const step = flip ? -1 : 1;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose(indexRef.current);
      } else if (e.key === "ArrowRight") {
        go(step);
      } else if (e.key === "ArrowLeft") {
        go(-step);
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  });

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    swipeStartX.current = e.clientX;
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const start = swipeStartX.current;
    swipeStartX.current = null;
    if (start === null) return;
    const dx = e.clientX - start;
    if (Math.abs(dx) <= 50) return;
    const next = dx < 0;
    go(next !== flip ? 1 : -1);
  }

  const circle = (size: number): React.CSSProperties => ({
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: "9999px",
    backgroundColor: VIEWER_BUTTON_BG,
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    padding: 0,
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={productName}
      className="fixed inset-0 flex flex-col"
      style={{
        backgroundColor: "rgba(11,11,11,0.96)",
        zIndex: "var(--z-modal)",
      }}
    >
      <div
        className="flex items-center justify-between"
        style={{ padding: "1rem" }}
      >
        <span dir="ltr" className="text-body-sm" style={{ color: "white" }}>
          {index + 1} / {count}
        </span>
        <button
          ref={closeRef}
          type="button"
          aria-label={t("close")}
          onClick={() => onClose(indexRef.current)}
          style={circle(40)}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="white"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M3 3L13 13M13 3L3 13" />
          </svg>
        </button>
      </div>

      <div
        className="flex-1 relative"
        style={{ touchAction: "pan-y" }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <div style={{ position: "absolute", inset: "1rem 4rem" }}>
          <FadeImage
            src={images[index]?.src ?? ""}
            alt={images[index]?.alt ?? productName}
            fill
            className="object-contain"
            sizes="calc(100vw - 8rem)"
            fade={false}
            tone="dark"
            draggable={false}
          />
        </div>
        {count > 1 && (
          <>
            <button
              type="button"
              aria-label={t("gallery_prev")}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => go(-1)}
              style={{
                ...circle(44),
                position: "absolute",
                top: "50%",
                transform: "translateY(-50%)",
                insetInlineStart: "0.75rem",
              }}
            >
              <Chevron direction="left" flip={flip} color="white" />
            </button>
            <button
              type="button"
              aria-label={t("gallery_next")}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => go(1)}
              style={{
                ...circle(44),
                position: "absolute",
                top: "50%",
                transform: "translateY(-50%)",
                insetInlineEnd: "0.75rem",
              }}
            >
              <Chevron direction="right" flip={flip} color="white" />
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <div
          className="flex flex-row gap-2 overflow-x-auto"
          style={{ padding: "1rem", justifyContent: "safe center" }}
        >
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => jump(i)}
              aria-label={`${t("gallery_thumb")} ${i + 1}`}
              aria-current={i === index}
              className="flex-shrink-0 cursor-pointer"
              style={{
                width: "56px",
                height: "56px",
                position: "relative",
                padding: "4px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "transparent",
                border:
                  i === index
                    ? "2px solid white"
                    : "1px solid rgba(255,255,255,0.3)",
              }}
            >
              <FadeImage
                src={img.src}
                alt={img.alt}
                fill
                className="object-contain p-1"
                sizes="56px"
                tone="dark"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PDPGallery({
  images,
  productName,
  variant = "page",
}: PDPGalleryProps) {
  const t = useTranslations("shop");
  const locale = useLocale();
  const [active, setActive] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const expandRef = useRef<HTMLButtonElement>(null);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const flip = locale === "ar";
  const hasMany = images.length > 1;
  const isModal = variant === "modal";
  const thumbSize = isModal ? 52 : 72;

  function closeViewer(index: number) {
    setActive(index);
    setViewerIndex(null);
    expandRef.current?.focus();
  }

  return (
    <div
      className={`flex flex-col gap-3${isModal ? "" : " p-6 lg:p-8"}`}
    >
      <div
        className="relative w-full"
        style={{
          aspectRatio: isModal ? "1 / 1" : "4 / 3",
          backgroundColor: "var(--primitive-white)",
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
        }}
      >
        <ZoomableImage
          key={active}
          src={images[active]?.src ?? ""}
          alt={images[active]?.alt ?? productName}
          sizes={
            isModal
              ? "(min-width: 1024px) 290px, (min-width: 928px) 783px, calc(100vw - 9rem - 1px)"
              : "(min-width: 1024px) calc(55vw - 8rem - 1px), calc(100vw - 7rem - 1px)"
          }
          containerStyle={{ position: "absolute", inset: 0 }}
        />

        {!isModal && (
          <button
            ref={expandRef}
            type="button"
            aria-label={t("gallery_open")}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setViewerIndex(active)}
            style={{
              ...NAV_BUTTON_STYLE,
              top: "0.75rem",
              transform: "none",
              insetInlineEnd: "0.75rem",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--primitive-black)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          </button>
        )}

        {hasMany && (
          <>
            <span
              dir="ltr"
              className="absolute text-xs pointer-events-none"
              style={{
                bottom: "0.75rem",
                insetInlineStart: "0.75rem",
                color: "var(--color-text-secondary, #888)",
                backgroundColor: "rgba(255,255,255,0.85)",
                padding: "4px 8px",
                borderRadius: "4px",
                backdropFilter: "blur(4px)",
              }}
            >
              {active + 1} / {images.length}
            </span>
            <button
              type="button"
              aria-label={t("gallery_prev")}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() =>
                setActive((a) => (a - 1 + images.length) % images.length)
              }
              style={{ ...NAV_BUTTON_STYLE, insetInlineStart: "0.75rem" }}
            >
              <Chevron direction="left" flip={flip} />
            </button>
            <button
              type="button"
              aria-label={t("gallery_next")}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setActive((a) => (a + 1) % images.length)}
              style={{ ...NAV_BUTTON_STYLE, insetInlineEnd: "0.75rem" }}
            >
              <Chevron direction="right" flip={flip} />
            </button>
          </>
        )}
      </div>

      {hasMany && (
        <div className="flex flex-row gap-2 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`${t("gallery_thumb")} ${i + 1}`}
              aria-current={i === active}
              className="cursor-pointer transition-all flex-shrink-0"
              style={{
                width: `${thumbSize}px`,
                height: `${thumbSize}px`,
                border: `2px solid ${
                  i === active
                    ? "var(--color-action-primary)"
                    : "var(--color-shop-divider)"
                }`,
                borderRadius: "var(--radius-sm)",
                backgroundColor: "var(--primitive-white)",
                padding: "4px",
                position: "relative",
              }}
            >
              <FadeImage
                src={img.src}
                alt={img.alt}
                fill
                className="object-contain p-1"
                sizes={`${thumbSize}px`}
              />
            </button>
          ))}
        </div>
      )}

      {mounted &&
        !isModal &&
        viewerIndex !== null &&
        createPortal(
          <GalleryViewer
            images={images}
            productName={productName}
            startIndex={viewerIndex}
            flip={flip}
            onClose={closeViewer}
          />,
          document.body,
        )}
    </div>
  );
}
