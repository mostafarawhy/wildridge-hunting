import { z } from "zod";
import { LOYALTY_EARN_RULES } from "@/lib/utils/loyalty-points";

export const MAX_PRODUCT_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_MANUAL_IMAGE_SIZE_BYTES = 4 * 1024 * 1024;
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const MAX_PRODUCT_IMAGES = 8;
export const mimeToExt: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const ACTION_TYPE_VALUES = [
  "Spring",
  "PCP",
  "CO2",
  "Gas_Ram",
  "Multi_Pump",
  "NA",
] as const;

export const PUBLISH_STATUS_VALUES = ["PUBLISHED", "DRAFT", "ARCHIVED"] as const;

// blank / null / undefined → null; otherwise Number(v)
function optDecimal(min?: number, max?: number) {
  let n: z.ZodNumber = z.number();
  if (min !== undefined) n = n.min(min);
  if (max !== undefined) n = n.max(max);
  return z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    n.nullable(),
  );
}

// blank / null / undefined → null; otherwise Math.trunc(Number(v))
function optInt(min?: number, max?: number) {
  let n: z.ZodNumber = z.number().int();
  if (min !== undefined) n = n.min(min);
  if (max !== undefined) n = n.max(max);
  return z.preprocess(
    (v) => (v === "" || v == null ? null : Math.trunc(Number(v))),
    n.nullable(),
  );
}

// blank / null / undefined → null; trim, empty-after-trim → null
function optStr(maxLen?: number) {
  let s: z.ZodString = z.string();
  if (maxLen !== undefined) s = s.max(maxLen);
  return z.preprocess((v) => {
    if (v == null) return null;
    const str = (typeof v === "string" ? v : String(v)).trim();
    return str === "" ? null : str;
  }, s.nullable());
}

const LOYALTY_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

function optMultiplier() {
  const message = "Enter a multiplier from 1.1 to 10, one decimal.";
  return z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z
      .number({ error: message })
      .min(1.1, message)
      .max(10, message)
      .refine((n) => Math.abs(n * 10 - Math.round(n * 10)) < 1e-9, message)
      .nullable(),
  );
}

function optInstant() {
  return z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z
      .string()
      .regex(LOYALTY_INSTANT, "Enter a valid date.")
      .refine((v) => !Number.isNaN(new Date(v).getTime()), "Enter a valid date.")
      .nullable(),
  );
}

const ProductBaseObject = z.object({
  nameEn: z.string().trim().min(1, "English name is required").max(200),
  nameAr: z.string().trim().min(1, "Arabic name is required").max(200),
  nameRu: optStr(200),
  slugEn: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(200)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be lowercase with hyphens only",
    ),
  brandId: z.string().trim().min(1, "Brand is required"),
  actionType: z.enum(ACTION_TYPE_VALUES, { error: "Choose an action type." }),
  caliberMm: optDecimal(0.1, 30),
  descriptionEn: optStr(),
  descriptionAr: optStr(),
  descriptionRu: optStr(),
  categoryId: z.string().min(1, "Category is required"),
  tags: z.array(z.string().trim().min(1).max(100)).default([]),
  price: z.coerce.number().positive("Price must be positive").max(9_999_999),
  compareAtPrice: optDecimal(0.01, 9_999_999),
  lowStockThreshold: z.coerce.number().int().min(0).default(5),
  weightGrams: optInt(1),
  requiresIdVerification: z.boolean().default(false),
  supportsAddons: z.boolean().default(false),
  b2bAvailable: z.boolean().default(false),
  minOrderQty: z.coerce.number().int().min(1).default(1),
  maxOrderQty: optInt(1),
  isNewArrival: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  sortOrder: optInt(),
  loyaltyRule: z
    .enum(LOYALTY_EARN_RULES, { error: "Choose an earning rule." })
    .default("STANDARD"),
  loyaltyMultiplier: optMultiplier(),
  loyaltyPointsEarn: z.coerce.number().int().min(0).max(100000).default(0),
  loyaltyRuleStartsAt: optInstant(),
  loyaltyRuleEndsAt: optInstant(),
  publishStatus: z.enum(PUBLISH_STATUS_VALUES).default("DRAFT"),
  metaTitleEn: optStr(60),
  metaTitleAr: optStr(60),
  metaTitleRu: optStr(60),
  metaDescriptionEn: optStr(160),
  metaDescriptionAr: optStr(160),
  metaDescriptionRu: optStr(160),
  internalNotes: optStr(),
});

type BaseData = z.infer<typeof ProductBaseObject>;

