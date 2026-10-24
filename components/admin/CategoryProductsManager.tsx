"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import { useToast } from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Select from "@/components/ui/Select";
import FadeImage from "@/components/ui/FadeImage";
import PublishStatusPill from "@/components/ui/PublishStatusPill";
import CategoryProductPickerModal from "@/components/admin/CategoryProductPickerModal";
import { formatAED } from "@/lib/utils/currency";
import { getImageUrl } from "@/lib/utils/images";
import { removeProductFromCategoryAction } from "@/lib/actions/product-category";
import type {
  CategoryProductRow,
  CategoryPickerItem,
} from "@/lib/db/queries/categories";

interface Props {
  categoryId: string;
  categoryName: string;
  slug: string;
  live: boolean;
  pathLabel: string;
  subcategoryProductCount: number;
  rows: CategoryProductRow[];
  pickerItems: CategoryPickerItem[];
}

type PlacementFilter = "all" | "main" | "extra";
type StatusFilter = "" | "PUBLISHED" | "DRAFT" | "ARCHIVED";

const PAGE_SIZE = 20;

const card: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid var(--color-auth-form-border)",
  borderRadius: "var(--radius-none)",
  padding: "1.5rem",
  display: "flex",
  flexDirection: "column",
  gap: "1.25rem",
};

const eyebrow: React.CSSProperties = {
  fontSize: "var(--text-eyebrow)",
  fontWeight: "var(--font-bold)",
  letterSpacing: "var(--tracking-widest)",
  textTransform: "uppercase",
  color: "var(--color-action-primary)",
  margin: 0,
};

const heading: React.CSSProperties = {
  fontSize: "var(--text-body-lg)",
  fontWeight: "var(--font-bold)",
  color: "#0b0b0b",
  margin: 0,
};

const mutedText: React.CSSProperties = {
  fontSize: "var(--text-body-sm)",
  color: "var(--color-auth-input-placeholder)",
  margin: 0,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.625rem 0.875rem",
  fontSize: "var(--text-body)",
  color: "#0b0b0b",
  backgroundColor: "#ffffff",
  border: "1.5px solid var(--color-shop-divider)",
  borderRadius: "0",
  outline: "none",
  boxSizing: "border-box",
};

const textLink: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  fontSize: 13,
  color: "#0b0b0b",
  textDecoration: "underline",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const blackButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "2.5rem",
  paddingInline: "1.25rem",
  fontSize: "var(--text-body-sm)",
  fontWeight: "var(--font-bold)",
  letterSpacing: "var(--tracking-widest)",
  textTransform: "uppercase",
  backgroundColor: "#0b0b0b",
  color: "#ffffff",
  border: "none",
  borderRadius: "0",
  cursor: "pointer",
  flexShrink: 0,
};

const segmentButton = (active: boolean): React.CSSProperties => ({
  ...blackButton,
  height: "2.25rem",
  paddingInline: "0.875rem",
  opacity: active ? 1 : 0.35,
});

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function stockInfo(row: CategoryProductRow): { word: string; color: string } {
  const isOut = row.stockQuantity === 0;
  const isLow = !isOut && row.stockQuantity <= row.lowStockThreshold;
  return {
    word: isOut ? "Out of stock" : isLow ? "Low stock" : "In stock",
    color: isOut ? "#991b1b" : isLow ? "#854d0e" : "#166534",
  };
}

function formatAdded(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Dubai",
  });
}

function mainPath(row: CategoryProductRow): string {
  return row.mainCategory.parentNameEn
    ? `${row.mainCategory.parentNameEn} › ${row.mainCategory.nameEn}`
    : row.mainCategory.nameEn;
}

