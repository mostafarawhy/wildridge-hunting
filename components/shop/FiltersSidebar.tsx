"use client";

import { Suspense, useCallback, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  FilterSection,
  CheckRow,
  ToggleRow,
  ActivePill,
  DualRangeSlider,
  FiltersSkeleton,
} from "./filters";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FiltersSidebarProps {
  brands: FilterOption[];
  actionTypes: string[];
  idOptions: { required: boolean; none: boolean };
  calibers: FilterOption[];
  minPrice: number;
  maxPrice: number;
}

const PARAM = {
  brand: "brand",
  actionType: "actionType",
  caliber: "caliber",
  minPrice: "minPrice",
  maxPrice: "maxPrice",
  inStock: "inStock",
  requiresId: "requiresId",
  noIdRequired: "noIdRequired",
  newArrivals: "newArrivals",
  page: "page",
} as const;

const ACTION_TYPE_VALUES = [
  "Spring",
  "PCP",
  "CO2",
  "Gas-Ram",
  "Multi-Pump",
] as const;

function FiltersSidebarInner({
  brands,
  actionTypes,
  idOptions,
  calibers,
  minPrice,
  maxPrice,
}: FiltersSidebarProps) {
  const t = useTranslations("shop");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeBrands = searchParams.getAll(PARAM.brand);
  const activeActionTypes = searchParams.getAll(PARAM.actionType);
  const activeCalibers = searchParams.getAll(PARAM.caliber);
  const currentMin = Number(searchParams.get(PARAM.minPrice) ?? minPrice);
  const currentMax = Number(searchParams.get(PARAM.maxPrice) ?? maxPrice);
  const inStockOnly = searchParams.get(PARAM.inStock) === "true";
  const requiresIdOnly = searchParams.get(PARAM.requiresId) === "true";
  const noIdRequiredOnly = searchParams.get(PARAM.noIdRequired) === "true";
  const newArrivalsOnly = searchParams.get(PARAM.newArrivals) === "true";

  const [brandQuery, setBrandQuery] = useState("");
  const [brandsExpanded, setBrandsExpanded] = useState(false);

  const applyFilter = useCallback(
    (mutateFn: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutateFn(params);
      params.delete(PARAM.page);
      startNavigationProgress();
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  function toggleMulti(key: string, value: string, active: string[]) {
    applyFilter((params) => {
      params.delete(key);
      const next = active.includes(value)
        ? active.filter((v) => v !== value)
        : [...active, value];
      next.forEach((v) => params.append(key, v));
    });
  }

  function toggleBoolean(key: string, current: boolean, clears?: string) {
    applyFilter((params) => {
      if (current) {
        params.delete(key);
      } else {
        params.set(key, "true");
        if (clears) params.delete(clears);
      }
    });
  }

  const actionTypeLabels: Record<string, string> = {
    Spring: t("action_spring"),
    PCP: t("action_pcp"),
    CO2: t("action_co2"),
    "Gas-Ram": t("action_gas_ram"),
    "Multi-Pump": t("action_multi_pump"),
  };

  const showIdToggles =
    (idOptions.required && idOptions.none) ||
    requiresIdOnly ||
    noIdRequiredOnly;

  const trimmedBrandQuery = brandQuery.trim().toLowerCase();
  const searchingBrands = trimmedBrandQuery.length > 0;
  const orderedBrands = [
    ...brands.filter((b) => activeBrands.includes(b.value)),
    ...brands.filter((b) => !activeBrands.includes(b.value)),
  ];
  const matchedBrands = searchingBrands
    ? orderedBrands.filter((b) =>
        b.label.toLowerCase().includes(trimmedBrandQuery),
      )
    : orderedBrands;
  const visibleBrands =
    searchingBrands || brandsExpanded
      ? matchedBrands
      : matchedBrands.slice(0, 6);

  const hasActiveFilters =
    activeBrands.length > 0 ||
    activeActionTypes.length > 0 ||
    activeCalibers.length > 0 ||
    inStockOnly ||
    requiresIdOnly ||
    noIdRequiredOnly ||
    newArrivalsOnly ||
    currentMin !== minPrice ||
    currentMax !== maxPrice;

  return (
    <aside
      className="w-full"
      style={{ backgroundColor: "var(--color-shop-bg)" }}
    >
      {hasActiveFilters && (
        <div
          className="px-5 py-4"
          style={{ borderBottom: "1px solid var(--color-shop-divider)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <span
              className="text-eyebrow tracking-widest uppercase"
              style={{ color: "var(--color-content-tertiary)" }}
            >
              {t("active_filters")}
            </span>
            <button
              type="button"
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                [
                  PARAM.brand,
                  PARAM.actionType,
                  PARAM.caliber,
                  PARAM.minPrice,
                  PARAM.maxPrice,
                  PARAM.inStock,
                  PARAM.requiresId,
                  PARAM.noIdRequired,
                  PARAM.newArrivals,
                  PARAM.page,
                ].forEach((key) => params.delete(key));
                const query = params.toString();
                startNavigationProgress();
                router.push(query ? `${pathname}?${query}` : pathname, {
                  scroll: false,
                });
              }}
              className="text-eyebrow tracking-widest uppercase transition-opacity hover:opacity-70"
              style={{ color: "var(--color-action-primary)" }}
            >
              {t("clear_all")}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeBrands.map((b) => (
              <ActivePill
                key={b}
                label={brands.find((o) => o.value === b)?.label ?? b}
                onRemove={() => toggleMulti(PARAM.brand, b, activeBrands)}
              />
            ))}
            {activeActionTypes.map((a) => (
              <ActivePill
                key={a}
                label={actionTypeLabels[a] ?? a}
                onRemove={() =>
                  toggleMulti(PARAM.actionType, a, activeActionTypes)
                }
              />
            ))}
            {activeCalibers.map((c) => (
              <ActivePill
                key={c}
                label={c}
                onRemove={() => toggleMulti(PARAM.caliber, c, activeCalibers)}
              />
            ))}
            {inStockOnly && (
              <ActivePill
                label={t("in_stock")}
                onRemove={() => toggleBoolean(PARAM.inStock, true)}
              />
            )}
            {requiresIdOnly && (
              <ActivePill
                label={t("requires_id")}
                onRemove={() => toggleBoolean(PARAM.requiresId, true)}
              />
            )}
            {noIdRequiredOnly && (
              <ActivePill
                label={t("no_id_required")}
                onRemove={() => toggleBoolean(PARAM.noIdRequired, true)}
              />
            )}
            {newArrivalsOnly && (
              <ActivePill
                label={t("new_arrivals")}
                onRemove={() => toggleBoolean(PARAM.newArrivals, true)}
              />
            )}
          </div>
        </div>
      )}
      {(brands.length >= 2 || activeBrands.length > 0) && (
        <FilterSection
          label={t("brand")}
          summary={activeBrands
            .map((b) => brands.find((o) => o.value === b)?.label ?? b)
            .join(", ")}
        >
          <div>
            {brands.length > 8 && (
              <input
                type="text"
                value={brandQuery}
                onChange={(e) => setBrandQuery(e.target.value)}
                placeholder={t("brand_search")}
                aria-label={t("brand_search")}
                className="w-full h-9 px-3 text-body-sm"
                style={{
                  backgroundColor: "var(--color-auth-input-bg)",
                  border: "1px solid var(--color-shop-divider)",
                  borderRadius: "var(--radius-none)",
                  color: "var(--primitive-black)",
                  marginBottom: "8px",
                }}
              />
            )}
            <div className="flex flex-col gap-2.5">
              {visibleBrands.map((b) => (
                <CheckRow
                  key={b.value}
                  label={b.label}
                  checked={activeBrands.includes(b.value)}
                  onChange={() =>
                    toggleMulti(PARAM.brand, b.value, activeBrands)
                  }
                />
              ))}
              {searchingBrands && matchedBrands.length === 0 && (
                <p
                  className="text-body-sm"
                  style={{ color: "var(--color-content-tertiary)" }}
                >
                  {t("brand_no_match")}
                </p>
              )}
              {!searchingBrands && matchedBrands.length > 6 && (
                <button
                  type="button"
                  onClick={() => setBrandsExpanded((v) => !v)}
                  className="text-body-sm underline text-start cursor-pointer"
                  style={{ color: "var(--primitive-black)" }}
                >
                  {brandsExpanded
                    ? t("brand_show_less")
                    : t("brand_show_all", { count: brands.length })}
                </button>
              )}
            </div>
          </div>
        </FilterSection>
      )}

      <FilterSection label={t("price_range")}>
        <DualRangeSlider
          min={minPrice}
          max={maxPrice}
          valueMin={currentMin}
          valueMax={currentMax}
          onCommit={(lo, hi) =>
            applyFilter((p) => {
              p.set(PARAM.minPrice, String(lo));
              p.set(PARAM.maxPrice, String(hi));
            })
          }
        />
      </FilterSection>

      {(actionTypes.length >= 2 || activeActionTypes.length > 0) && (
        <FilterSection
          label={t("action_type")}
          defaultOpen={activeActionTypes.length > 0}
          summary={activeActionTypes
            .map((a) => actionTypeLabels[a] ?? a)
            .join(", ")}
        >
          {ACTION_TYPE_VALUES.filter((a) => actionTypes.includes(a)).map(
            (a) => (
              <CheckRow
                key={a}
                label={actionTypeLabels[a]}
                checked={activeActionTypes.includes(a)}
                onChange={() =>
                  toggleMulti(PARAM.actionType, a, activeActionTypes)
                }
              />
            ),
          )}
        </FilterSection>
      )}

      {(calibers.length >= 2 || activeCalibers.length > 0) && (
        <FilterSection
          label={t("caliber")}
          defaultOpen={activeCalibers.length > 0}
          summary={activeCalibers
            .map((c) => calibers.find((o) => o.value === c)?.label ?? c)
            .join(", ")}
        >
          {calibers.map((c) => (
            <CheckRow
              key={c.value}
              label={c.label}
              checked={activeCalibers.includes(c.value)}
              onChange={() =>
                toggleMulti(PARAM.caliber, c.value, activeCalibers)
              }
            />
          ))}
        </FilterSection>
      )}

      <FilterSection label={t("availability")}>
        <ToggleRow
          label={t("in_stock_only")}
          checked={inStockOnly}
          onChange={() => toggleBoolean(PARAM.inStock, inStockOnly)}
        />
        <ToggleRow
          label={t("new_arrivals_only")}
          checked={newArrivalsOnly}
          onChange={() => toggleBoolean(PARAM.newArrivals, newArrivalsOnly)}
        />
        {showIdToggles && (
          <>
            <ToggleRow
              label={t("requires_id")}
              checked={requiresIdOnly}
              onChange={() =>
                toggleBoolean(
                  PARAM.requiresId,
                  requiresIdOnly,
                  PARAM.noIdRequired,
                )
              }
            />
            <ToggleRow
              label={t("no_id_required")}
              checked={noIdRequiredOnly}
              onChange={() =>
                toggleBoolean(
                  PARAM.noIdRequired,
                  noIdRequiredOnly,
                  PARAM.requiresId,
                )
              }
            />
          </>
        )}
      </FilterSection>
    </aside>
  );
}

export default function FiltersSidebar(props: FiltersSidebarProps) {
  return (
    <Suspense fallback={<FiltersSkeleton />}>
      <FiltersSidebarInner {...props} />
    </Suspense>
  );
}
