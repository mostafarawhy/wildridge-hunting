import { BRAND } from "@/lib/config/brand";
import "server-only";

import * as XLSX from "xlsx";
import { createHash } from "node:crypto";
import type { Prisma } from "@/app/generated/prisma/client";
import type { db } from "@/lib/db/client";
import { slugFromName, slugWithSuffix } from "@/lib/utils/slug";
import { dubaiDayEndIso, dubaiDayFromIso, dubaiDayStartIso } from "@/lib/utils/coupon-display";
import { normalizeLoyaltyRuleFields } from "@/lib/utils/loyalty-points";
import { deleteFiles, listFiles, readPublicObjectHead } from "@/lib/services/storage";
import {
  IMPORT_IMAGE_NAME_RE,
  IMPORT_IMAGE_TYPES,
  imageExtension,
  sniffImageType,
  typeMatchesExtension,
  type ImportImageTarget,
  type ImportImageType,
} from "@/lib/utils/image-sniff";
import {
  MAX_PRODUCT_IMAGE_SIZE_BYTES,
  MAX_PRODUCT_IMAGES,
  MAX_PRODUCT_SPEC_ROWS,
} from "@/lib/validations/product";
import {
  CreateProductSchema,
  UpdateProductSchema,
  type CreateProductInput,
  type UpdateProductInput,
} from "@/lib/validations/product";
import {
  CATALOG_DATA_SHEETS,
  CATALOG_TEMPLATE_ID,
  CATALOG_TEMPLATE_VERSION,
  DATA_START_ROW,
  MAX_IMPORT_COLUMNS,
  MAX_PRODUCT_ROWS,
  MAX_REPORTED_ISSUES,
  MAX_SHEET_ROWS,
  REQUIRED_COLUMNS,
  SHEET_COLUMNS,
  formatImportValue,
  type CatalogDataSheet,
  type CatalogImportImageFile,
  type CatalogImportSummary,
  type CatalogImportUpload,
  type ImportChange,
  type ImportFieldChange,
  type ImportIssue,
} from "@/lib/utils/catalog-import";

export type CellValue = string | number | boolean | null;

export type ParsedRow = { row: number; cells: Record<string, CellValue> };

export type ParsedWorkbook = {
  fileIssues: ImportIssue[];
  rows: Record<CatalogDataSheet, ParsedRow[]>;
};

export type CatalogImportSpecRow = {
  productSku: string;
  labelEn: string;
  labelAr: string;
  labelRu: string | null;
  valueEn: string;
  valueAr: string;
  valueRu: string | null;
  displayOrder: number;
};

export type CatalogImportImageRow = {
  productSku: string;
  filename: string;
  displayOrder: number;
  altTextEn: string | null;
  altTextAr: string | null;
  altTextRu: string | null;
  reuseKey: string | null;
};

export type CatalogImportWrites = {
  creates: {
    row: number;
    data: Omit<CreateProductInput, "openingStock">;
    openingStock: number;
    specs: CatalogImportSpecRow[];
    images: string[];
    accessories: string[];
  }[];
  updates: {
    id: string;
    sku: string;
    row: number | null;
    changed: Partial<UpdateProductInput>;
    before: Record<string, unknown>;
    specsBefore: string[] | null;
    specsAfter: string[] | null;
    imagesBefore: string[] | null;
    imagesAfter: string[] | null;
    accessoriesBefore: string[] | null;
    accessoriesAfter: string[] | null;
  }[];
  specReplacements: { sku: string; rows: CatalogImportSpecRow[] }[];
  imageReplacements: { sku: string; rows: CatalogImportImageRow[] }[];
  accessoryReplacements: {
    sku: string;
    rows: { accessorySku: string; displayOrder: number }[];
  }[];
};

export type CatalogImportPlan = {
  summary: CatalogImportSummary;
  writes: CatalogImportWrites;
};

export function hashImportBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

const NOT_XLSX_PROBLEM = "This file isn't an Excel workbook (.xlsx).";
const NOT_XLSX_FIX =
  "In Excel choose File › Save As › Excel Workbook (.xlsx), then check it again.";
const TEMPLATE_FIX = "Download the import template from this page and copy your rows into it.";

function emptyRows(): Record<CatalogDataSheet, ParsedRow[]> {
  return { Products: [], Specs: [], Images: [], Accessory_Links: [] };
}

function fileIssue(
  sheet: string | null,
  problem: string,
  fix: string,
  column: string | null = null,
  found: string | null = null,
): ImportIssue {
  return {
    severity: "error",
    sheet,
    row: null,
    column,
    sku: null,
    found,
    problem,
    fix,
  };
}

function cellValue(cell: XLSX.CellObject | undefined): CellValue {
  if (!cell) return null;
  if (cell.t === "e") return "#ERROR";
  const v = cell.v;
  if (v === null || v === undefined) return null;
  if (typeof v === "string") {
    const s = v.trim();
    return s === "" ? null : s;
  }
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean") return v;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export function parseCatalogWorkbook(bytes: Uint8Array): ParsedWorkbook {
  const rows = emptyRows();
  const refuse = (problem: string, fix: string): ParsedWorkbook => ({
    fileIssues: [fileIssue(null, problem, fix)],
    rows,
  });

  if (
    bytes.length < 4 ||
    bytes[0] !== 0x50 ||
    bytes[1] !== 0x4b ||
    bytes[2] !== 0x03 ||
    bytes[3] !== 0x04
  ) {
    return refuse(NOT_XLSX_PROBLEM, NOT_XLSX_FIX);
  }

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(bytes, {
      type: "array",
      sheets: ["_meta", ...CATALOG_DATA_SHEETS],
      sheetRows: DATA_START_ROW + MAX_SHEET_ROWS,
      cellFormula: false,
      cellHTML: false,
      cellText: false,
      cellDates: false,
      cellStyles: false,
    });
  } catch {
    return refuse(NOT_XLSX_PROBLEM, NOT_XLSX_FIX);
  }

  const meta = wb.Sheets["_meta"];
  const pairs = new Map<string, unknown>();
  if (meta) {
    const metaRows = XLSX.utils.sheet_to_json<unknown[]>(meta, {
      header: 1,
      defval: null,
    });
    for (const r of metaRows) {
      if (r[0] !== null && r[0] !== undefined) {
        pairs.set(String(r[0]).trim(), r[1]);
      }
    }
  }
  if (!meta || String(pairs.get("template") ?? "").trim() !== CATALOG_TEMPLATE_ID) {
    return refuse(`This isn't the ${BRAND.name} catalog import template.`, TEMPLATE_FIX);
  }
  const version = String(pairs.get("version") ?? "").trim();
  if (version !== CATALOG_TEMPLATE_VERSION) {
    return refuse("This file was made from an older import template.", TEMPLATE_FIX);
  }

  const fileIssues: ImportIssue[] = [];

  for (const name of CATALOG_DATA_SHEETS) {
    const ws = wb.Sheets[name];
    if (!ws) {
      fileIssues.push(
        fileIssue(
          name,
          `Sheet '${name}' is missing.`,
          "Don't rename or delete sheets. Download the import template if unsure.",
        ),
      );
      continue;
    }

    const known = new Set(SHEET_COLUMNS[name]);
    const fullRefProp = (ws as Record<string, unknown>)["!fullref"] as
      | string
      | undefined;
    const ref = ws["!ref"];
    const fullRef = fullRefProp ?? ref;
    const fullRange = fullRef ? XLSX.utils.decode_range(fullRef) : null;

    if (fullRange && fullRange.e.c >= MAX_IMPORT_COLUMNS) {
      fileIssues.push(
        fileIssue(
          name,
          `Sheet '${name}' has more than ${MAX_IMPORT_COLUMNS} columns.`,
          "Delete the extra columns.",
        ),
      );
    }
    if (fullRefProp) {
      fileIssues.push(
        fileIssue(
          name,
          `Sheet '${name}' has content below row ${DATA_START_ROW + MAX_SHEET_ROWS}.`,
          "Delete everything below your last row of data.",
        ),
      );
    }

    const keyCols = new Map<string, number>();
    const lastCol = fullRange
      ? Math.min(fullRange.e.c, MAX_IMPORT_COLUMNS - 1)
      : -1;
    for (let c = 0; c <= lastCol; c++) {
      const v = cellValue(ws[XLSX.utils.encode_cell({ r: 0, c })]);
      if (v === null) continue;
      const key = String(v).trim();
      if (key === "") continue;
      const letter = XLSX.utils.encode_col(c);
      if (!known.has(key)) {
        fileIssues.push(
          fileIssue(
            name,
            `Unknown column '${key}' in ${name}, column ${letter}.`,
            "Use the exact key from the Column_Guide sheet, or delete the column.",
            key,
            letter,
          ),
        );
      } else if (keyCols.has(key)) {
        fileIssues.push(
          fileIssue(
            name,
            `Column '${key}' appears twice in ${name}.`,
            "Delete one of them.",
            key,
          ),
        );
      } else {
        keyCols.set(key, c);
      }
    }
    for (const key of REQUIRED_COLUMNS[name]) {
      if (!keyCols.has(key)) {
        fileIssues.push(
          fileIssue(
            name,
            `Column '${key}' is missing from ${name}.`,
            "Download the import template and copy your rows into it.",
            key,
          ),
        );
      }
    }

    const range = ref ? XLSX.utils.decode_range(ref) : null;
    const parsedRows: ParsedRow[] = [];
    if (range) {
      for (let r = DATA_START_ROW - 1; r <= range.e.r; r++) {
        const cells: Record<string, CellValue> = {};
        let any = false;
        for (const [key, c] of keyCols) {
          const v = cellValue(ws[XLSX.utils.encode_cell({ r, c })]);
          cells[key] = v;
          if (v !== null) any = true;
        }
        if (any) parsedRows.push({ row: r + 1, cells });
      }
    }

    const limit = name === "Products" ? MAX_PRODUCT_ROWS : MAX_SHEET_ROWS;
    if (parsedRows.length > limit) {
      fileIssues.push(
        fileIssue(
          name,
          `${name} has ${parsedRows.length} rows; the limit is ${limit}.`,
          "Split the file into smaller imports.",
        ),
      );
    }
    rows[name] = parsedRows;
  }

  return { fileIssues, rows };
}

