"use server";

import { z } from "zod";
import { db } from "@/lib/db/client";
import { Prisma } from "@/app/generated/prisma/client";
import { demoGate, requireStaff, requireStaffAction } from "@/lib/auth-staff";
import { EMAIL_DEFAULTS, UNPAUSABLE_TEMPLATE_KEYS } from "@/lib/email/defaults";

function isKnownTemplateKey(k: string): boolean {
  return Object.prototype.hasOwnProperty.call(EMAIL_DEFAULTS, k);
}

type EmailTemplateActionResult =
  | { success: true }
  | {
      success: false;
      error: string;
      errorCode: string;
      fieldErrors?: Record<string, string[]>;
    };

const OVERRIDE_SELECT = {
  templateKey: true,
  locale: true,
  subject: true,
  preheaderText: true,
  bodyParagraphs: true,
  ctaLabel: true,
  enabled: true,
  updatedById: true,
} as const;

const templateKeySchema = z
  .string()
  .min(1)
  .refine(isKnownTemplateKey, "Unknown template.");

const TemplateKeyLocaleSchema = z.object({
  templateKey: templateKeySchema,
  locale: z.enum(["en", "ar", "ru"]),
});

const UpsertEmailTemplateOverrideSchema = z.object({
  templateKey: templateKeySchema,
  locale: z.enum(["en", "ar", "ru"]),
  subject: z.string().trim().min(1).max(200).optional(),
  preheaderText: z.string().trim().max(150).optional(),
  bodyParagraphs: z.array(z.string().trim().min(1).max(2000)).min(1).max(10),
  ctaLabel: z.string().trim().max(40).optional(),
});

export async function listEmailTemplateOverridesAction() {
  await requireStaff("content:manage");

  return db.emailTemplate.findMany({
    orderBy: [{ templateKey: "asc" }, { locale: "asc" }],
  });
}

export async function upsertEmailTemplateOverrideAction(input: {
  templateKey: string;
  locale: string;
  subject?: string;
  preheaderText?: string;
  bodyParagraphs: string[];
  ctaLabel?: string;
}): Promise<EmailTemplateActionResult> {
  const demoRefusal = await demoGate("content:manage");
  if (demoRefusal) return demoRefusal;

  const acting = await requireStaffAction("content:manage");

  const parsed = UpsertEmailTemplateOverrideSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed.",
      errorCode: "VALIDATION_ERROR",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const {
    templateKey,
    locale,
    subject,
    preheaderText,
    bodyParagraphs,
    ctaLabel,
  } = parsed.data;
  const entityId = `${templateKey}:${locale}`;

  try {
    await db.$transaction(
      async (tx) => {
        const existing = await tx.emailTemplate.findUnique({
          where: { templateKey_locale: { templateKey, locale } },
          select: OVERRIDE_SELECT,
        });

        const updated = await tx.emailTemplate.upsert({
          where: { templateKey_locale: { templateKey, locale } },
          create: {
            templateKey,
            locale,
            subject: subject ?? null,
            preheaderText: preheaderText ?? null,
            bodyParagraphs: bodyParagraphs ?? Prisma.JsonNull,
            ctaLabel: ctaLabel ?? null,
            updatedById: acting.id,
          },
          update: {
            subject: subject ?? null,
            preheaderText: preheaderText ?? null,
            bodyParagraphs: bodyParagraphs ?? Prisma.JsonNull,
            ctaLabel: ctaLabel ?? null,
            updatedById: acting.id,
          },
          select: OVERRIDE_SELECT,
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: acting.id,
            action: "settings.email_template.update",
            entityType: "EmailTemplate",
            entityId,
            before: existing
              ? (existing as unknown as Prisma.InputJsonValue)
              : Prisma.JsonNull,
            after: updated as unknown as Prisma.InputJsonValue,
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

export async function resetEmailTemplateOverrideAction(
  templateKey: string,
  locale: string,
): Promise<EmailTemplateActionResult> {
  const demoRefusal = await demoGate("content:manage");
  if (demoRefusal) return demoRefusal;

  const acting = await requireStaffAction("content:manage");

  const parsed = TemplateKeyLocaleSchema.safeParse({ templateKey, locale });
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed.",
      errorCode: "VALIDATION_ERROR",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    };
  }

  const entityId = `${parsed.data.templateKey}:${parsed.data.locale}`;

  try {
    await db.$transaction(
      async (tx) => {
        const existing = await tx.emailTemplate.findUnique({
          where: { templateKey_locale: { templateKey, locale } },
          select: OVERRIDE_SELECT,
        });

        if (!existing) return;

        if (existing.enabled === false) {
          await tx.emailTemplate.update({
            where: { templateKey_locale: { templateKey, locale } },
            data: {
              subject: null,
              preheaderText: null,
              bodyParagraphs: Prisma.JsonNull,
              ctaLabel: null,
              updatedById: acting.id,
            },
          });
        } else {
          await tx.emailTemplate.delete({
            where: { templateKey_locale: { templateKey, locale } },
          });
        }

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: acting.id,
            action: "settings.email_template.reset",
            entityType: "EmailTemplate",
            entityId,
            before: existing as unknown as Prisma.InputJsonValue,
            after: Prisma.JsonNull,
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

const SetEmailTemplateSendingSchema = z.object({
  templateKey: templateKeySchema,
  enabled: z.boolean(),
});

export async function setEmailTemplateSendingAction(input: {
  templateKey: string;
  enabled: boolean;
}): Promise<EmailTemplateActionResult> {
  const demoRefusal = await demoGate("content:manage");
  if (demoRefusal) return demoRefusal;

  const acting = await requireStaffAction("content:manage");

  const parsed = SetEmailTemplateSendingSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed.",
      errorCode: "VALIDATION_ERROR",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    };
  }

  const { templateKey, enabled } = parsed.data;

  if (enabled === false && UNPAUSABLE_TEMPLATE_KEYS.has(templateKey)) {
    return {
      success: false,
      error: "Security emails cannot be paused.",
      errorCode: "VALIDATION_ERROR",
    };
  }

  try {
    await db.$transaction(
      async (tx) => {
        const enRow = await tx.emailTemplate.findUnique({
          where: { templateKey_locale: { templateKey, locale: "en" } },
          select: { enabled: true },
        });
        const before = enRow?.enabled ?? true;

        for (const locale of ["en", "ar", "ru"] as const) {
          await tx.emailTemplate.upsert({
            where: { templateKey_locale: { templateKey, locale } },
            create: { templateKey, locale, enabled, updatedById: acting.id },
            update: { enabled, updatedById: acting.id },
          });
        }

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: acting.id,
            action: "settings.email_template.toggle",
            entityType: "EmailTemplate",
            entityId: templateKey,
            before: { enabled: before } as unknown as Prisma.InputJsonValue,
            after: { enabled } as unknown as Prisma.InputJsonValue,
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
