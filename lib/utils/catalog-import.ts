import { BRAND } from "@/lib/config/brand";
import type { ImportImageTarget, ImportImageType } from "@/lib/utils/image-sniff";

export const CATALOG_TEMPLATE_ID = `${BRAND.slug}-catalog-import`;
export const CATALOG_TEMPLATE_VERSION = "8";
export const CATALOG_TEMPLATE_PATH =
  `/templates/${BRAND.shortName}_Catalog_Import_v8.xlsx`;
export const CATALOG_TEMPLATE_DOWNLOAD_NAME =
  `${BRAND.name} Catalog Import Template.xlsx`;
export const MAX_IMPORT_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_IMPORT_REQUEST_BYTES = 4_400_000;
export const MAX_PRODUCT_ROWS = 2000;
export const MAX_SHEET_ROWS = 5000;
export const MAX_IMPORT_COLUMNS = 60;
export const MAX_REPORTED_ISSUES = 5000;
export const DATA_START_ROW = 4;
export const CATALOG_IMPORT_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function safeImportFileName(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/\.xlsx$/i, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._]+|[._]+$/g, "")
    .slice(0, 100);
  return base === "" ? "import.xlsx" : `${base}.xlsx`;
}

export const CATALOG_DATA_SHEETS = [
  "Products",
  "Specs",
  "Images",
  "Accessory_Links",
] as const;

export const WRITTEN_SHEETS = ["Products", "Specs", "Images", "Accessory_Links"];

export type CatalogDataSheet = (typeof CATALOG_DATA_SHEETS)[number];

export const SHEET_COLUMNS: Record<CatalogDataSheet, readonly string[]> = {
  Products: [
    "sku",
    "slug_en",
    "publish_status",
    "category_slug",
    "brand",
    "name_en",
    "name_ar",
    "name_ru",
    "action_type",
    "caliber_mm",
    "price",
    "compare_at_price",
    "opening_stock",
    "low_stock_threshold",
    "weight_grams",
    "min_order_qty",
    "max_order_qty",
    "requires_id_verification",
    "b2b_available",
    "is_new_arrival",
    "is_featured",
    "sort_order",
    "loyalty_rule",
    "loyalty_multiplier",
    "loyalty_points_earn",
    "loyalty_starts",
    "loyalty_ends",
    "tags",
    "description_en",
    "description_ar",
    "description_ru",
    "meta_title_en",
    "meta_title_ar",
    "meta_title_ru",
    "meta_description_en",
    "meta_description_ar",
    "meta_description_ru",
    "internal_notes",
  ],
  Specs: [
    "product_sku",
    "display_order",
    "label_en",
    "label_ar",
    "label_ru",
    "value_en",
    "value_ar",
    "value_ru",
  ],
  Images: [
    "product_sku",
    "filename",
    "display_order",
    "alt_text_en",
    "alt_text_ar",
    "alt_text_ru",
  ],
  Accessory_Links: ["product_sku", "accessory_sku", "display_order"],
};

export const REQUIRED_COLUMNS: Record<CatalogDataSheet, readonly string[]> = {
  Products: ["sku"],
  Specs: ["product_sku", "label_en", "label_ar", "value_en", "value_ar"],
  Images: ["product_sku", "filename", "display_order"],
  Accessory_Links: ["product_sku", "accessory_sku"],
};

export type ImportIssue = {
  severity: "error" | "warning";
  sheet: string | null;
  row: number | null;
  column: string | null;
  sku: string | null;
  found: string | null;
  problem: string;
  fix: string | null;
};

export type ImportFieldChange = {
  column: string;
  from: string;
  to: string;
};

export type ImportChange = {
  sku: string;
  row: number | null;
  action: "create" | "update";
  name: string;
  publishStatus: "PUBLISHED" | "DRAFT" | "ARCHIVED";
  openingStock: number | null;
  fields: ImportFieldChange[];
  specRows: number | null;
  imageRows: number | null;
  accessoryRows: number | null;
};

export type CatalogImportUpload = { name: string; target: ImportImageTarget };

