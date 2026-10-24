"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import FadeImage from "@/components/ui/FadeImage";
import type { AboutView } from "@/lib/utils/about-view";
import AboutIcon from "@/components/pages/AboutIcon";
import type { AboutLocale } from "@/lib/settings/about-page";

const ink = "var(--primitive-black)";
const red = "var(--color-action-primary)";
const muted = "var(--color-content-tertiary)";
const hairline = "var(--color-shop-divider)";
const paper = "var(--color-auth-input-bg)";
const stone = "var(--color-auth-form-bg)";
const bodyText = "var(--color-auth-label-text)";

const container = "mx-auto px-6 lg:px-24";
const containerStyle: CSSProperties = { maxWidth: "1280px" };
const FIGURE_COLUMNS: Record<number, string> = {
  1: "grid-cols-2 lg:grid-cols-1",
  2: "grid-cols-2 lg:grid-cols-2",
  3: "grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
};

const twoColumn = "grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center lg:gap-16";

export type AboutSectionsLabels = {
  visitEyebrow: string;
  visitTitle: string;
  close: string;
  previous: string;
  next: string;
  photoLabel: string;
};

function eyebrow(color: string, isAr: boolean): CSSProperties {
  return {
    fontSize: "12px",
    fontWeight: 600,
    letterSpacing: isAr ? 0 : "0.18em",
    textTransform: "uppercase",
    color,
  };
}

const chapterHeading: CSSProperties = {
  fontWeight: 600,
  lineHeight: 1.15,
  letterSpacing: "-0.015em",
  color: ink,
};

function Paragraphs({ items }: { items: string[] }) {
  return (
    <>
      {items.map((text, i) => (
        <p
          key={i}
          style={{
            fontSize: "17px",
            lineHeight: 1.7,
            color: bodyText,
            marginTop: i === 0 ? 0 : "16px",
          }}
        >
          {text}
        </p>
      ))}
    </>
  );
}

function HeadingBlock({
  eyebrowText,
  heading,
  isAr,
}: {
  eyebrowText: string;
  heading: string;
  isAr: boolean;
}) {
  return (
    <>
      <p style={eyebrow(red, isAr)}>{eyebrowText}</p>
      <h2
        className="text-[26px] lg:text-[32px]"
        style={{ ...chapterHeading, marginTop: "8px" }}
      >
        {heading}
      </h2>
      <div
        aria-hidden="true"
        style={{ width: "32px", height: "2px", background: red, marginTop: "16px" }}
      />
    </>
  );
}

function Band({
  background,
  borderTop = false,
  children,
}: {
  background: string;
  borderTop?: boolean;
  children: ReactNode;
}) {
  return (
    <section style={{ background, borderTop: borderTop ? `1px solid ${hairline}` : undefined }}>
      <div className={`${container} py-14 lg:py-24`} style={containerStyle}>
        {children}
      </div>
    </section>
  );
}

function PhotoFrame({ url, className }: { url: string; className?: string }) {
  return (
    <div className={`relative w-full aspect-[4/3] overflow-hidden${className ? ` ${className}` : ""}`}>
      <FadeImage
        tone="dark"
        src={url}
        alt=""
        fill
        sizes="(min-width: 1024px) 560px, 100vw"
        className="object-cover"
      />
    </div>
  );
}

function EmptyPhoto({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`relative w-full aspect-[4/3] overflow-hidden${className ? ` ${className}` : ""}`}
      style={{ background: ink }}
    >
      <span className="img-fallback img-fallback--dark">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.2" />
          <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </div>
  );
}

function Row({
  photoUrl,
  photoFirst = false,
  children,
}: {
  photoUrl: string | null;
  photoFirst?: boolean;
  children: ReactNode;
}) {
  const order = photoFirst ? "lg:order-first" : undefined;
  return (
    <div className={twoColumn}>
      <div>{children}</div>
      {photoUrl ? (
        <PhotoFrame url={photoUrl} className={order} />
      ) : (
        <EmptyPhoto className={order} />
      )}
    </div>
  );
}