function withProductRefinements<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T,
): T {
  return schema.superRefine((data, ctx) => {
    const d = data as BaseData;

    if (d.compareAtPrice != null && d.compareAtPrice <= d.price) {
      ctx.addIssue({
        code: "custom",
        path: ["compareAtPrice"],
        message: "Compare-at price must be greater than the selling price.",
      });
    }

    if (d.maxOrderQty != null && d.maxOrderQty < d.minOrderQty) {
      ctx.addIssue({
        code: "custom",
        path: ["maxOrderQty"],
        message: "Max order qty must be \u2265 min order qty.",
      });
    }

    if (d.loyaltyRule === "BOOSTED" && d.loyaltyMultiplier == null) {
      ctx.addIssue({
        code: "custom",
        path: ["loyaltyMultiplier"],
        message: "Enter a multiplier from 1.1 to 10.",
      });
    }

    if (d.loyaltyRule === "FIXED" && d.loyaltyPointsEarn < 1) {
      ctx.addIssue({
        code: "custom",
        path: ["loyaltyPointsEarn"],
        message: "Enter points per unit from 1 to 100,000.",
      });
    }

    if (
      d.loyaltyRuleStartsAt != null &&
      d.loyaltyRuleEndsAt != null &&
      new Date(d.loyaltyRuleEndsAt) <= new Date(d.loyaltyRuleStartsAt)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["loyaltyRuleEndsAt"],
        message: "The end date must be after the start date.",
      });
    }
  }) as unknown as T;
}

const SerialTrackingSchema = z.enum(["NONE", "SERIAL", "LOT"]).default("NONE");

export const ProductBaseSchema = withProductRefinements(ProductBaseObject);

export const CreateProductSchema = withProductRefinements(
  ProductBaseObject.extend({
    sku: z
      .string()
      .trim()
      .min(1, "SKU is required")
      .max(64)
      .regex(
        /^[A-Za-z0-9._-]+$/,
        "SKU may only contain letters, digits, . _ -",
      ),
    openingStock: z.coerce.number().int().min(0).default(0),
    serialTracking: SerialTrackingSchema,
  }),
);

export const UpdateProductSchema = ProductBaseSchema;

export const ProductDetailsUpdateSchema = withProductRefinements(
  ProductBaseObject.omit({ publishStatus: true }).extend({
    serialTracking: SerialTrackingSchema,
  }),
);

export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;

export const MAX_PRODUCT_SPEC_ROWS = 40;
export const MAX_SPEC_LABEL_LEN = 100;
export const MAX_SPEC_VALUE_LEN = 500;

const specRowSchema = z.object({
  labelEn: z.string().trim().min(1, "Required.").max(MAX_SPEC_LABEL_LEN),
  labelAr: z.string().trim().min(1, "Required.").max(MAX_SPEC_LABEL_LEN),
  labelRu: optStr(MAX_SPEC_LABEL_LEN),
  valueEn: z.string().trim().min(1, "Required.").max(MAX_SPEC_VALUE_LEN),
  valueAr: z.string().trim().min(1, "Required.").max(MAX_SPEC_VALUE_LEN),
  valueRu: optStr(MAX_SPEC_VALUE_LEN),
});

export const productSpecsInputSchema = z.object({
  rows: z.array(specRowSchema).max(MAX_PRODUCT_SPEC_ROWS),
});

export type ProductSpecsInput = z.infer<typeof productSpecsInputSchema>;

export const MAX_PRODUCT_IMAGE_ALT_LEN = 300;

export const productImageAltTextSchema = z.object({
  altTextEn: optStr(MAX_PRODUCT_IMAGE_ALT_LEN),
  altTextAr: optStr(MAX_PRODUCT_IMAGE_ALT_LEN),
  altTextRu: optStr(MAX_PRODUCT_IMAGE_ALT_LEN),
});

export type ProductImageAltTextInput = z.infer<typeof productImageAltTextSchema>;

export const MANUAL_STOCK_MOVEMENT_TYPES = [
  "PURCHASE",
  "RETURN",
  "MANUAL_ADJUSTMENT",
  "DAMAGE",
] as const;

export const adjustStockSchema = z
  .object({
    delta: z.coerce.number().int(),
    type: z.enum(MANUAL_STOCK_MOVEMENT_TYPES),
    reason: z.string().trim().min(1).max(200),
  })
  .superRefine((data, ctx) => {
    if (data.delta === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["delta"],
        message: "Delta must be nonzero.",
      });
      return;
    }
    if (
      (data.type === "PURCHASE" || data.type === "RETURN") &&
      data.delta < 0
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["delta"],
        message: "Delta must be positive for PURCHASE and RETURN.",
      });
    }
    if (data.type === "DAMAGE" && data.delta > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["delta"],
        message: "Delta must be negative for DAMAGE.",
      });
    }
  });

export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
