import { z } from "zod";
import { isValidCountryCode } from "@/lib/data/countries";

function optStr(maxLen?: number) {
  let s: z.ZodString = z.string();
  if (maxLen !== undefined) s = s.max(maxLen);
  return z.preprocess((v) => {
    if (v == null) return null;
    const str = (typeof v === "string" ? v : String(v)).trim();
    return str === "" ? null : str;
  }, s.nullable());
}

const ZoneBaseObject = z
  .object({
    code: z
      .string()
      .trim()
      .min(1, "Zone code is required")
      .max(40)
      .regex(/^[A-Z0-9_]+$/),
    nameEn: z.string().trim().min(1, "English name is required").max(120),
    nameAr: z.string().trim().min(1, "Arabic name is required"),
    nameRu: optStr(120),
    isActive: z.boolean().default(true),
    displayOrder: z.coerce.number().int().min(0).default(0),
    freeShippingEnabled: z.boolean().default(false),
    quoteRequired: z.boolean().default(false),
    freeShippingThreshold: z.preprocess(
      (v) => (v === "" || v == null ? null : v),
      z.coerce.number().positive().nullable(),
    ),
  })
  .refine(
    (d) =>
      !d.freeShippingEnabled ||
      (d.freeShippingThreshold != null && d.freeShippingThreshold > 0),
    {
      path: ["freeShippingThreshold"],
      message: "Set a threshold above 0 when free shipping is enabled",
    },
  );

export const CreateShippingZoneSchema = ZoneBaseObject;
export const UpdateShippingZoneSchema = ZoneBaseObject;

export const AddZoneCountrySchema = z
  .object({ country: z.string().trim().toUpperCase().length(2) })
  .refine((d) => isValidCountryCode(d.country), {
    path: ["country"],
    message: "Not a recognized country",
  });

export type CreateShippingZoneInput = z.infer<typeof CreateShippingZoneSchema>;
export type UpdateShippingZoneInput = z.infer<typeof UpdateShippingZoneSchema>;
export type AddZoneCountryInput = z.infer<typeof AddZoneCountrySchema>;

function optInt() {
  return z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.coerce.number().int().min(0).nullable(),
  );
}

const RateBaseObject = z.object({
  basePrice: z.coerce.number().min(0),
  estimatedDaysMin: optInt(),
  estimatedDaysMax: optInt(),
  isActive: z.boolean().default(true),
});

const rateDaysRefine = (d: {
  estimatedDaysMin: number | null;
  estimatedDaysMax: number | null;
}) =>
  d.estimatedDaysMin == null ||
  d.estimatedDaysMax == null ||
  d.estimatedDaysMin <= d.estimatedDaysMax;

export const CreateShippingRateSchema = RateBaseObject.extend({
  shippingMethodId: z.string().trim().min(1, "Shipping method is required"),
}).refine(rateDaysRefine, {
  path: ["estimatedDaysMax"],
  message: "Max days must be greater than or equal to min days",
});

export const UpdateShippingRateSchema = RateBaseObject.refine(rateDaysRefine, {
  path: ["estimatedDaysMax"],
  message: "Max days must be greater than or equal to min days",
});

export type CreateShippingRateInput = z.infer<typeof CreateShippingRateSchema>;
export type UpdateShippingRateInput = z.infer<typeof UpdateShippingRateSchema>;

const MethodBaseObject = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Method code is required")
    .max(40)
    .regex(/^[A-Z0-9_]+$/),
  nameEn: z.string().trim().min(1, "English name is required").max(120),
  nameAr: z.string().trim().min(1, "Arabic name is required"),
  nameRu: optStr(120),
  isActive: z.boolean().default(true),
  freeShippingEligible: z.boolean().default(false),
  displayOrder: z.coerce.number().int().min(0).default(0),
});

export const CreateShippingMethodSchema = MethodBaseObject;
export const UpdateShippingMethodSchema = MethodBaseObject;

export type CreateShippingMethodInput = z.infer<
  typeof CreateShippingMethodSchema
>;
export type UpdateShippingMethodInput = z.infer<
  typeof UpdateShippingMethodSchema
>;