function Chevron({ direction, flip }: { direction: "left" | "right"; flip: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
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

function circle(size: number): CSSProperties {
  return {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: "9999px",
    backgroundColor: "rgba(255,255,255,0.12)",
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    padding: 0,
  };
}

function AlbumViewer({
  album,
  startIndex,
  locale,
  labels,
  onClose,
}: {
  album: { url: string; caption: string }[];
  startIndex: number;
  locale: AboutLocale;
  labels: AboutSectionsLabels;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const closeRef = useRef<HTMLButtonElement>(null);
  const count = album.length;
  const flip = locale === "ar";

  const go = useCallback(
    (delta: number) => setIndex((i) => (i + delta + count) % count),
    [count],
  );

  useEffect(() => {
    const step = flip ? -1 : 1;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else if (e.key === "ArrowRight") {
        go(step);
      } else if (e.key === "ArrowLeft") {
        go(-step);
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [flip, go, onClose]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const current = album[index];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={current?.caption || labels.close}
      lang={locale}
      dir={flip ? "rtl" : "ltr"}
      className="fixed inset-0 flex flex-col"
      style={{ backgroundColor: ink, zIndex: "var(--z-modal)" }}
    >
      <div className="flex items-center justify-between" style={{ padding: "1rem" }}>
        <span dir="ltr" className="text-body-sm" style={{ color: "white" }}>
          {index + 1} / {count}
        </span>
        <button
          ref={closeRef}
          type="button"
          aria-label={labels.close}
          onClick={onClose}
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

      <div className="flex-1 relative">
        <div style={{ position: "absolute", inset: "1rem 4rem" }}>
          <FadeImage
            src={current?.url ?? ""}
            alt={current?.caption ?? ""}
            fill
            className="object-contain"
            sizes="90vw"
            fade={false}
            tone="dark"
            draggable={false}
          />
        </div>
        {count > 1 && (
          <>
            <button
              type="button"
              aria-label={labels.previous}
              onClick={() => go(-1)}
              style={{
                ...circle(44),
                position: "absolute",
                top: "50%",
                transform: "translateY(-50%)",
                insetInlineStart: "0.75rem",
              }}
            >
              <Chevron direction="left" flip={flip} />
            </button>
            <button
              type="button"
              aria-label={labels.next}
              onClick={() => go(1)}
              style={{
                ...circle(44),
                position: "absolute",
                top: "50%",
                transform: "translateY(-50%)",
                insetInlineEnd: "0.75rem",
              }}
            >
              <Chevron direction="right" flip={flip} />
            </button>
          </>
        )}
      </div>

      {current?.caption && (
        <p
          className="text-body-sm"
          style={{ color: "white", textAlign: "center", padding: "1rem 4rem 1.5rem" }}
        >
          {current.caption}
        </p>
      )}
    </div>
  );
}

export default function AboutSectionsView({
  view,
  locale,
  labels,
  visitSlot,
  contactSlot,
}: {
  view: AboutView;
  locale: AboutLocale;
  labels: AboutSectionsLabels;
  visitSlot?: ReactNode;
  contactSlot?: ReactNode;
}) {
  const isAr = locale === "ar";
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  function openViewer(index: number) {
    returnFocus.current = document.activeElement as HTMLElement | null;
    setViewerIndex(index);
  }

  const closeViewer = useCallback(() => {
    setViewerIndex(null);
    returnFocus.current?.focus();
  }, []);

  const { story, figures, mission, team } = view;

  return (
    <div lang={locale} dir={isAr ? "rtl" : "ltr"}>
      <Band background={paper}>
        <Row photoUrl={story.photoUrl}>
          <HeadingBlock eyebrowText={story.eyebrow} heading={story.heading} isAr={isAr} />
          <div style={{ marginTop: "24px" }}>
            <Paragraphs items={story.paragraphs} />
          </div>
        </Row>
      </Band>

      {figures && (
        <section
          style={{
            background: stone,
            borderTop: `1px solid ${hairline}`,
            borderBottom: `1px solid ${hairline}`,
          }}
        >
          <div className={container} style={containerStyle}>
            <div
              className={["grid gap-px", FIGURE_COLUMNS[figures.length] ?? FIGURE_COLUMNS[4]].join(" ")}
              style={{ background: hairline }}
            >
              {figures.map((figure, i) => {
                const spansRow = figures.length % 2 === 1 && i === figures.length - 1;
                const classes = [
                  "flex flex-col items-center text-center gap-2 px-4 py-8 lg:py-10",
                  spansRow ? "col-span-2 lg:col-span-1" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <div key={i} className={classes} style={{ background: stone }}>
                    <span style={{ color: ink, display: "flex" }}>
                      <AboutIcon name={figure.icon} size={24} />
                    </span>
                    <p
                      className="text-[32px] lg:text-[36px]"
                      style={{ fontWeight: 600, lineHeight: 1.1, color: ink }}
                    >
                      <span dir="ltr" style={{ display: "inline-block" }}>
                        {figure.value}
                      </span>
                    </p>
                    <p style={{ fontSize: "14px", color: muted }}>{figure.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {mission && (
        <Band background={paper}>
          <Row photoUrl={mission.photoUrl} photoFirst>
            <HeadingBlock eyebrowText={mission.eyebrow} heading={mission.heading} isAr={isAr} />
            <div style={{ marginTop: "24px" }}>
              <Paragraphs items={[mission.text]} />
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3" style={{ marginTop: "28px" }}>
              {mission.points.map((point, i) => (
                <div key={i}>
                  <span style={{ color: red, display: "flex" }}>
                    <AboutIcon name={point.icon} size={22} />
                  </span>
                  <p style={{ fontSize: "15px", fontWeight: 600, color: ink, marginTop: "10px" }}>
                    {point.title}
                  </p>
                  <p
                    style={{
                      fontSize: "14px",
                      lineHeight: 1.55,
                      color: muted,
                      marginTop: "4px",
                    }}
                  >
                    {point.line}
                  </p>
                </div>
              ))}
            </div>
          </Row>
        </Band>
      )}

      {team && (
        <Band background={stone} borderTop>
          <Row photoUrl={team.photoUrl}>
            <HeadingBlock eyebrowText={team.eyebrow} heading={team.heading} isAr={isAr} />
            <div style={{ marginTop: "24px" }}>
              <Paragraphs items={team.paragraphs} />
            </div>
            {contactSlot && <div style={{ marginTop: "28px" }}>{contactSlot}</div>}
          </Row>
          {team.album.length > 0 && (
            <div className="grid grid-cols-3 gap-2 lg:grid-cols-6" style={{ marginTop: "40px" }}>
              {team.album.map((item, i) => (
                <div key={i}>
                  <button
                    type="button"
                    aria-label={item.caption || `${labels.photoLabel} ${i + 1}`}
                    onClick={() => openViewer(i)}
                    className="relative block w-full aspect-square overflow-hidden cursor-pointer"
                    style={{ background: ink, border: "none", padding: 0 }}
                  >
                    <FadeImage
                      tone="dark"
                      src={item.url}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 16vw, 33vw"
                      className="object-cover"
                    />
                  </button>
                  {item.caption && (
                    <p style={{ fontSize: "12px", color: muted, marginTop: "8px" }}>
                      {item.caption}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Band>
      )}

      {view.visit && visitSlot && (
        <Band background={paper}>
          <HeadingBlock eyebrowText={labels.visitEyebrow} heading={labels.visitTitle} isAr={isAr} />
          <div style={{ marginTop: "32px" }}>{visitSlot}</div>
        </Band>
      )}

      {mounted &&
        team &&
        viewerIndex !== null &&
        createPortal(
          <AlbumViewer
            album={team.album}
            startIndex={viewerIndex}
            locale={locale}
            labels={labels}
            onClose={closeViewer}
          />,
          document.body,
        )}
    </div>
  );
}
