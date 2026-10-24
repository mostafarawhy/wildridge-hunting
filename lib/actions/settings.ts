"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import { Prisma } from "@/app/generated/prisma/client";
import { demoGate, requireStaffAction } from "@/lib/auth-staff";
import {
  SETTING_KEYS,
  isSequenceKey,
  isAllowedSettingKey,
} from "@/lib/settings/keys";
import type { LegalDetailsInput, SettingValue } from "@/lib/settings/keys";

// ─── RESULT TYPE ──────────────────────────────────────────────────────────────

type SettingsActionResult =
  | { success: true }
  | {
      success: false;
      error: string;
      errorCode: string;
      fieldErrors?: Record<string, string[]>;
    };

// ─── ACTIONS ──────────────────────────────────────────────────────────────────

export async function updateStoreProfileAction(input: {
  storeName: string;
  contactEmail: string;
  contactPhone: string;
  addressLine: string;
  instagramUrl: string;
  youtubeUrl: string;
}): Promise<SettingsActionResult> {
  const demoRefusal = await demoGate("content:manage");
  if (demoRefusal) return demoRefusal;

  const acting = await requireStaffAction("content:manage");

  const key = "store_profile" as const;

  if (isSequenceKey(key)) {
    return { success: false, error: "Forbidden key.", errorCode: "INTERNAL_ERROR" };
  }
  if (!isAllowedSettingKey(key)) {
    return { success: false, error: "Forbidden key.", errorCode: "INTERNAL_ERROR" };
  }

  const schema = SETTING_KEYS[key];
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed.",
      errorCode: "VALIDATION_ERROR",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    };
  }

  const value = parsed.data;

  try {
    await db.$transaction(
      async (tx) => {
        const existing = await tx.projectConfig.findUnique({ where: { key } });
        const before: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined =
          existing == null
            ? undefined
            : existing.value === null
              ? Prisma.JsonNull
              : (existing.value as Prisma.InputJsonValue);

        await tx.projectConfig.upsert({
          where: { key },
          create: { key, value },
          update: { value },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: acting.id,
            action: "settings.store_profile.update",
            entityType: "ProjectConfig",
            entityId: key,
            before,
            after: value,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/", "layout");

    return { success: true };
  } catch {
    return {
      success: false,
      error: "An unexpected error occurred.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export async function updateLegalTaxAction(
  input: { vatRate: number; storeTrn: string } & LegalDetailsInput,
): Promise<SettingsActionResult> {
  const demoRefusal = await demoGate("settings:manage");
  if (demoRefusal) return demoRefusal;

  const acting = await requireStaffAction("settings:manage");

  const taxKey = "tax_config" as const;
  const legalKey = "legal_details" as const;

  for (const key of [taxKey, legalKey] as const) {
    if (isSequenceKey(key)) {
      return { success: false, error: "Forbidden key.", errorCode: "INTERNAL_ERROR" };
    }
    if (!isAllowedSettingKey(key)) {
      return { success: false, error: "Forbidden key.", errorCode: "INTERNAL_ERROR" };
    }
  }

  const taxSchema = SETTING_KEYS[taxKey];
  const legalSchema = SETTING_KEYS[legalKey];

  const { vatRate, storeTrn: rawTrn, ...legalInput } = input;
  const storeTrn = String(rawTrn ?? "").replace(/\s+/g, "");

  const taxParsed = taxSchema.safeParse({ vatRate, storeTrn });
  const legalParsed = legalSchema.safeParse(legalInput);

    const fieldErrors: Record<string, string[]> = {};
  const collect = (flat: Record<string, string[] | undefined>) => {
    for (const [field, messages] of Object.entries(flat)) {
      if (messages && messages.length > 0) {
        fieldErrors[field] = [...(fieldErrors[field] ?? []), ...messages];
      }
    }
  };
  if (!taxParsed.success) {
    collect(
      z.flattenError(taxParsed.error).fieldErrors as Record<
        string,
        string[] | undefined
      >,
    );
  }
  if (!legalParsed.success) {
    collect(
      z.flattenError(legalParsed.error).fieldErrors as Record<
        string,
        string[] | undefined
      >,
    );
  }
  if (storeTrn !== "" && !/^\d{15}$/.test(storeTrn)) {
    fieldErrors.storeTrn = ["Enter the 15-digit TRN, or leave it empty."];
  }

  if (!taxParsed.success || !legalParsed.success || Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Validation failed.",
      errorCode: "VALIDATION_ERROR",
      fieldErrors,
    };
  }

  const taxValue = taxParsed.data;
  const legalValue = legalParsed.data;

  try {
    const outcome = await db.$transaction(
      async (tx) => {
        const taxRow = await tx.projectConfig.findUnique({ where: { key: taxKey } });
        const legalRow = await tx.projectConfig.findUnique({ where: { key: legalKey } });

        const taxStored = taxSchema.safeParse(taxRow?.value ?? {});
        const legalStored = legalSchema.safeParse(legalRow?.value ?? {});
        const taxBefore = taxStored.success ? taxStored.data : taxSchema.parse({});
        const legalBefore = legalStored.success ? legalStored.data : legalSchema.parse({});

        const taxChanged =
          taxBefore.vatRate !== taxValue.vatRate ||
          taxBefore.storeTrn !== taxValue.storeTrn;
        const legalChanged = (
          Object.keys(legalValue) as (keyof typeof legalValue)[]
        ).some((field) => legalBefore[field] !== legalValue[field]);

        if (!taxChanged && !legalChanged) return "NO_CHANGES" as const;

        if (taxChanged) {
          await tx.projectConfig.upsert({
            where: { key: taxKey },
            create: { key: taxKey, value: taxValue },
            update: { value: taxValue },
          });
        }
        if (legalChanged) {
          await tx.projectConfig.upsert({
            where: { key: legalKey },
            create: { key: legalKey, value: legalValue },
            update: { value: legalValue },
          });
        }

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: acting.id,
            action: "settings.legal_details.update",
            entityType: "ProjectConfig",
            entityId: legalKey,
            before: { tax_config: taxBefore, legal_details: legalBefore },
            after: { tax_config: taxValue, legal_details: legalValue },
          },
        });

        return "SAVED" as const;
      },
      { isolationLevel: "Serializable" },
    );

    if (outcome === "NO_CHANGES") {
      return { success: false, error: "Nothing changed.", errorCode: "NO_CHANGES" };
    }

    return { success: true };
  } catch {
    return {
      success: false,
      error: "An unexpected error occurred.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export async function updateDeliveryConfigAction(input: {
  staleShippedDays: number;
}): Promise<SettingsActionResult> {
  const demoRefusal = await demoGate("settings:manage");
  if (demoRefusal) return demoRefusal;

  const acting = await requireStaffAction("settings:manage");

  const key = "delivery_config" as const;

  if (isSequenceKey(key)) {
    return { success: false, error: "Forbidden key.", errorCode: "INTERNAL_ERROR" };
  }
  if (!isAllowedSettingKey(key)) {
    return { success: false, error: "Forbidden key.", errorCode: "INTERNAL_ERROR" };
  }

  const schema = SETTING_KEYS[key];
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed.",
      errorCode: "VALIDATION_ERROR",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    };
  }

  const value = parsed.data;

  try {
    await db.$transaction(
      async (tx) => {
        const existing = await tx.projectConfig.findUnique({ where: { key } });
        const before: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined =
          existing == null
            ? undefined
            : existing.value === null
              ? Prisma.JsonNull
              : (existing.value as Prisma.InputJsonValue);

        await tx.projectConfig.upsert({
          where: { key },
          create: { key, value },
          update: { value },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: acting.id,
            action: "settings.delivery_config.update",
            entityType: "ProjectConfig",
            entityId: key,
            before,
            after: value,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    return { success: true };
  } catch {
    return {
      success: false,
      error: "An unexpected error occurred.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export async function updateVerificationContentAction(input: {
  content: SettingValue<"verification_content">;
  attestation: true;
}): Promise<SettingsActionResult> {
  const demoRefusal = await demoGate("content:manage");
  if (demoRefusal) return demoRefusal;

  const acting = await requireStaffAction("content:manage");

  const key = "verification_content" as const;

  if (isSequenceKey(key)) {
    return { success: false, error: "Forbidden key.", errorCode: "INTERNAL_ERROR" };
  }
  if (!isAllowedSettingKey(key)) {
    return { success: false, error: "Forbidden key.", errorCode: "INTERNAL_ERROR" };
  }

  const schema = SETTING_KEYS[key];
  const inputSchema = z.object({
    content: schema,
    attestation: z.literal(true),
  });
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed.",
      errorCode: "VALIDATION_ERROR",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    };
  }

  const value = parsed.data.content;

  for (const locale of ["en", "ar", "ru"] as const) {
    const localized = value[locale];
    if (
      !localized.acknowledgment.trim() ||
      !localized.instructions.general.trim()
    ) {
      return {
        success: false,
        error:
          "All three locales must have general instructions and an acknowledgment before publishing.",
        errorCode: "VALIDATION_ERROR",
      };
    }
  }

  try {
    await db.$transaction(
      async (tx) => {
        const existing = await tx.projectConfig.findUnique({ where: { key } });
        const before: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined =
          existing == null
            ? undefined
            : existing.value === null
              ? Prisma.JsonNull
              : (existing.value as Prisma.InputJsonValue);

        await tx.projectConfig.upsert({
          where: { key },
          create: { key, value },
          update: { value },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: acting.id,
            action: "settings.verification_content.update",
            entityType: "ProjectConfig",
            entityId: key,
            before,
            after: { ...value, attestation: true },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    return { success: true };
  } catch {
    return {
      success: false,
      error: "An unexpected error occurred.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export async function updateB2BContentAction(input: {
  content: SettingValue<"b2b_content">;
  attestation: true;
}): Promise<SettingsActionResult> {
  const demoRefusal = await demoGate("content:manage");
  if (demoRefusal) return demoRefusal;

  const acting = await requireStaffAction("content:manage");

  const key = "b2b_content" as const;

  if (isSequenceKey(key)) {
    return { success: false, error: "Forbidden key.", errorCode: "INTERNAL_ERROR" };
  }
  if (!isAllowedSettingKey(key)) {
    return { success: false, error: "Forbidden key.", errorCode: "INTERNAL_ERROR" };
  }

  const schema = SETTING_KEYS[key];
  const inputSchema = z.object({
    content: schema,
    attestation: z.literal(true),
  });
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed.",
      errorCode: "VALIDATION_ERROR",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    };
  }

  const value = parsed.data.content;

  for (const locale of ["en", "ar", "ru"] as const) {
    const localized = value[locale];
    if (
      !localized.acknowledgment.trim() ||
      !localized.instructions.general.trim()
    ) {
      return {
        success: false,
        error:
          "All three locales must have general instructions and an acknowledgment before publishing.",
        errorCode: "VALIDATION_ERROR",
      };
    }
  }

  if (!value.requiredTypes.includes("TRADE_LICENSE")) {
    return {
      success: false,
      error: "Trade licence must remain a required document.",
      errorCode: "VALIDATION_ERROR",
    };
  }

  if (value.requiredTypes.some((type) => value.recommendedTypes.includes(type))) {
    return {
      success: false,
      error: "A document type cannot be both required and recommended.",
      errorCode: "VALIDATION_ERROR",
    };
  }

  try {
    await db.$transaction(
      async (tx) => {
        const existing = await tx.projectConfig.findUnique({ where: { key } });
        const before: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined =
          existing == null
            ? undefined
            : existing.value === null
              ? Prisma.JsonNull
              : (existing.value as Prisma.InputJsonValue);

        await tx.projectConfig.upsert({
          where: { key },
          create: { key, value },
          update: { value },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: acting.id,
            action: "settings.b2b_content.update",
            entityType: "ProjectConfig",
            entityId: key,
            before,
            after: { ...value, attestation: true },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    return { success: true };
  } catch {
    return {
      success: false,
      error: "An unexpected error occurred.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export async function updateQuoteLegalTermsAction(input: {
  content: SettingValue<"quote_legal_terms">;
  attestation: true;
}): Promise<SettingsActionResult> {
  const demoRefusal = await demoGate("content:manage");
  if (demoRefusal) return demoRefusal;

  const acting = await requireStaffAction("content:manage");

  const key = "quote_legal_terms" as const;

  if (isSequenceKey(key)) {
    return { success: false, error: "Forbidden key.", errorCode: "INTERNAL_ERROR" };
  }
  if (!isAllowedSettingKey(key)) {
    return { success: false, error: "Forbidden key.", errorCode: "INTERNAL_ERROR" };
  }

  const schema = SETTING_KEYS[key];
  const inputSchema = z.object({
    content: schema,
    attestation: z.literal(true),
  });
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed.",
      errorCode: "VALIDATION_ERROR",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    };
  }

  const value = parsed.data.content;

  for (const locale of ["en", "ar", "ru"] as const) {
    const localized = value[locale];
    if (!localized.body.trim()) {
      return {
        success: false,
        error: "All three locales must have content before publishing.",
        errorCode: "VALIDATION_ERROR",
      };
    }
  }

  try {
    await db.$transaction(
      async (tx) => {
        const existing = await tx.projectConfig.findUnique({ where: { key } });
        const before: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined =
          existing == null
            ? undefined
            : existing.value === null
              ? Prisma.JsonNull
              : (existing.value as Prisma.InputJsonValue);

        await tx.projectConfig.upsert({
          where: { key },
          create: { key, value },
          update: { value },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: acting.id,
            action: "settings.quote_legal_terms.update",
            entityType: "ProjectConfig",
            entityId: key,
            before,
            after: { ...value, attestation: true },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    return { success: true };
  } catch {
    return {
      success: false,
      error: "An unexpected error occurred.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export async function updateQuoteRulesAction(input: {
  content: SettingValue<"quote_rules">;
  attestation: true;
}): Promise<SettingsActionResult> {
  const demoRefusal = await demoGate("content:manage");
  if (demoRefusal) return demoRefusal;

  const acting = await requireStaffAction("content:manage");

  const key = "quote_rules" as const;

  if (isSequenceKey(key)) {
    return { success: false, error: "Forbidden key.", errorCode: "INTERNAL_ERROR" };
  }
  if (!isAllowedSettingKey(key)) {
    return { success: false, error: "Forbidden key.", errorCode: "INTERNAL_ERROR" };
  }

  const schema = SETTING_KEYS[key];
  const inputSchema = z.object({
    content: schema,
    attestation: z.literal(true),
  });
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed.",
      errorCode: "VALIDATION_ERROR",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    };
  }

  const value = parsed.data.content;

  for (const locale of ["en", "ar", "ru"] as const) {
    const localized = value[locale];
    if (!localized.body.trim()) {
      return {
        success: false,
        error: "All three locales must have content before publishing.",
        errorCode: "VALIDATION_ERROR",
      };
    }
  }

  try {
    await db.$transaction(
      async (tx) => {
        const existing = await tx.projectConfig.findUnique({ where: { key } });
        const before: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined =
          existing == null
            ? undefined
            : existing.value === null
              ? Prisma.JsonNull
              : (existing.value as Prisma.InputJsonValue);

        await tx.projectConfig.upsert({
          where: { key },
          create: { key, value },
          update: { value },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: acting.id,
            action: "settings.quote_rules.update",
            entityType: "ProjectConfig",
            entityId: key,
            before,
            after: { ...value, attestation: true },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    return { success: true };
  } catch {
    return {
      success: false,
      error: "An unexpected error occurred.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export async function updateEmailIdentityAction(input: {
  fromName: string;
  replyTo: string;
}): Promise<SettingsActionResult> {
  const demoRefusal = await demoGate("settings:manage");
  if (demoRefusal) return demoRefusal;

  const acting = await requireStaffAction("settings:manage");

  const key = "email_identity" as const;

  if (isSequenceKey(key)) {
    return { success: false, error: "Forbidden key.", errorCode: "INTERNAL_ERROR" };
  }
  if (!isAllowedSettingKey(key)) {
    return { success: false, error: "Forbidden key.", errorCode: "INTERNAL_ERROR" };
  }

  const schema = SETTING_KEYS[key];
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed.",
      errorCode: "VALIDATION_ERROR",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    };
  }

  const value = parsed.data;

  try {
    await db.$transaction(
      async (tx) => {
        const existing = await tx.projectConfig.findUnique({ where: { key } });
        const before: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined =
          existing == null
            ? undefined
            : existing.value === null
              ? Prisma.JsonNull
              : (existing.value as Prisma.InputJsonValue);

        await tx.projectConfig.upsert({
          where: { key },
          create: { key, value },
          update: { value },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: acting.id,
            action: "settings.email_identity.update",
            entityType: "ProjectConfig",
            entityId: key,
            before,
            after: value,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    return { success: true };
  } catch {
    return {
      success: false,
      error: "An unexpected error occurred.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

const emailRecipientInputSchema = z.object({
  bucket: z.enum(["sales", "orders", "support"]),
  email: z.string().trim().toLowerCase().email(),
});

export async function addEmailRecipientAction(input: {
  bucket: "sales" | "orders" | "support";
  email: string;
}): Promise<SettingsActionResult> {
  const demoRefusal = await demoGate("settings:manage");
  if (demoRefusal) return demoRefusal;

  const acting = await requireStaffAction("settings:manage");

  const key = "email_recipients" as const;

  if (isSequenceKey(key)) {
    return { success: false, error: "Forbidden key.", errorCode: "INTERNAL_ERROR" };
  }
  if (!isAllowedSettingKey(key)) {
    return { success: false, error: "Forbidden key.", errorCode: "INTERNAL_ERROR" };
  }

  const parsed = emailRecipientInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed.",
      errorCode: "VALIDATION_ERROR",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    };
  }

  const { bucket, email } = parsed.data;

  try {
    await db.$transaction(
      async (tx) => {
        const existing = await tx.projectConfig.findUnique({ where: { key } });
        const before = SETTING_KEYS[key].parse(existing?.value ?? {});

        if (before[bucket].includes(email)) {
          throw new Error("DUPLICATE");
        }
        if (before[bucket].length >= 10) {
          throw new Error("LIMIT");
        }

        const after = { ...before, [bucket]: [...before[bucket], email] };

        await tx.projectConfig.upsert({
          where: { key },
          create: { key, value: after },
          update: { value: after },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: acting.id,
            action: "settings.email_recipients.update",
            entityType: "ProjectConfig",
            entityId: key,
            before,
            after,
            metadata: { bucket, op: "add" },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    return { success: true };
  } catch (err) {
    if (err instanceof Error && err.message === "DUPLICATE") {
      return {
        success: false,
        error: "This address is already on the list.",
        errorCode: "DUPLICATE",
      };
    }
    if (err instanceof Error && err.message === "LIMIT") {
      return {
        success: false,
        error: "A list can hold at most 10 addresses.",
        errorCode: "LIMIT",
      };
    }
    return {
      success: false,
      error: "An unexpected error occurred.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export async function removeEmailRecipientAction(input: {
  bucket: "sales" | "orders" | "support";
  email: string;
}): Promise<SettingsActionResult> {
  const demoRefusal = await demoGate("settings:manage");
  if (demoRefusal) return demoRefusal;

  const acting = await requireStaffAction("settings:manage");

  const key = "email_recipients" as const;

  if (isSequenceKey(key)) {
    return { success: false, error: "Forbidden key.", errorCode: "INTERNAL_ERROR" };
  }
  if (!isAllowedSettingKey(key)) {
    return { success: false, error: "Forbidden key.", errorCode: "INTERNAL_ERROR" };
  }

  const parsed = emailRecipientInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed.",
      errorCode: "VALIDATION_ERROR",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    };
  }

  const { bucket, email } = parsed.data;

  try {
    await db.$transaction(
      async (tx) => {
        const existing = await tx.projectConfig.findUnique({ where: { key } });
        const before = SETTING_KEYS[key].parse(existing?.value ?? {});

        if (!before[bucket].includes(email)) {
          throw new Error("NOT_FOUND");
        }

        const after = {
          ...before,
          [bucket]: before[bucket].filter((e) => e !== email),
        };

        await tx.projectConfig.upsert({
          where: { key },
          create: { key, value: after },
          update: { value: after },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: acting.id,
            action: "settings.email_recipients.update",
            entityType: "ProjectConfig",
            entityId: key,
            before,
            after,
            metadata: { bucket, op: "remove" },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    return { success: true };
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return {
        success: false,
        error: "This address is not on the list.",
        errorCode: "NOT_FOUND",
      };
    }
    return {
      success: false,
      error: "An unexpected error occurred.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}
