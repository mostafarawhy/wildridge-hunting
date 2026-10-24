import { z } from "zod";
import {
  isValidPhoneNumber,
  parsePhoneNumberWithError,
} from "libphonenumber-js";
import type { CountryCode } from "libphonenumber-js";
import { isValidCountryCode } from "@/lib/data/countries";
import { getSubdivisions } from "@/lib/data/subdivisions";

const FE = "checkout.billing.fieldErrors";

export const checkoutAddressSchema = z
  .object({
    fullName: z
      .string()
      .min(2, `${FE}.fullNameShort`)
      .max(100, `${FE}.fullNameLong`),
    country: z
      .string()
      .trim()
      .toUpperCase()
      .length(2, `${FE}.countryInvalid`)
      .refine(isValidCountryCode, `${FE}.countryInvalid`),
    phone: z.string().min(1, `${FE}.phoneRequired`),
    addressLine1: z
      .string()
      .min(5, `${FE}.line1Short`)
      .max(200, `${FE}.line1Long`),
    addressLine2: z.string().max(200, `${FE}.line2Long`).optional(),
    city: z.string().min(2, `${FE}.cityShort`).max(60, `${FE}.cityLong`),
    emirate: z.string().min(1, `${FE}.subdivisionRequired`),
    postalCode: z.string().max(20, `${FE}.postalLong`).optional(),
    label: z.string().max(40, `${FE}.labelLong`).optional(),
    saveToProfile: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    const subs = getSubdivisions(data.country);
    if (subs && !subs.includes(data.emirate)) {
      ctx.addIssue({
        code: "custom",
        message: `${FE}.subdivisionInvalid`,
        path: ["emirate"],
      });
    }
    if (!isValidPhoneNumber(data.phone, data.country as CountryCode)) {
      ctx.addIssue({
        code: "custom",
        message: `${FE}.phoneInvalid`,
        path: ["phone"],
      });
    }
  })
  .transform((data) => {
    try {
      const e164 = parsePhoneNumberWithError(
        data.phone,
        data.country as CountryCode,
      ).number;
      return { ...data, phone: e164 };
    } catch {
      return data;
    }
  });

const customerNoteField = z
  .string()
  .max(500, "note must be under 500 characters")
  .optional();

export const placeOrderSchema = z.discriminatedUnion("addressSource", [
  z.object({
    addressSource: z.literal("saved"),
    addressId: z.string().min(1, "invalid address id"),
    customerNote: customerNoteField,
    shippingMethodId: z.string().min(1).optional(),
    couponCode: z.string().trim().max(40).optional(),
    pointsToUse: z.number().int().min(0).max(1000000).optional(),
    pointsRate: z.number().int().min(1).max(100000).optional(),
  }),
  z.object({
    addressSource: z.literal("new"),
    address: checkoutAddressSchema,
    customerNote: customerNoteField,
    shippingMethodId: z.string().min(1).optional(),
    couponCode: z.string().trim().max(40).optional(),
    pointsToUse: z.number().int().min(0).max(1000000).optional(),
    pointsRate: z.number().int().min(1).max(100000).optional(),
  }),
]);

export type CheckoutAddressInput = z.infer<typeof checkoutAddressSchema>;
export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