export default function CategoryProductsManager({
  categoryId,
  categoryName,
  slug,
  live,
  pathLabel,
  subcategoryProductCount,
  rows,
  pickerItems,
}: Props) {
  const router = useRouter();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [placement, setPlacement] = useState<PlacementFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("");
  const [showAll, setShowAll] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<CategoryProductRow | null>(
    null,
  );
  const [isRemoving, setIsRemoving] = useState(false);

  const total = rows.length;
  const mainCount = rows.filter((r) => r.placement === "main").length;
  const extraCount = total - mainCount;
  const publishedCount = rows.filter(
    (r) => r.publishStatus === "PUBLISHED",
  ).length;

  const needle = search.trim().toLowerCase();
  const matching = rows.filter((r) => {
    if (
      needle &&
      !r.nameEn.toLowerCase().includes(needle) &&
      !r.sku.toLowerCase().includes(needle) &&
      !r.brand.toLowerCase().includes(needle)
    ) {
      return false;
    }
    if (placement !== "all" && r.placement !== placement) return false;
    if (status && r.publishStatus !== status) return false;
    return true;
  });
  const visible = showAll ? matching : matching.slice(0, PAGE_SIZE);

  async function handleConfirmRemove() {
    if (!removeTarget) return;
    setIsRemoving(true);

    const result = await removeProductFromCategoryAction(
      categoryId,
      removeTarget.sku,
    );

    setIsRemoving(false);
    setRemoveTarget(null);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(`Removed from ${categoryName}.`);
    router.refresh();
  }

  const addButton = (
    <button
      type="button"
      onClick={() => setPickerOpen(true)}
      style={blackButton}
    >
      Add products
    </button>
  );

  return (
    <div style={{ ...card, marginTop: "1.5rem" }}>
      <style>{`
        .cpm-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 1rem; padding: 0.75rem 0; border-bottom: 1px solid var(--color-shop-divider); }
        .cpm-meta { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; justify-content: flex-end; }
        .cpm-filter { flex: 0 1 11rem; min-width: 0; }
        @media (max-width: 719px) {
          .cpm-row { grid-template-columns: minmax(0, 1fr); gap: 0.5rem; }
          .cpm-meta { justify-content: flex-start; }
          .cpm-filter { flex-basis: 100%; }
        }
      `}</style>

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
          paddingBottom: "0.875rem",
          borderBottom: "1px solid var(--color-shop-divider)",
        }}
      >
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}
        >
          <p style={eyebrow}>Products</p>
          <h2 style={heading}>
            {plural(total, "product", "products")} on this category page
          </h2>
          <p style={mutedText}>
            {mainCount} with {categoryName} as main category · {extraCount} also
            here · {publishedCount} published
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
          {live && (
            <a
              href={`/en/shop/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...textLink, fontSize: "var(--text-body-sm)" }}
            >
              View on store ↗
            </a>
          )}
          {addButton}
        </div>
      </div>

      {total === 0 ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <p style={mutedText}>
            {subcategoryProductCount > 0
              ? `No products directly in this category. Its subcategories hold ${plural(subcategoryProductCount, "product", "products")}.`
              : "No products in this category yet."}
          </p>
        </div>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: "0.75rem",
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: "1 1 14rem", minWidth: 0 }}>
              <input
                type="text"
                dir="ltr"
                aria-label="Search products on this page"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setShowAll(false);
                }}
                placeholder="Search by name, SKU or brand"
                style={inputStyle}
              />
            </div>
            <div
              role="group"
              aria-label="Placement"
              style={{ display: "flex", gap: "0.375rem" }}
            >
              <button
                type="button"
                aria-pressed={placement === "all"}
                onClick={() => {
                  setPlacement("all");
                  setShowAll(false);
                }}
                style={segmentButton(placement === "all")}
              >
                All {total}
              </button>
              <button
                type="button"
                aria-pressed={placement === "main"}
                onClick={() => {
                  setPlacement("main");
                  setShowAll(false);
                }}
                style={segmentButton(placement === "main")}
              >
                Main {mainCount}
              </button>
              <button
                type="button"
                aria-pressed={placement === "extra"}
                onClick={() => {
                  setPlacement("extra");
                  setShowAll(false);
                }}
                style={segmentButton(placement === "extra")}
              >
                Also here {extraCount}
              </button>
            </div>
            <div className="cpm-filter">
              <Select
                label="Status"
                id="cpm-status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as StatusFilter);
                  setShowAll(false);
                }}
              >
                <option value="">Any</option>
                <option value="PUBLISHED">Published</option>
                <option value="DRAFT">Draft</option>
                <option value="ARCHIVED">Archived</option>
              </Select>
            </div>
          </div>

          {matching.length === 0 ? (
            <p style={mutedText}>No products match these filters.</p>
          ) : (
            <div>
              {visible.map((row) => {
                const stockView = stockInfo(row);
                const extra = row.placement === "extra";
                return (
                  <div key={row.id} className="cpm-row">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          position: "relative",
                          width: 44,
                          height: 44,
                          flexShrink: 0,
                          backgroundColor: "var(--color-auth-input-bg)",
                          border: "1px solid var(--color-auth-input-border)",
                          overflow: "hidden",
                        }}
                      >
                        <FadeImage
                          src={getImageUrl(row.storageKey)}
                          alt={row.nameEn}
                          fill
                          sizes="44px"
                          className="object-contain"
                        />
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.125rem",
                          minWidth: 0,
                        }}
                      >
                        <Link
                          href={`/admin/products/${row.id}`}
                          onClick={() =>
                            startNavigationProgress(`/admin/products/${row.id}`)
                          }
                          style={{
                            fontSize: "var(--text-body)",
                            color: "#0b0b0b",
                            fontWeight: 500,
                          }}
                        >
                          {row.nameEn}
                        </Link>
                        <span style={{ fontSize: 13, color: "#9a9a9a" }}>
                          <span
                            dir="ltr"
                            style={{
                              fontFamily: "var(--font-mono, monospace)",
                            }}
                          >
                            {row.sku}
                          </span>{" "}
                          · {row.brand}
                        </span>
                        {extra && (
                          <span style={{ fontSize: 13, color: "#9a9a9a" }}>
                            Main:{" "}
                            <Link
                              href={`/admin/categories/${row.mainCategory.id}`}
                              onClick={() =>
                                startNavigationProgress(
                                  `/admin/categories/${row.mainCategory.id}`,
                                )
                              }
                              style={{
                                color: "#0b0b0b",
                                textDecoration: "underline",
                              }}
                            >
                              {mainPath(row)}
                            </Link>
                            {row.addedAt &&
                              ` · added ${formatAdded(row.addedAt)}`}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="cpm-meta">
                      <span
                        dir="ltr"
                        style={{ fontSize: 13, color: "#0b0b0b" }}
                      >
                        {formatAED(row.price, "en")}
                      </span>
                      <span style={{ fontSize: 13, color: stockView.color }}>
                        {stockView.word}
                      </span>
                      <PublishStatusPill status={row.publishStatus} />
                      {extra ? (
                        <span
                          style={{
                            fontSize: 11,
                            lineHeight: 1.4,
                            padding: "2px 8px",
                            color: "#0b0b0b",
                            border: "1px solid #0b0b0b",
                          }}
                        >
                          Also here
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: 11,
                            lineHeight: 1.4,
                            padding: "2px 8px",
                            color: "#ffffff",
                            backgroundColor: "#0b0b0b",
                          }}
                        >
                          Main
                        </span>
                      )}
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.875rem",
                        }}
                      >
                        {row.publishStatus === "PUBLISHED" &&
                          row.mainCategory.live && (
                            <a
                              href={`/en/shop/${row.mainCategory.slug}/${row.slugEn}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={textLink}
                            >
                              View on store ↗
                            </a>
                          )}
                        {extra ? (
                          <button
                            type="button"
                            aria-label={`Remove ${row.nameEn} from ${categoryName}`}
                            onClick={() => setRemoveTarget(row)}
                            style={{ ...textLink, color: "#991b1b" }}
                          >
                            Remove
                          </button>
                        ) : (
                          <Link
                            href={`/admin/products/${row.id}#category`}
                            onClick={() =>
                              startNavigationProgress(
                                `/admin/products/${row.id}#category`,
                              )
                            }
                            style={textLink}
                          >
                            Change main
                          </Link>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!showAll && matching.length > PAGE_SIZE && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              style={{
                ...textLink,
                alignSelf: "flex-start",
                fontSize: "var(--text-body)",
              }}
            >
              Show all {matching.length}
            </button>
          )}
        </>
      )}

      <CategoryProductPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        categoryId={categoryId}
        categoryName={categoryName}
        pathLabel={pathLabel}
        live={live}
        items={pickerItems}
        onAdded={() => router.refresh()}
      />

      <ConfirmDialog
        open={removeTarget !== null}
        onClose={() => {
          if (!isRemoving) setRemoveTarget(null);
        }}
        onConfirm={() => {
          void handleConfirmRemove();
        }}
        title={`Remove from ${categoryName}`}
        message={
          removeTarget
            ? `${removeTarget.nameEn} stays in ${removeTarget.mainCategory.nameEn} and its other categories.`
            : ""
        }
        confirmLabel="Remove"
        cancelLabel="Cancel"
        isPending={isRemoving}
        destructive={false}
      />
    </div>
  );
}
