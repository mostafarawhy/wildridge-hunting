import { z } from "zod";

// ─── SEQUENCE KEY GUARD ───────────────────────────────────────────────────────

export const SEQUENCE_KEY_PATTERN = /_sequence_/;

export function isSequenceKey(key: string): boolean {
  return SEQUENCE_KEY_PATTERN.test(key);
}

// ─── SETTING SCHEMAS ──────────────────────────────────────────────────────────

const storeProfileSchema = z.object({
  storeName: z.string().max(200).default(""),
  contactEmail: z.union([z.literal(""), z.string().email()]).default(""),
  contactPhone: z.string().max(50).default(""),
  addressLine: z.string().max(300).default(""),
  instagramUrl: z
    .string()
    .max(300)
    .regex(/^(|https:\/\/(www\.)?instagram\.com\/[^\s\\]+)$/, "Use a full https://instagram.com/ link, or leave it empty.")
    .default(""),
  youtubeUrl: z
    .string()
    .max(300)
    .regex(/^(|https:\/\/(www\.|m\.)?youtube\.com\/[^\s\\]+)$/, "Use a full https://youtube.com/ link, or leave it empty.")
    .default(""),
});

const emailIdentitySchema = z.object({
  fromName: z.string().max(200).default(""),
  replyTo: z.union([z.literal(""), z.string().email()]).default(""),
});

const emailRecipientsSchema = z.object({
  sales: z
    .array(z.string().trim().toLowerCase().email())
    .max(10)
    .default([]),
  orders: z
    .array(z.string().trim().toLowerCase().email())
    .max(10)
    .default([]),
  support: z
    .array(z.string().trim().toLowerCase().email())
    .max(10)
    .default([]),
});

const taxConfigSchema = z.object({
  vatRate: z.number().min(0).max(1).default(0.05),
  storeTrn: z.string().max(50).default(""),
});

const legalDetailsSchema = z.object({
  legalNameEn: z.string().trim().max(200).default(""),
  legalNameAr: z.string().trim().max(200).default(""),
  registeredAddressEn: z.string().trim().max(500).default(""),
  registeredAddressAr: z.string().trim().max(500).default(""),
  tradeLicenceNo: z.string().trim().max(50).default(""),
  licensingAuthority: z.string().trim().max(100).default(""),
  invoiceNote: z.string().trim().max(500).default(""),
});

const deliveryConfigSchema = z.object({
  staleShippedDays: z
    .number()
    .int("Enter a whole number of days.")
    .min(1, "Enter a number from 1 to 30.")
    .max(30, "Enter a number from 1 to 30.")
    .default(7),
});

const loyaltyProgramSchema = z.object({
  enabled: z.boolean().default(true),
  earnRate: z
    .number()
    .min(0, "Enter a number from 0 to 100.")
    .max(100, "Enter a number from 0 to 100.")
    .refine(
      (v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-9,
      "Use at most two decimals.",
    )
    .default(1),
  redeemPointsPerAed: z
    .number()
    .int("Enter whole points.")
    .min(10, "Enter at least 10 points.")
    .max(1000, "Enter at most 1,000 points.")
    .default(50),
  redeemMinPoints: z
    .number()
    .int("Enter whole points.")
    .min(1, "Enter at least 1 point.")
    .max(100000, "Enter at most 100,000 points.")
    .default(500),
  redeemMaxSharePercent: z
    .number()
    .int("Enter a whole percent.")
    .min(1, "Enter at least 1%.")
    .max(50, "Enter at most 50%.")
    .default(20),
});

const localizedContentSchema = z.object({
  instructions: z
    .object({
      general: z.string().max(4000).default(""),
      identity: z.string().max(4000).default(""),
      proofOfAddress: z.string().max(4000).default(""),
      photo: z.string().max(4000).default(""),
    })
    .default({ general: "", identity: "", proofOfAddress: "", photo: "" }),
  acknowledgment: z.string().max(4000).default(""),
});

const localizedContentDefault = {
  instructions: { general: "", identity: "", proofOfAddress: "", photo: "" },
  acknowledgment: "",
};

const verificationContentSchema = z.object({
  en: localizedContentSchema.default(localizedContentDefault),
  ar: localizedContentSchema.default(localizedContentDefault),
  ru: localizedContentSchema.default(localizedContentDefault),
});

const b2bLocalizedContentSchema = z.object({
  instructions: z
    .object({
      general: z.string().max(4000).default(""),
      tradeLicense: z.string().max(4000).default(""),
      vatCertificate: z.string().max(4000).default(""),
      companyId: z.string().max(4000).default(""),
      other: z.string().max(4000).default(""),
    })
    .default({
      general: "",
      tradeLicense: "",
      vatCertificate: "",
      companyId: "",
      other: "",
    }),
  supportingDocuments: z.string().max(4000).default(""),
  acknowledgment: z.string().max(4000).default(""),
});

const b2bContentDefault = {
  instructions: {
    general: "",
    tradeLicense: "",
    vatCertificate: "",
    companyId: "",
    other: "",
  },
  supportingDocuments: "",
  acknowledgment: "",
};

const b2bContentSchema = z.object({
  en: b2bLocalizedContentSchema.default(b2bContentDefault),
  ar: b2bLocalizedContentSchema.default(b2bContentDefault),
  ru: b2bLocalizedContentSchema.default(b2bContentDefault),
  requiredTypes: z
    .array(z.enum(["TRADE_LICENSE", "VAT_CERTIFICATE", "COMPANY_ID"]))
    .default(["TRADE_LICENSE"]),
  recommendedTypes: z
    .array(z.enum(["TRADE_LICENSE", "VAT_CERTIFICATE", "COMPANY_ID"]))
    .default([]),
});

const quoteConsentLocaleSchema = z.object({ body: z.string().max(20000).default("") });

const quoteLegalTermsSchema = z.object({
  en: quoteConsentLocaleSchema.default({ body: "" }),
  ar: quoteConsentLocaleSchema.default({ body: "" }),
  ru: quoteConsentLocaleSchema.default({ body: "" }),
});

const quoteRulesSchema = z.object({
  en: quoteConsentLocaleSchema.default({ body: "" }),
  ar: quoteConsentLocaleSchema.default({ body: "" }),
  ru: quoteConsentLocaleSchema.default({ body: "" }),
});

const quoteDefaultNoteSchema = z.object({
  body: z.string().max(4000).default(""),
});

// ─── REGISTRY ─────────────────────────────────────────────────────────────────

export const SETTING_KEYS = {
  store_profile: storeProfileSchema,
  email_identity: emailIdentitySchema,
  email_recipients: emailRecipientsSchema,
  tax_config: taxConfigSchema,
  legal_details: legalDetailsSchema,
  delivery_config: deliveryConfigSchema,
  loyalty_program: loyaltyProgramSchema,
  verification_content: verificationContentSchema,
  b2b_content: b2bContentSchema,
  quote_legal_terms: quoteLegalTermsSchema,
  quote_rules: quoteRulesSchema,
  quote_default_note: quoteDefaultNoteSchema,
} as const;

export type LoyaltyProgramInput = z.input<typeof loyaltyProgramSchema>;

export type LegalDetailsInput = z.input<typeof legalDetailsSchema>;

export type SettingKey = keyof typeof SETTING_KEYS;
export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTING_KEYS)[K]>;

export function isAllowedSettingKey(key: string): key is SettingKey {
  return key in SETTING_KEYS;
}