type Cells = Record<string, CellValue>;

type NumOpts = {
  decimals1?: boolean;
  decimals2?: boolean;
  int?: boolean;
  range?: { test: (n: number) => boolean; problem: string; fix: string };
};

type FieldKind =
  | { t: "text"; max?: number }
  | { t: "num"; o: NumOpts }
  | { t: "yn" }
  | { t: "action" }
  | { t: "loyaltyRule" }
  | { t: "day"; edge: "start" | "end" }
  | { t: "status" }
  | { t: "tags" };

const NUM_RE = /^-?\d+(\.\d+)?$/;
const SKU_RE = /^[A-Za-z0-9._-]+$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const ACTION_MAP: Record<string, string> = {
  spring: "Spring",
  pcp: "PCP",
  co2: "CO2",
  "gas-ram": "Gas_Ram",
  "multi-pump": "Multi_Pump",
  "n/a": "NA",
};

const STATUS_VALUES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
type PublishStatusValue = (typeof STATUS_VALUES)[number];

function minRange(min: number): NonNullable<NumOpts["range"]> {
  return {
    test: (n) => n >= min,
    problem: `Must be ${min} or more.`,
    fix: `Enter a whole number of ${min} or more, or leave it empty.`,
  };
}

const MULTIPLIER_RANGE = {
  test: (n: number) => n >= 1.1 && n <= 10,
  problem: "Must be from 1.1 to 10.",
  fix: "Enter a multiplier from 1.1 to 10, or leave it empty.",
};
const LOYALTY_POINTS_RANGE = {
  test: (n: number) => n >= 0 && n <= 100000,
  problem: "Must be from 0 to 100,000.",
  fix: "Enter whole points from 1 to 100,000, or leave it empty.",
};

const LOYALTY_RULE_MAP: Record<string, string> = {
  standard: "STANDARD",
  boosted: "BOOSTED",
  fixed: "FIXED",
  "no points": "NONE",
};

const LOYALTY_RULE_DISPLAY: Record<string, string> = {
  STANDARD: "Standard",
  BOOSTED: "Boosted",
  FIXED: "Fixed",
  NONE: "No points",
};

const LOYALTY_FIELDS = [
  "loyaltyRule",
  "loyaltyMultiplier",
  "loyaltyPointsEarn",
  "loyaltyRuleStartsAt",
  "loyaltyRuleEndsAt",
];

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);

function parseImportDay(v: unknown): string | null {
  let day: string;
  if (typeof v === "number") {
    if (!Number.isFinite(v) || v < 1 || v >= 2958466) return null;
    day = new Date(EXCEL_EPOCH_MS + Math.floor(v) * 86_400_000)
      .toISOString()
      .slice(0, 10);
  } else if (typeof v === "string") {
    day = v.trim();
  } else {
    return null;
  }
  if (!DAY_RE.test(day)) return null;
  const parsed = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) {
    return null;
  }
  return day;
}

const MONEY_MAX = 9_999_999;

const PRICE_RANGE = {
  test: (n: number) => n > 0 && n <= MONEY_MAX,
  problem: "Must be above 0 and at most 9,999,999.",
  fix: "Enter the selling price in AED.",
};
const COMPARE_RANGE = {
  test: (n: number) => n >= 0.01 && n <= MONEY_MAX,
  problem: "Must be between 0.01 and 9,999,999.",
  fix: "Enter the was-price in AED, or leave it empty.",
};
const CALIBER_RANGE = {
  test: (n: number) => n >= 0.1 && n <= 30,
  problem: "Calibre must be between 0.1 and 30 mm.",
  fix: "Leave it empty when calibre doesn't apply.",
};

type ProductFieldDef = { field: string; column: string; kind: FieldKind };

const text = (field: string, column: string, max?: number): ProductFieldDef => ({
  field,
  column,
  kind: { t: "text", max },
});
const whole = (
  field: string,
  column: string,
  range?: NumOpts["range"],
): ProductFieldDef => ({
  field,
  column,
  kind: { t: "num", o: { int: true, range } },
});
const yn = (field: string, column: string): ProductFieldDef => ({
  field,
  column,
  kind: { t: "yn" },
});

const PRODUCT_FIELDS: ProductFieldDef[] = [
  { field: "publishStatus", column: "publish_status", kind: { t: "status" } },
  text("nameEn", "name_en", 200),
  text("nameAr", "name_ar", 200),
  text("nameRu", "name_ru", 200),
  { field: "actionType", column: "action_type", kind: { t: "action" } },
  {
    field: "caliberMm",
    column: "caliber_mm",
    kind: { t: "num", o: { decimals2: true, range: CALIBER_RANGE } },
  },
  {
    field: "price",
    column: "price",
    kind: { t: "num", o: { decimals2: true, range: PRICE_RANGE } },
  },
  {
    field: "compareAtPrice",
    column: "compare_at_price",
    kind: { t: "num", o: { decimals2: true, range: COMPARE_RANGE } },
  },
  whole("lowStockThreshold", "low_stock_threshold", minRange(0)),
  whole("weightGrams", "weight_grams", minRange(1)),
  whole("minOrderQty", "min_order_qty", minRange(1)),
  whole("maxOrderQty", "max_order_qty", minRange(1)),
  yn("requiresIdVerification", "requires_id_verification"),
  yn("b2bAvailable", "b2b_available"),
  yn("isNewArrival", "is_new_arrival"),
  yn("isFeatured", "is_featured"),
  whole("sortOrder", "sort_order"),
  { field: "loyaltyRule", column: "loyalty_rule", kind: { t: "loyaltyRule" } },
  {
    field: "loyaltyMultiplier",
    column: "loyalty_multiplier",
    kind: { t: "num", o: { decimals1: true, range: MULTIPLIER_RANGE } },
  },
  whole("loyaltyPointsEarn", "loyalty_points_earn", LOYALTY_POINTS_RANGE),
  {
    field: "loyaltyRuleStartsAt",
    column: "loyalty_starts",
    kind: { t: "day", edge: "start" },
  },
  {
    field: "loyaltyRuleEndsAt",
    column: "loyalty_ends",
    kind: { t: "day", edge: "end" },
  },
  { field: "tags", column: "tags", kind: { t: "tags" } },
  text("descriptionEn", "description_en"),
  text("descriptionAr", "description_ar"),
  text("descriptionRu", "description_ru"),
  text("metaTitleEn", "meta_title_en", 60),
  text("metaTitleAr", "meta_title_ar", 60),
  text("metaTitleRu", "meta_title_ru", 60),
  text("metaDescriptionEn", "meta_description_en", 160),
  text("metaDescriptionAr", "meta_description_ar", 160),
  text("metaDescriptionRu", "meta_description_ru", 160),
  text("internalNotes", "internal_notes"),
];

export const COLUMN_FOR_FIELD: Record<string, string> = {
  sku: "sku",
  slugEn: "slug_en",
  categoryId: "category_slug",
  brandId: "brand",
  openingStock: "opening_stock",
};
for (const def of PRODUCT_FIELDS) COLUMN_FOR_FIELD[def.field] = def.column;

const ACTION_DISPLAY: Record<string, string> = {
  Gas_Ram: "Gas-Ram",
  Multi_Pump: "Multi-Pump",
  NA: "N/A",
};
const STATUS_DISPLAY: Record<string, string> = {
  PUBLISHED: "Published",
  DRAFT: "Draft",
  ARCHIVED: "Archived",
};

