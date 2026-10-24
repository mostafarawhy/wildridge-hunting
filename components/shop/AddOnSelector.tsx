"use client";

import {
  Fragment,
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import FadeImage from "@/components/ui/FadeImage";
import { Link } from "@/i18n/navigation";
import { getImageUrl } from "@/lib/utils/images";
import { formatAED } from "@/lib/utils/currency";

export interface AddOn {
  id: string;
  slugEn: string;
  categorySlug: string;
  brand: string;
  name: string;
  nameAr: string;
  nameRu: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  descriptionRu: string | null;
  price: number;
  compareAtPrice: number | null;
  stockQuantity: number;
  lowStockThreshold: number;
  storageKey: string | null;
}

interface AddOnSelectorProps {
  addons: AddOn[];
  locale: string;
  qty?: number;
  onSelectionChange?: (selectedIds: string[]) => void;
  hidePrices?: boolean;
  enforceQuantity?: boolean;
  compact?: boolean;
}

interface PreviewState {
  id: string;
}

const OPEN_DELAY_MS = 120;
const CLOSE_DELAY_MS = 150;

function PhotoPlaceholder({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ color: "var(--color-content-tertiary)" }}
    >
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M21 15l-5-5L5 21"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function AddOnSelector({
  addons,
  locale,
  qty = 1,
  onSelectionChange,
  hidePrices = false,
  enforceQuantity = false,
  compact = false,
}: AddOnSelectorProps) {
  const t = useTranslations("shop");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef(new Map<string, HTMLButtonElement>());
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerTypeRef = useRef("");

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const requiredQty = enforceQuantity ? qty : 1;
  const isAvailable = (addon: AddOn) => addon.stockQuantity >= requiredQty;
  const stockState = (addon: AddOn): "out" | "short" | "low" | "ok" => {
    if (addon.stockQuantity <= 0) return "out";
    if (addon.stockQuantity < requiredQty) return "short";
    if (addon.stockQuantity <= addon.lowStockThreshold) return "low";
    return "ok";
  };

  const effectiveIds = addons
    .filter((a) => selected.has(a.id) && isAvailable(a))
    .map((a) => a.id);
  const effectiveKey = effectiveIds.join(",");

  useEffect(() => {
    onSelectionChange?.(effectiveKey ? effectiveKey.split(",") : []);
  }, [effectiveKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!preview && sheetId === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      if (sheetId !== null) setSheetId(null);
      else setPreview(null);
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [preview, sheetId]);

  useLayoutEffect(() => {
    if (!preview) return;
    const card = cardRef.current;
    const tile = tileRefs.current.get(preview.id);
    if (!card || !tile) return;
    const rect = tile.getBoundingClientRect();
    const width = compact ? 300 : 320;
    const h = card.offsetHeight;
    const above = rect.top - h - 8;
    const rawTop = above >= 16 ? above : rect.bottom + 8;
    const top = Math.max(16, Math.min(rawTop, window.innerHeight - h - 16));
    const rawLeft = rect.left + rect.width / 2 - width / 2;
    const left = Math.max(16, Math.min(rawLeft, window.innerWidth - width - 16));
    card.style.top = `${top}px`;
    card.style.left = `${left}px`;
    card.style.visibility = "visible";
  }, [preview?.id, compact]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!preview) return;
    function close() {
      setPreview(null);
    }
    window.addEventListener("scroll", close, { capture: true });
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, [preview]);

  useEffect(() => {
    const open = openTimer;
    const close = closeTimer;
    return () => {
      if (open.current) clearTimeout(open.current);
      if (close.current) clearTimeout(close.current);
    };
  }, []);

  function getAddonName(addon: AddOn): string {
    if (locale === "ar") return addon.nameAr;
    if (locale === "ru") return addon.nameRu;
    return addon.name;
  }

  function getAddonDescription(
    addon: AddOn,
  ): { text: string; fallback: boolean } | null {
    const localized =
      locale === "ar"
        ? addon.descriptionAr
        : locale === "ru"
          ? addon.descriptionRu
          : addon.descriptionEn;
    if (localized) return { text: localized, fallback: false };
    if (locale !== "ar" && locale !== "ru") return null;
    if (addon.descriptionEn) return { text: addon.descriptionEn, fallback: true };
    return null;
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearTimers() {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  }

  function openPreview(id: string) {
    if (!tileRefs.current.get(id)) return;
    setPreview({ id });
  }

  function scheduleOpen(id: string) {
    clearTimers();
    openTimer.current = setTimeout(() => openPreview(id), OPEN_DELAY_MS);
  }

  function scheduleClose() {
    if (openTimer.current) clearTimeout(openTimer.current);
    openTimer.current = null;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setPreview(null), CLOSE_DELAY_MS);
  }

  function cancelClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }

  function handleTileClick(addon: AddOn) {
    const wasTouch = pointerTypeRef.current === "touch";
    pointerTypeRef.current = "";
    if (wasTouch) {
      clearTimers();
      setPreview(null);
      setSheetId(addon.id);
      return;
    }
    if (!isAvailable(addon)) return;
    toggle(addon.id);
  }

  if (addons.length === 0) return null;

  const limit = compact ? 4 : 8;
  const visible = expanded ? addons : addons.slice(0, limit);
  const hiddenCount = addons.length - limit;
  const previewAddon = preview
    ? visible.find((a) => a.id === preview.id)
    : undefined;
  const sheetAddon =
    sheetId !== null ? addons.find((a) => a.id === sheetId) : undefined;

  function renderDetail(addon: AddOn, onAction: () => void): ReactNode {
    const name = getAddonName(addon);
    const description = getAddonDescription(addon);
    const unavailable = !isAvailable(addon);
    const state = stockState(addon);
    const isSelected = selected.has(addon.id) && !unavailable;
    const showCompare =
      addon.compareAtPrice !== null && addon.compareAtPrice > addon.price;

    return (
      <>
        <div
          className="relative w-full"
          style={{
            aspectRatio: "4 / 3",
            backgroundColor: "var(--color-shop-bg)",
          }}
        >
          {addon.storageKey ? (
            <FadeImage
              src={getImageUrl(addon.storageKey)}
              alt={name}
              fill
              className="object-contain p-4"
              sizes="280px"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <PhotoPlaceholder size={40} />
            </div>
          )}
        </div>

        <div className="flex flex-col" style={{ padding: "1rem", gap: "0.5rem" }}>
          <p
            className="text-eyebrow tracking-widest uppercase"
            style={{ color: "var(--color-action-primary)" }}
          >
            {t("addon_eyebrow")}
          </p>
          <p
            className="text-body"
            style={{
              color: "var(--primitive-black)",
              fontWeight: "var(--font-semibold)",
            }}
          >
            {name}
          </p>
          <Link
            href={`/shop/${addon.categorySlug}/${addon.slugEn}`}
            className="text-body-sm underline self-start"
            style={{ color: "var(--primitive-black)" }}
          >
            {t("addon_view_product")}
          </Link>
          {description && (
            <p
              className="text-body-sm"
              style={{
                color: "var(--color-content-tertiary)",
                display: "-webkit-box",
                WebkitLineClamp: 4,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
              {...(description.fallback ? { lang: "en", dir: "ltr" } : {})}
            >
              {description.text}
            </p>
          )}

          <div className="flex items-baseline gap-2">
            {!hidePrices && (
              <>
                <span
                  className="text-body"
                  style={{
                    color: "var(--primitive-black)",
                    fontWeight: "var(--font-medium)",
                  }}
                >
                  + {formatAED(addon.price)}
                </span>
                {showCompare && (
                  <span
                    className="text-body-sm"
                    style={{
                      color: "var(--color-content-tertiary)",
                      textDecoration: "line-through",
                    }}
                  >
                    {formatAED(addon.compareAtPrice as number)}
                  </span>
                )}
              </>
            )}
            {(state === "ok" || state === "low") && (
              <span
                className="text-body-sm ms-auto"
                style={{
                  color:
                    state === "ok"
                      ? "var(--color-status-success-text)"
                      : "var(--color-status-warning)",
                }}
              >
                {state === "ok"
                  ? t("stock_status.in_stock")
                  : t("stock_status.low_stock")}
              </span>
            )}
          </div>

          <button
            type="button"
            disabled={unavailable}
            onClick={onAction}
            className="w-full flex items-center justify-center text-label cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              height: "40px",
              borderRadius: "var(--radius-sm)",
              fontWeight: "var(--font-semibold)",
              backgroundColor: isSelected
                ? "var(--primitive-black)"
                : "var(--color-action-primary)",
              color: "white",
              border: `1px solid ${isSelected ? "var(--primitive-black)" : "var(--color-action-primary)"}`,
            }}
          >
            {unavailable
              ? state === "short"
                ? t("stock_status.not_enough_for_qty")
                : t("stock_status.out_of_stock")
              : isSelected
                ? t("addon_remove")
                : t("addon_add")}
          </button>
        </div>
      </>
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
        <p
          className="text-eyebrow tracking-widest uppercase"
          style={{ color: "var(--color-content-tertiary)" }}
        >
          {t("addons_label")}
        </p>
        <p
          className="text-xs"
          style={{ color: "var(--color-content-tertiary)" }}
        >
          {t("addons_hint")}
        </p>
      </div>

      <div className="mb-4">
        <div className="flex flex-wrap gap-3">
          {visible.map((addon) => {
            const unavailable = !isAvailable(addon);
            const state = stockState(addon);
            const isSelected = selected.has(addon.id) && !unavailable;
            const name = getAddonName(addon);

            return (
              <div
                key={addon.id}
                className="flex flex-col gap-1 min-w-0"
                style={{ width: compact ? "72px" : "84px" }}
              >
                <button
                  ref={(el) => {
                    if (el) tileRefs.current.set(addon.id, el);
                    else tileRefs.current.delete(addon.id);
                  }}
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={name}
                  aria-disabled={unavailable}
                  onPointerDown={(e) => {
                    pointerTypeRef.current = e.pointerType;
                  }}
                  onPointerEnter={(e) => {
                    if (e.pointerType === "touch") return;
                    scheduleOpen(addon.id);
                  }}
                  onPointerLeave={(e) => {
                    if (e.pointerType === "touch") return;
                    scheduleClose();
                  }}
                  onFocus={() => {
                    if (pointerTypeRef.current === "touch") return;
                    clearTimers();
                    openPreview(addon.id);
                  }}
                  onBlur={(e) => {
                    const next = e.relatedTarget as Node | null;
                    if (next && cardRef.current?.contains(next)) return;
                    scheduleClose();
                  }}
                  onClick={() => handleTileClick(addon)}
                  className={`relative w-full transition-colors ${unavailable ? "cursor-not-allowed" : "cursor-pointer"} ${
                    isSelected
                      ? "border-[color:var(--color-action-primary)]"
                      : unavailable
                        ? "border-[color:var(--color-shop-divider)]"
                        : "border-[color:var(--color-shop-divider)] hover:border-[color:var(--primitive-black)]"
                  }`}
                  style={{
                    aspectRatio: "1 / 1",
                    backgroundColor: "var(--color-auth-form-bg)",
                    borderRadius: "var(--radius-sm)",
                    borderStyle: "solid",
                    borderWidth: isSelected ? "2px" : "1px",
                    opacity: unavailable ? 0.4 : 1,
                    padding: 0,
                  }}
                >
                  <span
                    className="absolute inset-0 overflow-hidden"
                    style={{ borderRadius: "inherit" }}
                  >
                    {addon.storageKey ? (
                      <FadeImage
                        src={getImageUrl(addon.storageKey)}
                        alt=""
                        fill
                        className="object-contain p-1"
                        sizes="84px"
                      />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <PhotoPlaceholder size={24} />
                      </span>
                    )}
                  </span>
                  {isSelected && (
                    <span
                      className="absolute flex items-center justify-center"
                      style={{
                        top: "-6px",
                        insetInlineEnd: "-6px",
                        width: "16px",
                        height: "16px",
                        borderRadius: "50%",
                        backgroundColor: "var(--color-action-primary)",
                      }}
                    >
                      <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                        <path
                          d="M1.5 4.5L3.5 6.5L7.5 2.5"
                          stroke="white"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  )}
                </button>
                <span
                  className="text-xs"
                  style={{
                    color: "var(--primitive-black)",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    lineHeight: 1.35,
                    width: "100%",
                  }}
                >
                  {name}
                </span>
                {(unavailable || !hidePrices) && (
                  <span
                    className="text-xs"
                    style={
                      unavailable
                        ? {
                            color: "var(--color-content-tertiary)",
                            whiteSpace: "normal",
                            overflowWrap: "break-word",
                            lineHeight: 1.35,
                            display: "block",
                            width: "100%",
                          }
                        : {
                            color: "var(--color-content-tertiary)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            display: "block",
                            width: "100%",
                          }
                    }
                  >
                    {unavailable
                      ? state === "short"
                        ? t("stock_status.not_enough_for_qty")
                        : t("stock_status.out_of_stock")
                      : `+ ${formatAED(addon.price)}`}
                  </span>
                )}
                {state === "low" && (
                  <span
                    className="text-xs"
                    style={{
                      color: "var(--color-status-warning)",
                      display: "block",
                      width: "100%",
                    }}
                  >
                    {t("stock_status.low_stock")}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {addons.length > limit && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-body-sm underline cursor-pointer mt-3"
            style={{ color: "var(--color-content-tertiary)" }}
          >
            {expanded
              ? t("addons_show_less")
              : t("addons_show_more", { count: hiddenCount })}
          </button>
        )}
      </div>

      {mounted &&
        preview &&
        previewAddon &&
        createPortal(
          <div
            ref={cardRef}
            role="region"
            aria-label={getAddonName(previewAddon)}
            onPointerEnter={cancelClose}
            onPointerLeave={scheduleClose}
            onBlur={(e) => {
              const next = e.relatedTarget as Node | null;
              if (next && cardRef.current?.contains(next)) return;
              if (next && tileRefs.current.get(previewAddon.id) === next) return;
              scheduleClose();
            }}
            style={{
              position: "fixed",
              visibility: "hidden",
              width: compact ? "300px" : "320px",
              zIndex: "var(--z-tooltip)",
              backgroundColor: "var(--color-auth-input-bg)",
              border: "1px solid var(--color-auth-input-border)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-md)",
              padding: 0,
              overflow: "hidden",
            }}
          >
            <Fragment key={previewAddon.id}>
              {renderDetail(previewAddon, () => toggle(previewAddon.id))}
            </Fragment>
          </div>,
          document.body,
        )}

      {mounted &&
        sheetAddon &&
        createPortal(
          <div
            className="fixed inset-0"
            style={{
              backgroundColor: "rgba(0,0,0,0.45)",
              zIndex: "calc(var(--z-modal) + 1)",
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setSheetId(null);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={getAddonName(sheetAddon)}
              style={{
                position: "fixed",
                bottom: 0,
                insetInline: 0,
                maxHeight: "85vh",
                overflow: "auto",
                borderTopLeftRadius: "var(--radius-md)",
                borderTopRightRadius: "var(--radius-md)",
                backgroundColor: "var(--color-auth-input-bg)",
                padding: "1rem 1rem calc(1rem + env(safe-area-inset-bottom))",
              }}
            >
              <div
                style={{
                  width: "32px",
                  height: "4px",
                  borderRadius: "2px",
                  backgroundColor: "var(--color-auth-input-border)",
                  margin: "0 auto 0.75rem",
                }}
              />
              <Fragment key={sheetAddon.id}>
                {renderDetail(sheetAddon, () => {
                  toggle(sheetAddon.id);
                  setSheetId(null);
                })}
              </Fragment>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