export const importUploadKey = (u: CatalogImportUpload): string => `${u.target}:${u.name}`;

export type CatalogImportImageFile = {
  name: string;
  size: number;
  type: ImportImageType | null;
};

export type CatalogImportCounts = {
  productRows: number;
  create: number;
  update: number;
  unchanged: number;
  specTables: number;
  galleries: number;
  imageRows: number;
  accessoryLists: number;
  warnings: number;
  errors: number;
};

export type CatalogImportSummary = {
  fileName: string;
  fileHash: string;
  refused: boolean;
  counts: CatalogImportCounts;
  uploads: CatalogImportUpload[];
  issues: ImportIssue[];
  issuesTruncated: boolean;
  changes: ImportChange[];
};

export const COLUMN_LABELS: Record<string, string> = {
  sku: "SKU",
  slug_en: "Web address",
  publish_status: "Status",
  category_slug: "Category",
  brand: "Brand",
  name_en: "Name (English)",
  name_ar: "Name (Arabic)",
  name_ru: "Name (Russian)",
  action_type: "Mechanism",
  caliber_mm: "Calibre (mm)",
  price: "Price (AED)",
  compare_at_price: "Was-price (AED)",
  opening_stock: "Opening stock",
  low_stock_threshold: "Low-stock alert level",
  weight_grams: "Weight (g)",
  min_order_qty: "Minimum per order",
  max_order_qty: "Maximum per order",
  requires_id_verification: "ID verification required",
  b2b_available: "Available to business accounts",
  supports_addons: "Offers add-ons",
  is_new_arrival: "New arrival",
  is_featured: "Featured",
  sort_order: "Sort position",
  loyalty_rule: "Loyalty rule",
  loyalty_multiplier: "Boost multiplier",
  loyalty_points_earn: "Fixed points per unit",
  loyalty_starts: "Rule starts",
  loyalty_ends: "Rule ends",
  tags: "Tags",
  description_en: "Description (English)",
  description_ar: "Description (Arabic)",
  description_ru: "Description (Russian)",
  meta_title_en: "Search title (English)",
  meta_title_ar: "Search title (Arabic)",
  meta_title_ru: "Search title (Russian)",
  meta_description_en: "Search description (English)",
  meta_description_ar: "Search description (Arabic)",
  meta_description_ru: "Search description (Russian)",
  internal_notes: "Internal notes",
  product_sku: "Product SKU",
  display_order: "Position",
  label_en: "Label (English)",
  label_ar: "Label (Arabic)",
  label_ru: "Label (Russian)",
  value_en: "Value (English)",
  value_ar: "Value (Arabic)",
  value_ru: "Value (Russian)",
  specs: "Specifications",
  images: "Images",
  addons: "Add-ons",
  accessory_sku: "Accessory SKU",
  accessories: "Accessories",
  addon_id: "Add-on ID",
  is_active: "Active",
  image_filename: "Image file",
  filename: "Image file",
  alt_text_en: "Image description (English)",
  alt_text_ar: "Image description (Arabic)",
  alt_text_ru: "Image description (Russian)",
};

export function columnLabel(key: string | null): string | null {
  if (key === null) return null;
  return COLUMN_LABELS[key] ?? key;
}

function csvCell(value: string | number | null): string {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function issuesToCsv(issues: ImportIssue[]): string {
  const lines = [
    "Severity,Sheet,Row,Column,Column key,SKU,You entered,What's wrong,How to fix",
    ...issues.map((i) =>
      [
        i.severity === "error" ? "Error" : "Warning",
        i.sheet,
        i.row,
        columnLabel(i.column),
        i.column,
        i.sku,
        i.found,
        i.problem,
        i.fix,
      ]
        .map(csvCell)
        .join(","),
    ),
  ];
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export function formatImportValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  let s: string;
  if (typeof v === "boolean") s = v ? "Yes" : "No";
  else if (Array.isArray(v)) s = v.map((x) => String(x)).join(", ");
  else s = String(v);
  if (s === "") return "—";
  return s.length > 120 ? `${s.slice(0, 119)}…` : s;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