function displayImportValue(
  field: string,
  v: unknown,
  slugById: Map<string, string>,
  brandNameById?: Map<string, string>,
): unknown {
  if (field === "categoryId" && typeof v === "string") {
    return slugById.get(v) ?? v;
  }
  if (field === "brandId" && typeof v === "string") {
    return brandNameById?.get(v) ?? v;
  }
  if (field === "actionType" && typeof v === "string") {
    return ACTION_DISPLAY[v] ?? v;
  }
  if (field === "publishStatus" && typeof v === "string") {
    return STATUS_DISPLAY[v] ?? v;
  }
  if (field === "loyaltyRule" && typeof v === "string") {
    return LOYALTY_RULE_DISPLAY[v] ?? v;
  }
  if (
    (field === "loyaltyRuleStartsAt" || field === "loyaltyRuleEndsAt") &&
    typeof v === "string"
  ) {
    return dubaiDayFromIso(v);
  }
  if ((field === "price" || field === "compareAtPrice") && typeof v === "number") {
    return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  return v;
}

export function describeFieldChange(
  field: string,
  before: unknown,
  after: unknown,
  slugById: Map<string, string>,
  brandNameById?: Map<string, string>,
): ImportFieldChange {
  return {
    column: COLUMN_FOR_FIELD[field] ?? field,
    from: formatImportValue(
      displayImportValue(field, before, slugById, brandNameById),
    ),
    to: formatImportValue(
      displayImportValue(field, after, slugById, brandNameById),
    ),
  };
}

const REQUIRED_ON_CREATE = [
  "category_slug",
  "brand",
  "name_en",
  "name_ar",
  "action_type",
  "price",
  "requires_id_verification",
];

const CURRENT_SELECT = {
  id: true,
  sku: true,
  slugEn: true,
  nameEn: true,
  nameAr: true,
  nameRu: true,
  brandId: true,
  actionType: true,
  caliberMm: true,
  descriptionEn: true,
  descriptionAr: true,
  descriptionRu: true,
  categoryId: true,
  tags: true,
  price: true,
  compareAtPrice: true,
  lowStockThreshold: true,
  weightGrams: true,
  requiresIdVerification: true,
  supportsAddons: true,
  b2bAvailable: true,
  minOrderQty: true,
  maxOrderQty: true,
  isNewArrival: true,
  isFeatured: true,
  sortOrder: true,
  loyaltyPointsEarn: true,
  loyaltyRule: true,
  loyaltyMultiplier: true,
  loyaltyRuleStartsAt: true,
  loyaltyRuleEndsAt: true,
  publishStatus: true,
  metaTitleEn: true,
  metaTitleAr: true,
  metaTitleRu: true,
  metaDescriptionEn: true,
  metaDescriptionAr: true,
  metaDescriptionRu: true,
  internalNotes: true,
  specs: {
    select: {
      labelEn: true,
      labelAr: true,
      labelRu: true,
      valueEn: true,
      valueAr: true,
      valueRu: true,
      displayOrder: true,
    },
  },
  images: {
    select: {
      filename: true,
      storageKey: true,
      displayOrder: true,
      altTextEn: true,
      altTextAr: true,
      altTextRu: true,
    },
  },
} satisfies Prisma.ProductSelect;

type CurrentProduct = Prisma.ProductGetPayload<{ select: typeof CURRENT_SELECT }>;

function currentInput(p: CurrentProduct): Record<string, unknown> {
  return {
    nameEn: p.nameEn,
    nameAr: p.nameAr,
    nameRu: p.nameRu,
    slugEn: p.slugEn,
    brandId: p.brandId,
    actionType: p.actionType,
    caliberMm: p.caliberMm != null ? Number(p.caliberMm) : null,
    descriptionEn: p.descriptionEn,
    descriptionAr: p.descriptionAr,
    descriptionRu: p.descriptionRu,
    categoryId: p.categoryId,
    tags: p.tags,
    price: Number(p.price),
    compareAtPrice: p.compareAtPrice != null ? Number(p.compareAtPrice) : null,
    lowStockThreshold: p.lowStockThreshold,
    weightGrams: p.weightGrams,
    requiresIdVerification: p.requiresIdVerification,
    supportsAddons: p.supportsAddons,
    b2bAvailable: p.b2bAvailable,
    minOrderQty: p.minOrderQty,
    maxOrderQty: p.maxOrderQty,
    isNewArrival: p.isNewArrival,
    isFeatured: p.isFeatured,
    sortOrder: p.sortOrder,
    loyaltyPointsEarn: p.loyaltyPointsEarn,
    loyaltyRule: p.loyaltyRule,
    loyaltyMultiplier: p.loyaltyMultiplier?.toNumber() ?? null,
    loyaltyRuleStartsAt: p.loyaltyRuleStartsAt?.toISOString() ?? null,
    loyaltyRuleEndsAt: p.loyaltyRuleEndsAt?.toISOString() ?? null,
    publishStatus: p.publishStatus,
    metaTitleEn: p.metaTitleEn,
    metaTitleAr: p.metaTitleAr,
    metaTitleRu: p.metaTitleRu,
    metaDescriptionEn: p.metaDescriptionEn,
    metaDescriptionAr: p.metaDescriptionAr,
    metaDescriptionRu: p.metaDescriptionRu,
    internalNotes: p.internalNotes,
  };
}

function rowTools(
  sheet: string,
  row: number,
  sku: string | null,
  cells: Cells,
  issues: ImportIssue[],
) {
  const errCols = new Set<string>();
  let errorCount = 0;

  const raw = (column: string): CellValue => {
    const v = cells[column] ?? null;
    return v === "#ERROR" ? null : v;
  };

  const add = (
    severity: "error" | "warning",
    column: string | null,
    problem: string,
    fix: string | null,
  ) => {
    if (severity === "error" && column && errCols.has(column)) return;
    issues.push({
      severity,
      sheet,
      row,
      column,
      sku,
      found: column ? formatImportValue(cells[column] ?? null) : null,
      problem,
      fix,
    });
    if (severity === "error") {
      errorCount++;
      if (column) errCols.add(column);
    }
  };

  for (const [column, value] of Object.entries(cells)) {
    if (value === "#ERROR") {
      add(
        "error",
        column,
        "This cell shows an Excel error such as #N/A or #REF!.",
        "Fix the formula, or type the value directly.",
      );
    }
  }

  const readText = (column: string, max?: number): string | null | undefined => {
    const v = raw(column);
    if (v === null) return null;
    const s = String(v).trim();
    if (s === "") return null;
    if (max !== undefined && s.length > max) {
      add(
        "error",
        column,
        `Longer than ${max} characters (${s.length}).`,
        `Shorten it to ${max} characters or fewer.`,
      );
      return undefined;
    }
    return s;
  };

  const readNum = (column: string, o: NumOpts): number | null | undefined => {
    const v = raw(column);
    if (v === null) return null;
    let n: number | null = null;
    if (typeof v === "number") n = v;
    else if (typeof v === "string" && NUM_RE.test(v)) n = Number(v);
    if (n === null || !Number.isFinite(n)) {
      add(
        "error",
        column,
        "Not a number.",
        "Type a plain number such as 850 or 2599.50: no currency, commas or units.",
      );
      return undefined;
    }
    if (o.decimals2 && Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) {
      add("error", column, "More than 2 decimal places.", "Round it to 2 decimal places.");
      return undefined;
    }
    if (o.decimals1 && Math.abs(n * 10 - Math.round(n * 10)) > 1e-6) {
      add("error", column, "More than 1 decimal place.", "Round it to 1 decimal place.");
      return undefined;
    }
    if (o.int && !Number.isInteger(n)) {
      add("error", column, "Must be a whole number.", "Remove the decimal part.");
      return undefined;
    }
    if (o.range && !o.range.test(n)) {
      add("error", column, o.range.problem, o.range.fix);
      return undefined;
    }
    return n;
  };

  const readYesNo = (column: string): boolean | null | undefined => {
    const v = raw(column);
    if (v === null) return null;
    const s = String(v).trim().toUpperCase();
    if (s === "YES") return true;
    if (s === "NO") return false;
    add("error", column, "Must be YES or NO.", "Pick YES or NO from the dropdown.");
    return undefined;
  };

  const readAction = (column: string): string | null | undefined => {
    const v = raw(column);
    if (v === null) return null;
    const mapped = ACTION_MAP[String(v).trim().toLowerCase()];
    if (!mapped) {
      add(
        "error",
        column,
        `Unknown mechanism '${String(v)}'.`,
        "Use Spring, PCP, CO2, Gas-Ram, Multi-Pump or N/A.",
      );
      return undefined;
    }
    return mapped;
  };

  const readLoyaltyRule = (column: string): string | null | undefined => {
    const v = raw(column);
    if (v === null) return null;
    const mapped = LOYALTY_RULE_MAP[String(v).trim().toLowerCase()];
    if (!mapped) {
      add(
        "error",
        column,
        "Not a loyalty rule.",
        "Use Standard, Boosted, Fixed or No points.",
      );
      return undefined;
    }
    return mapped;
  };

  const readDay = (
    column: string,
    edge: "start" | "end",
  ): string | null | undefined => {
    const v = raw(column);
    if (v === null) return null;
    const day = parseImportDay(v);
    if (day === null) {
      add("error", column, "Not a date.", "Type the date as 2026-10-31.");
      return undefined;
    }
    return edge === "start" ? dubaiDayStartIso(day) : dubaiDayEndIso(day);
  };

  const readStatus = (column: string): PublishStatusValue | null | undefined => {
    const v = raw(column);
    if (v === null) return null;
    const s = String(v).trim().toUpperCase();
    const found = STATUS_VALUES.find((x) => x === s);
    if (!found) {
      add(
        "error",
        column,
        `Unknown status '${String(v)}'.`,
        "Use DRAFT, PUBLISHED or ARCHIVED, or leave it empty.",
      );
      return undefined;
    }
    return found;
  };

  const readTags = (column: string): string[] | null | undefined => {
    const v = raw(column);
    if (v === null) return null;
    const tags = Array.from(
      new Set(
        String(v)
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      ),
    );
    if (tags.length === 0) return null;
    if (tags.some((t) => t.length > 100)) {
      add("error", column, "A tag is longer than 100 characters.", "Shorten or split it.");
      return undefined;
    }
    return tags;
  };

  const readField = (column: string, kind: FieldKind): unknown => {
    switch (kind.t) {
      case "text":
        return readText(column, kind.max);
      case "num":
        return readNum(column, kind.o);
      case "yn":
        return readYesNo(column);
      case "action":
        return readAction(column);
      case "loyaltyRule":
        return readLoyaltyRule(column);
      case "day":
        return readDay(column, kind.edge);
      case "status":
        return readStatus(column);
      case "tags":
        return readTags(column);
    }
  };

  return {
    raw,
    add,
    errCols,
    errorCount: () => errorCount,
    readText,
    readNum,
    readField,
  };
}

type Entry = {
  sku: string;
  row: number;
  action: "create" | "update";
  id: string | null;
  name: string;
  publishStatus: PublishStatusValue;
  openingStock: number | null;
  fields: ImportFieldChange[];
  changed: Partial<UpdateProductInput>;
  before: Record<string, unknown>;
  createData: Omit<CreateProductInput, "openingStock"> | null;
};

type SpecResult = {
  rows: CatalogImportSpecRow[];
  changed: boolean;
  beforeStrings: string[];
  afterStrings: string[];
};

function compareSpecRows(
  a: { displayOrder: number; labelEn: string },
  b: { displayOrder: number; labelEn: string },
): number {
  if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
  return a.labelEn < b.labelEn ? -1 : a.labelEn > b.labelEn ? 1 : 0;
}

function normalizeSpecs(rows: Omit<CatalogImportSpecRow, "productSku">[]) {
  return [...rows].sort(compareSpecRows).map((r) => ({
    labelEn: r.labelEn,
    labelAr: r.labelAr,
    labelRu: r.labelRu ?? null,
    valueEn: r.valueEn,
    valueAr: r.valueAr,
    valueRu: r.valueRu ?? null,
    displayOrder: r.displayOrder,
  }));
}

const rowCount = (n: number) => `${n} ${n === 1 ? "row" : "rows"}`;

const specStrings =(rows: { labelEn: string; valueEn: string }[]) =>
  rows.map((r) => `${r.labelEn}: ${r.valueEn}`);

type ImageResult = {
  rows: CatalogImportImageRow[];
  changed: boolean;
  beforeLines: string[];
  afterLines: string[];
};

const imageLine = (r: {
  displayOrder: number;
  filename: string;
  altTextEn: string | null;
  altTextAr: string | null;
  altTextRu: string | null;
}) => {
  const alts = [r.altTextEn, r.altTextAr, r.altTextRu].filter(Boolean);
  return `${r.displayOrder}. ${r.filename}${alts.length > 0 ? ` — ${alts.join(" / ")}` : ""}`;
};

type AccessoryResult = {
  rows: { accessorySku: string; displayOrder: number }[];
  changed: boolean;
  beforeLines: string[];
  afterLines: string[];
};

const accessoryCountText = (n: number) => `${n} ${n === 1 ? "accessory" : "accessories"}`;

const imageCount = (n: number) => `${n} ${n === 1 ? "image" : "images"}`;

const IMAGE_ORDER_RANGE = {
  test: (n: number) => n >= 1 && n <= 8,
  problem: "Must be a whole number from 1 to 8.",
  fix: "Use 1 to 8. Position 1 is the main image.",
};

export async function planCatalogImport(
  parsed: ParsedWorkbook,
  client: Prisma.TransactionClient,
  fileName: string,
  fileHash: string,
  images: CatalogImportImageFile[] = [],
): Promise<CatalogImportPlan> {
  const issues: ImportIssue[] = [];

  const allProducts = await client.product.findMany({
    select: { id: true, sku: true, slugEn: true, deletedAt: true },
  });

  const wantedSkus = new Set<string>();
  for (const r of parsed.rows.Products) {
    const v = r.cells.sku;
    if (v !== null && v !== undefined) wantedSkus.add(String(v).trim());
  }
  for (const r of parsed.rows.Specs) {
    const v = r.cells.product_sku;
    if (v !== null && v !== undefined) wantedSkus.add(String(v).trim());
  }
  const imageRowsBySku = new Map<string, number>();
  for (const r of parsed.rows.Images) {
    const v = r.cells.product_sku;
    if (v === null || v === undefined) continue;
    const sku = String(v).trim();
    wantedSkus.add(sku);
    imageRowsBySku.set(sku, (imageRowsBySku.get(sku) ?? 0) + 1);
  }
  const accessoryListSkus = new Set<string>();
  for (const r of parsed.rows.Accessory_Links) {
    const v = r.cells.product_sku;
    if (v !== null && v !== undefined) {
      const sku = String(v).trim();
      wantedSkus.add(sku);
      accessoryListSkus.add(sku);
    }
    const a = r.cells.accessory_sku;
    if (a !== null && a !== undefined) wantedSkus.add(String(a).trim());
  }
  const currentList = await client.product.findMany({
    where: { sku: { in: [...wantedSkus] } },
    select: { ...CURRENT_SELECT, deletedAt: true },
  });
  const currentBySku = new Map(
    currentList.filter((p) => p.deletedAt === null).map((p) => [p.sku, p]),
  );

  const currentAccessoryRows = await client.productAccessory.findMany({
    where: { productSku: { in: [...accessoryListSkus] } },
    select: {
      productSku: true,
      accessorySku: true,
      displayOrder: true,
      accessory: { select: { nameEn: true } },
    },
  });
  const existingAccessoriesBySku = new Map<string, typeof currentAccessoryRows>();
  for (const l of currentAccessoryRows) {
    const list = existingAccessoriesBySku.get(l.productSku);
    if (list) list.push(l);
    else existingAccessoriesBySku.set(l.productSku, [l]);
  }

  const categories = await client.category.findMany({
    where: { deletedAt: null },
    select: { id: true, slug: true, isVisible: true, navGroup: true, parentId: true },
  });
  const slugById = new Map(categories.map((c) => [c.id, c.slug]));
  const brands = await client.brand.findMany({
    where: { deletedAt: null },
    select: { id: true, nameEn: true, nameAr: true, nameRu: true, slug: true },
  });
  const brandNameById = new Map(brands.map((b) => [b.id, b.nameEn]));
  const brandKey = (s: string) => s.trim().toLowerCase();
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const isRiflesCategory = (categoryId: string): boolean => {
    const cat = categoryById.get(categoryId);
    if (!cat) return false;
    const rootNavGroup = cat.parentId
      ? (categoryById.get(cat.parentId)?.navGroup ?? null)
      : cat.navGroup;
    return rootNavGroup === "RIFLES";
  };

  const productBySku = new Map(allProducts.map((p) => [p.sku, p]));
  const productByLower = new Map(allProducts.map((p) => [p.sku.toLowerCase(), p]));
  const productBySlug = new Map(allProducts.map((p) => [p.slugEn, p]));

  const productSheetSkus = new Set<string>();
  const seenSkus = new Map<string, number>();
  const claimedSlugs = new Map<string, number>();
  const entries: Entry[] = [];

  for (const pr of parsed.rows.Products) {
    const rawSku = pr.cells.sku ?? null;
    const skuText = rawSku === null ? null : String(rawSku).trim() || null;
    const t = rowTools("Products", pr.row, skuText, pr.cells, issues);
    const { raw, add, errCols } = t;

    if (skuText) productSheetSkus.add(skuText);

    const values: Record<string, unknown> = {};
    const filled = new Set<string>();
    for (const def of PRODUCT_FIELDS) {
      const v = t.readField(def.column, def.kind);
      if (v === undefined || v === null) continue;
      values[def.field] = v;
      filled.add(def.field);
    }

    const openingStock = t.readNum("opening_stock", {
      int: true,
      range: minRange(0),
    });

    let skuOk = false;
    let existing: CurrentProduct | null = null;
    if (skuText === null) {
      add("error", "sku", "SKU is missing.", "Every product row needs a SKU.");
    } else if (!SKU_RE.test(skuText) || skuText.length > 64) {
      add(
        "error",
        "sku",
        "SKU can only use letters, digits and . _ - (up to 64 characters).",
        "Remove spaces and other symbols.",
      );
    } else {
      skuOk = true;
      if (/[a-z]/.test(skuText)) {
        add(
          "warning",
          "sku",
          "SKU has lowercase letters.",
          "SKUs are uppercase by convention. It is saved exactly as typed.",
        );
      }
      const lower = skuText.toLowerCase();
      const earlier = seenSkus.get(lower);
      if (earlier !== undefined) {
        add("error", "sku", `This SKU is also on row ${earlier}.`, "Keep one row per product.");
        skuOk = false;
      } else {
        seenSkus.set(lower, pr.row);
      }
      const exact = productBySku.get(skuText);
      if (exact) {
        if (exact.deletedAt) {
          add(
            "error",
            "sku",
            "This SKU belongs to a deleted product.",
            "SKUs are never reused. Choose a new SKU.",
          );
          skuOk = false;
        } else {
          existing = currentBySku.get(skuText) ?? null;
        }
      } else {
        const ci = productByLower.get(lower);
        if (ci) {
          add(
            "error",
            "sku",
            `Matches the existing SKU '${ci.sku}' except for letter case.`,
            "Use the existing SKU exactly, or choose a different SKU.",
          );
          skuOk = false;
        }
      }
    }

    const catRaw = raw("category_slug");
    let categoryId: string | undefined;
    if (catRaw !== null) {
      const slug = String(catRaw).trim().toLowerCase();
      const matches = categories.filter((c) => c.slug === slug);
      if (matches.length === 0) {
        add(
          "error",
          "category_slug",
          "No category with this slug.",
          "Use a slug from the Categories sheet, or add the category in Catalog › Categories first.",
        );
      } else if (matches.length > 1) {
        add(
          "error",
          "category_slug",
          `Two categories use the slug '${slug}'.`,
          "Rename one of them in Catalog › Categories.",
        );
      } else {
        categoryId = matches[0].id;
        if (!matches[0].isVisible) {
          add(
            "warning",
            "category_slug",
            `Category '${slug}' is hidden in the store.`,
            "Products in it aren't listed until the category is shown.",
          );
        }
      }
    }

    const brandRaw = raw("brand");
    let brandId: string | undefined;
    if (brandRaw !== null) {
      const typed = String(brandRaw).trim();
      const key = brandKey(typed);
      const matches = brands.filter((b) =>
        [b.nameEn, b.nameAr, b.nameRu, b.slug].some(
          (v) => v !== null && brandKey(v) === key,
        ),
      );
      if (matches.length === 0) {
        add(
          "error",
          "brand",
          "No brand with this name.",
          "Use a brand from Catalog › Brands, or add it there first.",
        );
      } else if (matches.length > 1) {
        add(
          "error",
          "brand",
          `Two brands match '${typed}'.`,
          "Use the brand's web handle instead.",
        );
      } else {
        brandId = matches[0].id;
      }
    }

    const slugRaw = t.readText("slug_en");
    let slugEn: string | undefined;
    const action: "create" | "update" = existing ? "update" : "create";

    if (openingStock !== null && openingStock !== undefined && existing) {
      add(
        "warning",
        "opening_stock",
        "Ignored because the product already exists.",
        "Change its stock in the product's Inventory panel.",
      );
    }

    if (skuOk && skuText) {
      if (slugRaw !== null && slugRaw !== undefined) {
        if (!SLUG_RE.test(slugRaw) || slugRaw.length > 200) {
          add(
            "error",
            "slug_en",
            "URL handle can only use lowercase letters, digits and single hyphens.",
            "Example: halvard-ridgeline-34-air-rifle.",
          );
        } else {
          const owner = productBySlug.get(slugRaw);
          const claimed = claimedSlugs.get(slugRaw);
          if (owner && owner.sku !== skuText) {
            add(
              "error",
              "slug_en",
              `This URL handle is used by SKU ${owner.sku}.`,
              "Choose a different handle, or leave it empty on a new product to generate one.",
            );
          } else if (claimed !== undefined) {
            add(
              "error",
              "slug_en",
              `This URL handle is also on row ${claimed}.`,
              "Choose a different handle, or leave it empty on a new product to generate one.",
            );
          } else {
            slugEn = slugRaw;
            if (existing && slugRaw !== existing.slugEn) {
              add(
                "warning",
                "slug_en",
                `Changes the live URL from /${existing.slugEn} to /${slugRaw}.`,
                "Old links to this product will stop working.",
              );
            }
          }
        }
      } else if (slugRaw === null && action === "create") {
        const nameRaw = raw("name_en");
        if (nameRaw !== null) {
          const base = slugFromName(String(nameRaw));
          if (base === "") {
            add("error", "slug_en", "Can't make a URL handle from name_en.", "Fill slug_en.");
          } else {
            const taken = (s: string) => productBySlug.has(s) || claimedSlugs.has(s);
            let candidate = base;
            for (let n = 2; taken(candidate); n++) {
              candidate = slugWithSuffix(base, n);
            }
            slugEn = candidate;
          }
        }
      }
      if (slugEn) claimedSlugs.set(slugEn, pr.row);
    }

    if (!skuOk || !skuText) continue;

    const finalLoyaltyRule =
      (values.loyaltyRule as string | undefined) ??
      existing?.loyaltyRule ??
      "STANDARD";
    if (
      typeof values.loyaltyPointsEarn === "number" &&
      values.loyaltyPointsEarn > 0 &&
      finalLoyaltyRule !== "FIXED"
    ) {
      add(
        "error",
        "loyalty_points_earn",
        "Fixed points only apply when the loyalty rule is Fixed.",
        "Set loyalty_rule to Fixed, or clear this cell.",
      );
    }
    if (values.loyaltyMultiplier !== undefined && finalLoyaltyRule !== "BOOSTED") {
      add(
        "error",
        "loyalty_multiplier",
        "A multiplier only applies when the loyalty rule is Boosted.",
        "Set loyalty_rule to Boosted, or clear this cell.",
      );
    }
    if (finalLoyaltyRule !== "BOOSTED" && finalLoyaltyRule !== "FIXED") {
      for (const [field, column] of [
        ["loyaltyRuleStartsAt", "loyalty_starts"],
        ["loyaltyRuleEndsAt", "loyalty_ends"],
      ] as const) {
        if (values[field] !== undefined) {
          add(
            "error",
            column,
            "Dates only apply to Boosted or Fixed.",
            "Clear this cell, or change the rule.",
          );
        }
      }
    }

    if (action === "create") {
      for (const column of REQUIRED_ON_CREATE) {
        if (raw(column) === null) {
          add(
            "error",
            column,
            "Required for a new product.",
            "Fill this cell, or check the SKU if you meant to update an existing product.",
          );
        }
      }
    }

    const input: Record<string, unknown> =
      action === "create" ? { sku: skuText, ...values } : { ...currentInput(existing!), ...values };
    if (categoryId !== undefined) input.categoryId = categoryId;
    if (brandId !== undefined) input.brandId = brandId;
    if (slugEn !== undefined) input.slugEn = slugEn;
    if (action === "create" && openingStock !== null && openingStock !== undefined) {
      input.openingStock = openingStock;
    }

    const result =
      action === "create"
        ? CreateProductSchema.safeParse(input)
        : UpdateProductSchema.safeParse(input);

    if (!result.success) {
      for (const zi of result.error.issues) {
        const field = typeof zi.path[0] === "string" ? zi.path[0] : null;
        if (field && input[field] === undefined && t.errorCount() > 0) continue;
        const column = field ? (COLUMN_FOR_FIELD[field] ?? field) : null;
        if (column && errCols.has(column)) continue;
        if (field === "compareAtPrice" && zi.code === "custom") {
          add(
            "error",
            column,
            `Was-price must be higher than the selling price (${formatImportValue(input.price)}).`,
            "Raise the was-price or leave it empty.",
          );
        } else if (field === "maxOrderQty" && zi.code === "custom") {
          add(
            "error",
            column,
            `Maximum per order is below the minimum (${formatImportValue(input.minOrderQty ?? 1)}).`,
            "Raise max_order_qty or leave it empty.",
          );
        } else {
          add("error", column, zi.message, null);
        }
      }
      continue;
    }

    if (t.errorCount() > 0) continue;

    if (action === "create") {
      const out = result.data as CreateProductInput;
      const { openingStock: stock, ...rawData } = out;
      const data = normalizeLoyaltyRuleFields(rawData);
      if (out.publishStatus === "PUBLISHED" && !imageRowsBySku.has(skuText)) {
        add(
          "warning",
          null,
          "Published with no images yet.",
          "The store shows the placeholder image until images are added.",
        );
      }
      entries.push({
        sku: skuText,
        row: pr.row,
        action,
        id: null,
        name: out.nameEn,
        publishStatus: out.publishStatus,
        openingStock: stock,
        fields: [],
        changed: {},
        before: {},
        createData: data,
      });
    } else {
      const out = result.data as UpdateProductInput;
      const outRec = normalizeLoyaltyRuleFields(out) as unknown as Record<
        string,
        unknown
      >;
      const cur = currentInput(existing!);
      const changed: Record<string, unknown> = {};
      const before: Record<string, unknown> = {};
      const fields: ImportFieldChange[] = [];
      const touched = new Set(filled);
      if (categoryId !== undefined) touched.add("categoryId");
      if (brandId !== undefined) touched.add("brandId");
      if (slugEn !== undefined) touched.add("slugEn");
      if (LOYALTY_FIELDS.some((f) => filled.has(f))) {
        for (const f of LOYALTY_FIELDS) touched.add(f);
      }
      for (const field of touched) {
        const a = cur[field];
        const b = outRec[field];
        if (JSON.stringify(a) === JSON.stringify(b)) continue;
        changed[field] = b;
        before[field] = a;
        fields.push(describeFieldChange(field, a, b, slugById, brandNameById));
      }
      entries.push({
        sku: skuText,
        row: pr.row,
        action,
        id: existing!.id,
        name: out.nameEn,
        publishStatus: out.publishStatus,
        openingStock: null,
        fields,
        changed: changed as Partial<UpdateProductInput>,
        before,
        createData: null,
      });
    }
  }

  const entryBySku = new Map(entries.map((e) => [e.sku, e]));

  const specGroups = new Map<string, ParsedRow[]>();
  for (const sr of parsed.rows.Specs) {
    const v = sr.cells.product_sku ?? null;
    const sku = v === null ? null : String(v).trim() || null;
    if (sku === null) {
      const t = rowTools("Specs", sr.row, null, sr.cells, issues);
      t.add("error", "product_sku", "SKU is missing.", "Every spec row needs a product_sku.");
      continue;
    }
    const list = specGroups.get(sku);
    if (list) list.push(sr);
    else specGroups.set(sku, [sr]);
  }

  const specResults = new Map<string, SpecResult>();
  const specOrder: string[] = [];

  for (const [sku, group] of specGroups) {
    const known = currentBySku.has(sku) || productSheetSkus.has(sku);
    if (!known) {
      for (const sr of group) {
        const t = rowTools("Specs", sr.row, sku, sr.cells, issues);
        t.add(
          "error",
          "product_sku",
          "No product with this SKU in the store or in the Products sheet.",
          "Check the SKU, or add the product to the Products sheet.",
        );
      }
      continue;
    }

    let groupErrors = 0;
    const built: CatalogImportSpecRow[] = [];
    const seenLabels = new Map<string, number>();

    group.forEach((sr, index) => {
      const t = rowTools("Specs", sr.row, sku, sr.cells, issues);

      if (index >= MAX_PRODUCT_SPEC_ROWS) {
        t.add(
          "error",
          "product_sku",
          `A product can have at most ${MAX_PRODUCT_SPEC_ROWS} specifications.`,
          "Remove the extra rows for this product.",
        );
      }

      const labelEn = t.readText("label_en", 100);
      const labelAr = t.readText("label_ar", 100);
      const labelRu = t.readText("label_ru", 100);
      const valueEn = t.readText("value_en", 500);
      const valueAr = t.readText("value_ar", 500);
      const valueRu = t.readText("value_ru", 500);
      const order = t.readNum("display_order", { int: true, range: minRange(0) });

      for (const column of ["label_en", "label_ar", "value_en", "value_ar"]) {
        if (t.raw(column) === null) {
          t.add(
            "error",
            column,
            "Required.",
            "Fill label_en, label_ar, value_en and value_ar on every spec row.",
          );
        }
      }

      if (labelEn) {
        const key = labelEn.toLowerCase();
        const earlier = seenLabels.get(key);
        if (earlier !== undefined) {
          t.add(
            "error",
            "label_en",
            `'${labelEn}' is listed twice for this product (also row ${earlier}).`,
            "Keep one row per label.",
          );
        } else {
          seenLabels.set(key, sr.row);
        }
      }

      groupErrors += t.errorCount();
      if (t.errorCount() === 0 && labelEn && labelAr && valueEn && valueAr) {
        built.push({
          productSku: sku,
          labelEn,
          labelAr,
          labelRu: labelRu ?? null,
          valueEn,
          valueAr,
          valueRu: valueRu ?? null,
          displayOrder: order ?? index,
        });
      }
    });

    if (groupErrors > 0) continue;

    const current = currentBySku.get(sku);
    const currentRows = current ? current.specs : [];
    const sortedNew = [...built].sort(compareSpecRows);
    const sortedCurrent = [...currentRows].sort(compareSpecRows);
    const changed =
      JSON.stringify(normalizeSpecs(built)) !== JSON.stringify(normalizeSpecs(currentRows));
    specResults.set(sku, {
      rows: sortedNew,
      changed,
      beforeStrings: specStrings(sortedCurrent),
      afterStrings: specStrings(sortedNew),
    });
    specOrder.push(sku);
  }

  const skuRefProblem = (sku: string): { problem: string; fix: string } | null => {
    if (currentBySku.has(sku) || productSheetSkus.has(sku)) return null;
    const exact = productBySku.get(sku);
    if (exact?.deletedAt) {
      return {
        problem: "This SKU belongs to a deleted product.",
        fix: "SKUs are never reused. Use the SKU of a live product.",
      };
    }
    if (!exact) {
      const ci = productByLower.get(sku.toLowerCase());
      if (ci) {
        return {
          problem: `Matches the existing SKU '${ci.sku}' except for letter case.`,
          fix: "Use the existing SKU exactly.",
        };
      }
    }
    return {
      problem: "No product with this SKU in the store or in the Products sheet.",
      fix: "Check the SKU, or add the product to the Products sheet.",
    };
  };

  const imageByName = new Map(images.map((f) => [f.name, f]));
  const allowedImageExtensions = Object.values(IMPORT_IMAGE_TYPES).flat() as readonly string[];

  const checkImageFile = (
    t: ReturnType<typeof rowTools>,
    column: string,
    filename: string,
    gallery: { reuse: boolean } | null = null,
  ): boolean => {
    const ext = imageExtension(filename);
    const file = imageByName.get(filename);
    if (!IMPORT_IMAGE_NAME_RE.test(filename)) {
      t.add(
        "error",
        column,
        "File names can only use letters, digits and . _ - (no spaces).",
        "Rename the image file and this cell.",
      );
    } else if (ext === null || !allowedImageExtensions.includes(ext)) {
      t.add(
        "error",
        column,
        "Must be a JPG, PNG or WebP file.",
        "Use a file name ending in .jpg, .jpeg, .png or .webp.",
      );
    } else if (!file) {
      if (gallery?.reuse) return true;
      t.add(
        "error",
        column,
        "This file wasn't selected.",
        gallery
          ? "Select the image file together with the workbook, with exactly this name. Images already in this product's gallery don't need selecting again."
          : "Select the image file together with the workbook, with exactly this name.",
      );
    } else if (file.size < 1) {
      t.add("error", column, "This file is empty.", "Choose a valid image file.");
    } else if (file.size > MAX_PRODUCT_IMAGE_SIZE_BYTES) {
      t.add("error", column, "Larger than 5 MB.", "Use a smaller image.");
    } else if (file.type === null) {
      t.add(
        "error",
        column,
        "The content of this file isn't a JPG, PNG or WebP image.",
        "Export the image again as JPG, PNG or WebP.",
      );
    } else if (!typeMatchesExtension(file.type, filename)) {
      t.add(
        "error",
        column,
        "The file's content doesn't match its name.",
        "Export the image again in the format its name says, or rename it.",
      );
    } else {
      return true;
    }
    return false;
  };

  const usedImageNames = new Set<string>();
  const imageGroups = new Map<string, ParsedRow[]>();
  for (const ir of parsed.rows.Images) {
    const fv = ir.cells.filename ?? null;
    if (fv !== null && fv !== "#ERROR") usedImageNames.add(String(fv).trim());
    const v = ir.cells.product_sku ?? null;
    const sku = v === null ? null : String(v).trim() || null;
    if (sku === null) {
      const t = rowTools("Images", ir.row, null, ir.cells, issues);
      t.add("error", "product_sku", "SKU is missing.", "Every image row needs a product_sku.");
      continue;
    }
    const list = imageGroups.get(sku);
    if (list) list.push(ir);
    else imageGroups.set(sku, [ir]);
  }

  const imageResults = new Map<string, ImageResult>();
  const imageOrder: string[] = [];
  for (const [sku, group] of imageGroups) {
    const refProblem = skuRefProblem(sku);
    if (refProblem) {
      for (const ir of group) {
        const t = rowTools("Images", ir.row, sku, ir.cells, issues);
        t.add("error", "product_sku", refProblem.problem, refProblem.fix);
      }
      continue;
    }

    let groupErrors = 0;
    const built: CatalogImportImageRow[] = [];
    const seenOrders = new Map<number, number>();
    const seenFiles = new Map<string, number>();
    const currentGallery = currentBySku.get(sku)?.images ?? [];

    group.forEach((ir, index) => {
      const t = rowTools("Images", ir.row, sku, ir.cells, issues);

      if (index >= MAX_PRODUCT_IMAGES) {
        t.add(
          "error",
          "product_sku",
          `A product can have at most ${MAX_PRODUCT_IMAGES} images.`,
          "Remove the extra rows for this product.",
        );
      }

      const filename = t.readText("filename", 200);
      let reuseKey: string | null = null;
      if (filename && !imageByName.has(filename)) {
        reuseKey =
          currentGallery.find((g) => g.filename === filename && g.storageKey !== null)
            ?.storageKey ?? null;
      }
      if (t.raw("filename") === null) {
        t.add("error", "filename", "Required.", "Fill filename on every image row.");
      } else if (
        filename &&
        checkImageFile(t, "filename", filename, { reuse: reuseKey !== null })
      ) {
        const earlier = seenFiles.get(filename);
        if (earlier !== undefined) {
          t.add(
            "error",
            "filename",
            `'${filename}' is listed twice for this product (also row ${earlier}).`,
            "Keep one row per image.",
          );
        } else {
          seenFiles.set(filename, ir.row);
        }
      }

      const order = t.readNum("display_order", { int: true, range: IMAGE_ORDER_RANGE });
      if (t.raw("display_order") === null) {
        t.add("error", "display_order", "Required.", "Give every image a position from 1 to 8.");
      } else if (order !== null && order !== undefined) {
        const earlier = seenOrders.get(order);
        if (earlier !== undefined) {
          t.add(
            "error",
            "display_order",
            `Position ${order} is also used on row ${earlier}.`,
            "Give each image of a product its own position.",
          );
        } else {
          seenOrders.set(order, ir.row);
        }
      }

      const altTextEn = t.readText("alt_text_en", 300);
      const altTextAr = t.readText("alt_text_ar", 300);
      const altTextRu = t.readText("alt_text_ru", 300);

      groupErrors += t.errorCount();
      if (t.errorCount() === 0 && filename && order !== null && order !== undefined) {
        built.push({
          productSku: sku,
          filename,
          displayOrder: order,
          altTextEn: altTextEn ?? null,
          altTextAr: altTextAr ?? null,
          altTextRu: altTextRu ?? null,
          reuseKey,
        });
      }
    });

    if (groupErrors > 0) continue;

    const current = currentBySku.get(sku);
    const byOrder = (a: { displayOrder: number }, b: { displayOrder: number }) =>
      a.displayOrder - b.displayOrder;
    const sortedNew = [...built].sort(byOrder);
    const sortedCurrent = [...(current ? current.images : [])].sort(byOrder);
    const beforeLines = sortedCurrent.map(imageLine);
    const afterLines = sortedNew.map(imageLine);
    imageResults.set(sku, {
      rows: sortedNew,
      changed: JSON.stringify(beforeLines) !== JSON.stringify(afterLines),
      beforeLines,
      afterLines,
    });
    imageOrder.push(sku);
  }

  const changes: ImportChange[] = [];
  const writes: CatalogImportWrites = {
    creates: [],
    updates: [],
    specReplacements: [],
    imageReplacements: [],
    accessoryReplacements: [],
  };

  let create = 0;
  let update = 0;
  let unchanged = 0;

  const accessoryName = (sku: string) =>
    `${sku} ${entryBySku.get(sku)?.name ?? currentBySku.get(sku)?.nameEn ?? ""}`.trim();

  const accessoryGroups = new Map<string, ParsedRow[]>();
  for (const lr of parsed.rows.Accessory_Links) {
    const v = lr.cells.product_sku ?? null;
    const sku = v === null ? null : String(v).trim() || null;
    if (sku === null) {
      const t = rowTools("Accessory_Links", lr.row, null, lr.cells, issues);
      t.add("error", "product_sku", "SKU is missing.", "Every accessory row needs a product_sku.");
      continue;
    }
    const list = accessoryGroups.get(sku);
    if (list) list.push(lr);
    else accessoryGroups.set(sku, [lr]);
  }

  const accessoryResults = new Map<string, AccessoryResult>();
  const accessoryOrder: string[] = [];

  for (const [sku, group] of accessoryGroups) {
    const refProblem = skuRefProblem(sku);
    if (refProblem) {
      for (const lr of group) {
        const t = rowTools("Accessory_Links", lr.row, sku, lr.cells, issues);
        t.add("error", "product_sku", refProblem.problem, refProblem.fix);
      }
      continue;
    }

    let groupErrors = 0;
    const built: { accessorySku: string; order: number | null; row: number }[] = [];
    const seenPairs = new Map<string, number>();

    for (const lr of group) {
      const t = rowTools("Accessory_Links", lr.row, sku, lr.cells, issues);
      const accRaw = t.raw("accessory_sku");
      const accessorySku = accRaw === null ? null : String(accRaw).trim() || null;
      if (accessorySku === null) {
        t.add(
          "error",
          "accessory_sku",
          "Accessory SKU is missing.",
          "Every accessory row needs an accessory_sku.",
        );
      } else {
        const problem = skuRefProblem(accessorySku);
        const accEntry = entryBySku.get(accessorySku);
        const accCategoryId =
          accEntry?.createData?.categoryId ??
          (accEntry?.changed.categoryId as string | undefined) ??
          currentBySku.get(accessorySku)?.categoryId;
        const accStatus = accEntry?.publishStatus ?? currentBySku.get(accessorySku)?.publishStatus;
        if (problem) {
          t.add("error", "accessory_sku", problem.problem, problem.fix);
        } else if (accessorySku === sku) {
          t.add(
            "error",
            "accessory_sku",
            "A product can't be its own accessory.",
            "Link a different product.",
          );
        } else if (accCategoryId !== undefined && isRiflesCategory(accCategoryId)) {
          t.add(
            "error",
            "accessory_sku",
            "Rifles and pistols can't be linked as accessories.",
            "Choose a product outside the rifles and pistols categories.",
          );
        } else {
          const earlier = seenPairs.get(accessorySku);
          if (earlier !== undefined) {
            t.add(
              "error",
              "accessory_sku",
              `This accessory is already listed for this product (also row ${earlier}).`,
              "Keep one row per accessory.",
            );
          } else {
            seenPairs.set(accessorySku, lr.row);
            if (accStatus === "DRAFT" || accStatus === "ARCHIVED") {
              t.add(
                "warning",
                "accessory_sku",
                "Hidden on the store until it's published.",
                "Publish it when it's ready; the link stays.",
              );
            }
          }
        }
      }
      const order = t.readNum("display_order", { int: true, range: minRange(0) });
      groupErrors += t.errorCount();
      if (t.errorCount() === 0 && accessorySku && order !== undefined) {
        built.push({ accessorySku, order, row: lr.row });
      }
    }

    if (groupErrors > 0) continue;

    built.sort(
      (a, b) =>
        Number(a.order === null) - Number(b.order === null) ||
        (a.order ?? 0) - (b.order ?? 0) ||
        a.row - b.row,
    );
    const rows = built.map((b, i) => ({ accessorySku: b.accessorySku, displayOrder: i + 1 }));
    const currentLinks = [...(existingAccessoriesBySku.get(sku) ?? [])].sort(
      (a, b) =>
        a.displayOrder - b.displayOrder ||
        (a.accessorySku < b.accessorySku ? -1 : a.accessorySku > b.accessorySku ? 1 : 0),
    );
    accessoryResults.set(sku, {
      rows,
      changed:
        JSON.stringify(currentLinks.map((l) => l.accessorySku)) !==
        JSON.stringify(rows.map((r) => r.accessorySku)),
      beforeLines: currentLinks.map((l) => `${l.accessorySku} ${l.accessory.nameEn}`),
      afterLines: rows.map((r) => accessoryName(r.accessorySku)),
    });
    accessoryOrder.push(sku);
  }

  for (const e of entries) {
    const sp = specResults.get(e.sku);
    const specsChanged = sp?.changed ?? false;
    if (specsChanged && sp) writes.specReplacements.push({ sku: e.sku, rows: sp.rows });
    const im = imageResults.get(e.sku);
    const imagesChanged = im?.changed ?? false;
    if (imagesChanged && im) writes.imageReplacements.push({ sku: e.sku, rows: im.rows });
    const lk = accessoryResults.get(e.sku);
    const linksChanged = lk?.changed ?? false;
    if (linksChanged && lk) writes.accessoryReplacements.push({ sku: e.sku, rows: lk.rows });

    if (e.action === "create") {
      create++;
      changes.push({
        sku: e.sku,
        row: e.row,
        action: "create",
        name: e.name,
        publishStatus: e.publishStatus,
        openingStock: e.openingStock,
        fields: [],
        specRows: specsChanged && sp ? sp.rows.length : null,
        imageRows: imagesChanged && im ? im.rows.length : null,
        accessoryRows: linksChanged && lk ? lk.rows.length : null,
      });
      writes.creates.push({
        row: e.row,
        data: e.createData!,
        openingStock: e.openingStock ?? 0,
        specs: specsChanged && sp ? sp.rows : [],
        images: imagesChanged && im ? im.afterLines : [],
        accessories: linksChanged && lk ? lk.afterLines : [],
      });
      continue;
    }

    if (e.fields.length === 0 && !specsChanged && !imagesChanged && !linksChanged) {
      unchanged++;
      continue;
    }
    update++;
    const fields = [...e.fields];
    if (specsChanged && sp) {
      fields.push({
        column: "specs",
        from: rowCount(sp.beforeStrings.length),
        to: rowCount(sp.afterStrings.length),
      });
    }
    if (imagesChanged && im) {
      fields.push({
        column: "images",
        from: imageCount(im.beforeLines.length),
        to: imageCount(im.afterLines.length),
      });
    }
    if (linksChanged && lk) {
      fields.push({
        column: "accessories",
        from: accessoryCountText(lk.beforeLines.length),
        to: accessoryCountText(lk.afterLines.length),
      });
    }
    changes.push({
      sku: e.sku,
      row: e.row,
      action: "update",
      name: e.name,
      publishStatus: e.publishStatus,
      openingStock: null,
      fields,
      specRows: specsChanged && sp ? sp.rows.length : null,
      imageRows: imagesChanged && im ? im.rows.length : null,
      accessoryRows: linksChanged && lk ? lk.rows.length : null,
    });
    writes.updates.push({
      id: e.id!,
      sku: e.sku,
      row: e.row,
      changed: e.changed,
      before: e.before,
      specsBefore: specsChanged && sp ? sp.beforeStrings : null,
      specsAfter: specsChanged && sp ? sp.afterStrings : null,
      imagesBefore: imagesChanged && im ? im.beforeLines : null,
      imagesAfter: imagesChanged && im ? im.afterLines : null,
      accessoriesBefore: linksChanged && lk ? lk.beforeLines : null,
      accessoriesAfter: linksChanged && lk ? lk.afterLines : null,
    });
  }

  for (const sku of new Set([...specOrder, ...imageOrder, ...accessoryOrder])) {
    if (entryBySku.has(sku)) continue;
    const sp = specResults.get(sku);
    const im = imageResults.get(sku);
    const specsChanged = sp?.changed ?? false;
    const imagesChanged = im?.changed ?? false;
    const lk = accessoryResults.get(sku);
    const linksChanged = lk?.changed ?? false;
    if (!specsChanged && !imagesChanged && !linksChanged) continue;
    const current = currentBySku.get(sku);
    if (!current) continue;
    update++;
    const fields: ImportFieldChange[] = [];
    if (specsChanged && sp) {
      writes.specReplacements.push({ sku, rows: sp.rows });
      fields.push({
        column: "specs",
        from: rowCount(sp.beforeStrings.length),
        to: rowCount(sp.afterStrings.length),
      });
    }
    if (imagesChanged && im) {
      writes.imageReplacements.push({ sku, rows: im.rows });
      fields.push({
        column: "images",
        from: imageCount(im.beforeLines.length),
        to: imageCount(im.afterLines.length),
      });
    }
    if (linksChanged && lk) {
      writes.accessoryReplacements.push({ sku, rows: lk.rows });
      fields.push({
        column: "accessories",
        from: accessoryCountText(lk.beforeLines.length),
        to: accessoryCountText(lk.afterLines.length),
      });
    }
    changes.push({
      sku,
      row: null,
      action: "update",
      name: current.nameEn,
      publishStatus: current.publishStatus,
      openingStock: null,
      fields,
      specRows: specsChanged && sp ? sp.rows.length : null,
      imageRows: imagesChanged && im ? im.rows.length : null,
      accessoryRows: linksChanged && lk ? lk.rows.length : null,
    });
    writes.updates.push({
      id: current.id,
      sku,
      row: null,
      changed: {},
      before: {},
      specsBefore: specsChanged && sp ? sp.beforeStrings : null,
      specsAfter: specsChanged && sp ? sp.afterStrings : null,
      imagesBefore: imagesChanged && im ? im.beforeLines : null,
      imagesAfter: imagesChanged && im ? im.afterLines : null,
      accessoriesBefore: linksChanged && lk ? lk.beforeLines : null,
      accessoriesAfter: linksChanged && lk ? lk.afterLines : null,
    });
  }

  for (const f of images) {
    if (usedImageNames.has(f.name)) continue;
    issues.push({
      severity: "warning",
      sheet: null,
      row: null,
      column: null,
      sku: null,
      found: f.name,
      problem: "Selected but not listed on any sheet.",
      fix: "Remove it from the selection, or list it on the Images sheet.",
    });
  }

  const uploadByKey = new Map<string, CatalogImportUpload>();
  for (const g of writes.imageReplacements) {
    for (const r of g.rows) {
      if (r.reuseKey === null) {
        uploadByKey.set(`product:${r.filename}`, { name: r.filename, target: "product" });
      }
    }
  }
  const uploadPairs = [...uploadByKey.values()].sort(
    (a, b) =>
      (a.target < b.target ? -1 : a.target > b.target ? 1 : 0) ||
      (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
  );

  if (!issues.some((i) => i.severity === "error")) {
    const uploadNames = new Set(uploadPairs.map((u) => u.name));
    for (const f of images) {
      if (!usedImageNames.has(f.name) || uploadNames.has(f.name)) continue;
      issues.push({
        severity: "warning",
        sheet: null,
        row: null,
        column: null,
        sku: null,
        found: f.name,
        problem: "Selected, but nothing that uses it changed, so it isn't uploaded.",
        fix: "To replace a photo, give the new file a new name and list that name.",
      });
    }
  }

  const sheetRank = (s: string | null) => (s === "Products" ? 0 : s === "Specs" ? 1 : s === "Accessory_Links" ? 3 : 2);
  issues.sort(
    (a, b) =>
      sheetRank(a.sheet) - sheetRank(b.sheet) ||
      (a.row ?? 0) - (b.row ?? 0) ||
      (a.column ?? "").localeCompare(b.column ?? ""),
  );
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.length - errors;

  return {
    summary: {
      fileName,
      fileHash,
      refused: false,
      counts: {
        productRows: parsed.rows.Products.length,
        create,
        update,
        unchanged,
        specTables: writes.specReplacements.length,
        galleries: writes.imageReplacements.length,
        imageRows: parsed.rows.Images.length,
        accessoryLists: writes.accessoryReplacements.length,
        warnings,
        errors,
      },
      uploads: uploadPairs,
      issues: issues.slice(0, MAX_REPORTED_ISSUES),
      issuesTruncated: issues.length > MAX_REPORTED_ISSUES,
      changes,
    },
    writes,
  };
}

export async function recordFailedImport(
  client: typeof db,
  input: {
    batchId: string;
    staffId: string;
    fileName: string;
    fileHash: string;
    fileSizeBytes: number;
    storageKey: string | null;
    totalRows: number;
    errorCode: string;
    issues: ImportIssue[];
  },
): Promise<void> {
  const errorIssues = input.issues
    .filter((i) => i.severity === "error")
    .slice(0, MAX_REPORTED_ISSUES);

  await client.$transaction(
    async (tx) => {
      await tx.importBatch.create({
        data: {
          id: input.batchId,
          filename: input.fileName,
          uploadedById: input.staffId,
          status: "FAILED",
          totalRows: input.totalRows,
          successRows: 0,
          failedRows: input.totalRows,
          storageKey: input.storageKey,
          fileSha256: input.fileHash,
          fileSizeBytes: input.fileSizeBytes,
          completedAt: new Date(),
        },
      });

      if (errorIssues.length > 0) {
        await tx.importBatchError.createMany({
          data: errorIssues.map((i) => ({
            importBatchId: input.batchId,
            rowNumber: i.row,
            sheet: i.sheet,
            columnKey: i.column,
            sku: i.sku,
            message: i.problem,
            found: i.found,
            fix: i.fix,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          actorType: "STAFF",
          actorId: input.staffId,
          action: "catalog.import_failed",
          entityType: "ImportBatch",
          entityId: input.batchId,
          metadata: {
            filename: input.fileName,
            fileHash: input.fileHash,
            errorCode: input.errorCode,
            problems: errorIssues.length,
            fileStored: input.storageKey !== null,
          },
        },
      });
    },
    { isolationLevel: "Serializable" },
  );
}

export async function applyCatalogImport(
  tx: Prisma.TransactionClient,
  plan: CatalogImportPlan,
  ctx: {
    staffId: string;
    fileName: string;
    fileHash: string;
    batchId: string;
    storageKey: string;
    fileSizeBytes: number;
    imageKeys: Map<string, string>;
  },
): Promise<{ batchId: string }> {
  const { summary, writes } = plan;
  const { counts } = summary;

  const batch = await tx.importBatch.create({
    data: {
      id: ctx.batchId,
      filename: ctx.fileName,
      uploadedById: ctx.staffId,
      status: "COMPLETED",
      totalRows: counts.productRows,
      successRows: counts.create + counts.update + counts.unchanged,
      failedRows: 0,
      completedAt: new Date(),
      storageKey: ctx.storageKey,
      fileSha256: ctx.fileHash,
      fileSizeBytes: ctx.fileSizeBytes,
      createdCount: counts.create,
      updatedCount: counts.update,
      unchangedCount: counts.unchanged,
    },
    select: { id: true },
  });

  const createdIdBySku = new Map<string, string>();
  if (writes.creates.length > 0) {
    const created = await tx.product.createManyAndReturn({
      data: writes.creates.map((c) => ({
        ...c.data,
        stockQuantity: c.openingStock,
      })),
      select: { id: true, sku: true },
    });
    for (const p of created) createdIdBySku.set(p.sku, p.id);
  }

  const movements = writes.creates
    .filter((c) => c.openingStock > 0)
    .map((c) => ({
      productSku: c.data.sku,
      delta: c.openingStock,
      quantityBefore: 0,
      quantityAfter: c.openingStock,
      type: "IMPORT_ADJUSTMENT" as const,
      reason: "Opening stock from catalog import",
      reference: batch.id,
      staffId: ctx.staffId,
    }));
  if (movements.length > 0) {
    await tx.stockMovement.createMany({ data: movements });
  }

  for (const u of writes.updates) {
    if (Object.keys(u.changed).length === 0) continue;
    await tx.product.update({ where: { id: u.id }, data: u.changed });
  }

  if (writes.specReplacements.length > 0) {
    await tx.productSpec.deleteMany({
      where: { productSku: { in: writes.specReplacements.map((s) => s.sku) } },
    });
    await tx.productSpec.createMany({
      data: writes.specReplacements.flatMap((s) => s.rows),
    });
  }

  if (writes.imageReplacements.length > 0) {
    await tx.productImage.deleteMany({
      where: { productSku: { in: writes.imageReplacements.map((g) => g.sku) } },
    });
    await tx.productImage.createMany({
      data: writes.imageReplacements.flatMap((g) =>
        g.rows.map((r) => {
          const storageKey = r.reuseKey ?? ctx.imageKeys.get(`product:${r.filename}`);
          if (!storageKey) throw new Error("IMPORT_IMAGE_KEY_MISSING");
          return {
            productSku: r.productSku,
            filename: r.filename,
            storageKey,
            displayOrder: r.displayOrder,
            altTextEn: r.altTextEn,
            altTextAr: r.altTextAr,
            altTextRu: r.altTextRu,
          };
        }),
      ),
    });
  }

  if (writes.accessoryReplacements.length > 0) {
    await tx.productAccessory.deleteMany({
      where: { productSku: { in: writes.accessoryReplacements.map((g) => g.sku) } },
    });
    await tx.productAccessory.createMany({
      data: writes.accessoryReplacements.flatMap((g) =>
        g.rows.map((r) => ({
          productSku: g.sku,
          accessorySku: r.accessorySku,
          displayOrder: r.displayOrder,
        })),
      ),
    });
  }

  const auditRows: Prisma.AuditLogCreateManyInput[] = [];

  for (const c of writes.creates) {
    const id = createdIdBySku.get(c.data.sku);
    if (!id) throw new Error("IMPORT_CREATE_MISSING");
    const metadata: Record<string, unknown> = {
      importBatchId: batch.id,
      row: c.row,
    };
    if (c.specs.length > 0) metadata.specs = specStrings(c.specs);
    if (c.images.length > 0) metadata.images = c.images;
    if (c.accessories.length > 0) metadata.accessories = c.accessories;
    auditRows.push({
      actorType: "STAFF",
      actorId: ctx.staffId,
      action: "product.create",
      entityType: "Product",
      entityId: id,
      after: {
        ...c.data,
        stockQuantity: c.openingStock,
      } as Prisma.InputJsonValue,
      metadata: metadata as Prisma.InputJsonValue,
    });
  }

  for (const u of writes.updates) {
    const before: Record<string, unknown> = { ...u.before };
    const after: Record<string, unknown> = { ...u.changed };
    if (u.specsBefore && u.specsAfter) {
      before.specs = u.specsBefore;
      after.specs = u.specsAfter;
    }
    if (u.imagesBefore && u.imagesAfter) {
      before.images = u.imagesBefore;
      after.images = u.imagesAfter;
    }
    if (u.accessoriesBefore && u.accessoriesAfter) {
      before.accessories = u.accessoriesBefore;
      after.accessories = u.accessoriesAfter;
    }
    auditRows.push({
      actorType: "STAFF",
      actorId: ctx.staffId,
      action: "product.update",
      entityType: "Product",
      entityId: u.id,
      before: before as Prisma.InputJsonValue,
      after: after as Prisma.InputJsonValue,
      metadata: { importBatchId: batch.id, row: u.row },
    });
  }

  if (auditRows.length > 0) {
    await tx.auditLog.createMany({ data: auditRows });
  }

  await tx.auditLog.create({
    data: {
      actorType: "STAFF",
      actorId: ctx.staffId,
      action: "catalog.import",
      entityType: "ImportBatch",
      entityId: batch.id,
      metadata: {
        filename: ctx.fileName,
        fileHash: ctx.fileHash,
        created: counts.create,
        updated: counts.update,
        unchanged: counts.unchanged,
        specTables: counts.specTables,
        galleries: counts.galleries,
        imageRows: counts.imageRows,
        accessoryLists: counts.accessoryLists,
      },
    },
  });

  return { batchId: batch.id };
}

const PRODUCT_IMAGES_BUCKET = "product-images";
const IMPORT_UPLOAD_ID_RE = /^[0-9a-f-]{36}$/;
const IMPORT_IMAGE_KEY_TAIL_RE = /^[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/;
const IMPORT_IMAGE_VERIFY_CONCURRENCY = 8;

export async function verifyImportImages(
  uploadId: string,
  manifest: {
    name: string;
    key: string;
    size: number;
    type: ImportImageType;
    target: ImportImageTarget;
  }[],
): Promise<string[]> {
  if (!IMPORT_UPLOAD_ID_RE.test(uploadId)) return [...new Set(manifest.map((m) => m.name))];

  const prefix = `catalog/${uploadId}/`;
  const listed = await listFiles(PRODUCT_IMAGES_BUCKET, `catalog/${uploadId}`);
  const listedByName = new Map(listed.map((f) => [f.name, f]));
  const failed = new Set<string>();

  const check = async (item: (typeof manifest)[number]): Promise<void> => {
    const tail = item.key.startsWith(prefix) ? item.key.slice(prefix.length) : null;
    if (tail === null || !IMPORT_IMAGE_KEY_TAIL_RE.test(tail)) {
      failed.add(item.name);
      return;
    }
    const object = listedByName.get(item.key);
    if (!object || object.size !== item.size || object.mimetype !== item.type) {
      failed.add(item.name);
      return;
    }
    try {
      const head = await readPublicObjectHead(PRODUCT_IMAGES_BUCKET, item.key, 16);
      if (sniffImageType(head) !== item.type) failed.add(item.name);
    } catch {
      failed.add(item.name);
    }
  };

  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < manifest.length) {
      await check(manifest[next++]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(IMPORT_IMAGE_VERIFY_CONCURRENCY, manifest.length) }, worker),
  );

  return [...new Set(manifest.filter((m) => failed.has(m.name)).map((m) => m.name))];
}

export async function discardImportImages(
  uploadId: string,
  keep: { bucket: string; key: string }[],
): Promise<void> {
  if (!IMPORT_UPLOAD_ID_RE.test(uploadId)) return;
  try {
    const listed = await listFiles(PRODUCT_IMAGES_BUCKET, `catalog/${uploadId}`);
    const keepKeys = new Set(
      keep.filter((k) => k.bucket === PRODUCT_IMAGES_BUCKET).map((k) => k.key),
    );
    await deleteFiles(
      PRODUCT_IMAGES_BUCKET,
      listed.map((f) => f.name).filter((name) => !keepKeys.has(name)),
    );
  } catch (err) {
    console.error("[discardImportImages]", PRODUCT_IMAGES_BUCKET, err);
  }
}
