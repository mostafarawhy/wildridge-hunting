"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import { requireStaffAction } from "@/lib/auth-staff";
import {
  buildSubscriberWhere,
  KLAVIYO_PENDING_WHERE,
  subscriberOrderBy,
} from "@/lib/db/queries/newsletter";
import {
  importSubscribersToKlaviyo,
  isKlaviyoConfigured,
  KLAVIYO_BULK_MAX,
  KLAVIYO_HISTORICAL_MIN_AGE_MS,
  subscribeEmailsToKlaviyo,
  type KlaviyoSubscribeResult,
} from "@/lib/services/klaviyo";
import { klaviyoStatusOf } from "@/lib/utils/subscriber-status";
import { SubscriberFiltersSchema } from "@/lib/validations/newsletter";

const EXPORT_ROW_CAP = 50_000;

export type ExportSubscribersErrorCode = "VALIDATION_ERROR" | "INTERNAL_ERROR";

export interface SubscriberExportRow {
  email: string;
  locale: string;
  source: "HOME" | "POPUP";
  createdAt: string;
  consentAt: string;
  unsubscribedAt: string | null;
  klaviyo: "SENT" | "WAITING" | "FAILED" | null;
}

export type ExportSubscribersResult =
  | { success: true; rows: SubscriberExportRow[] }
  | { success: false; error: string; errorCode: ExportSubscribersErrorCode };

export async function exportSubscribersAction(
  input: unknown,
): Promise<ExportSubscribersResult> {
  const { id: staffId } = await requireStaffAction("coupon:manage");

  const parsed = SubscriberFiltersSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid filters",
      errorCode: "VALIDATION_ERROR",
    };
  }

  const filters = parsed.data;
  const where = buildSubscriberWhere(filters);
  const orderBy = subscriberOrderBy(filters.sort);

  try {
    const rows = await db.$transaction(async (tx) => {
      const found = await tx.newsletterSubscriber.findMany({
        where,
        orderBy,
        take: EXPORT_ROW_CAP,
        select: {
          email: true,
          locale: true,
          source: true,
          createdAt: true,
          consentAt: true,
          unsubscribedAt: true,
          klaviyoSyncedAt: true,
          klaviyoError: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorType: "STAFF",
          actorId: staffId,
          action: "subscriber.exported",
          entityType: "NewsletterSubscriber",
          entityId: null,
          metadata: {
            count: found.length,
            status: filters.status ?? "ALL",
            search: filters.search || null,
            klaviyo: filters.klaviyo ?? "ALL",
            source: filters.source ?? "ALL",
            language: filters.locale ?? "ALL",
            from: filters.from ?? null,
            to: filters.to ?? null,
            sort: filters.sort ?? "newest",
          },
        },
      });

      return found;
    });

    return {
      success: true,
      rows: rows.map((r) => ({
        email: r.email,
        locale: r.locale,
        source: r.source,
        createdAt: r.createdAt.toISOString(),
        consentAt: r.consentAt.toISOString(),
        unsubscribedAt: r.unsubscribedAt
          ? r.unsubscribedAt.toISOString()
          : null,
        klaviyo: klaviyoStatusOf(r),
      })),
    };
  } catch (err) {
    console.error("[exportSubscribersAction]", err);
    return {
      success: false,
      error: "The export could not be recorded, so no file was produced.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export type UnsubscribeSubscriberErrorCode =
  | "NOT_FOUND"
  | "ALREADY_UNSUBSCRIBED"
  | "INTERNAL_ERROR";

export type UnsubscribeSubscriberResult =
  | { success: true }
  | {
      success: false;
      error: string;
      errorCode: UnsubscribeSubscriberErrorCode;
    };

class UnsubscribeGuardError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "ALREADY_UNSUBSCRIBED") {
    super(code);
  }
}

export async function unsubscribeSubscriberAction(
  id: string,
): Promise<UnsubscribeSubscriberResult> {
  const { id: staffId } = await requireStaffAction("coupon:manage");

  try {
    await db.$transaction(
      async (tx) => {
        const subscriber = await tx.newsletterSubscriber.findUnique({
          where: { id },
          select: { email: true, unsubscribedAt: true },
        });
        if (!subscriber) throw new UnsubscribeGuardError("NOT_FOUND");
        if (subscriber.unsubscribedAt) {
          throw new UnsubscribeGuardError("ALREADY_UNSUBSCRIBED");
        }

        const unsubscribedAt = new Date();

        await tx.newsletterSubscriber.update({
          where: { id },
          data: { unsubscribedAt },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "subscriber.unsubscribed",
            entityType: "NewsletterSubscriber",
            entityId: id,
            before: { unsubscribedAt: null },
            after: { unsubscribedAt: unsubscribedAt.toISOString() },
            metadata: { email: subscriber.email },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/admin/subscribers");

    return { success: true };
  } catch (err) {
    if (err instanceof UnsubscribeGuardError) {
      return {
        success: false,
        error:
          err.code === "NOT_FOUND"
            ? "This subscriber no longer exists."
            : "This subscriber is already unsubscribed.",
        errorCode: err.code,
      };
    }

    console.error("[unsubscribeSubscriberAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export type SendWaitingSubscribersErrorCode =
  | "NOT_CONFIGURED"
  | "NOTHING_TO_SEND"
  | "INTERNAL_ERROR";

export type SendWaitingSubscribersResult =
  | { success: true; data: { sent: number; failed: number; error: string | null } }
  | {
      success: false;
      error: string;
      errorCode: SendWaitingSubscribersErrorCode;
    };

export async function sendWaitingSubscribersToKlaviyoAction(): Promise<SendWaitingSubscribersResult> {
  const { id: staffId } = await requireStaffAction("coupon:manage");

  if (!isKlaviyoConfigured()) {
    return {
      success: false,
      error: "Klaviyo isn't connected.",
      errorCode: "NOT_CONFIGURED",
    };
  }

  try {
    const rows = await db.newsletterSubscriber.findMany({
      where: KLAVIYO_PENDING_WHERE,
      orderBy: { createdAt: "asc" },
      take: KLAVIYO_BULK_MAX,
      select: { id: true, email: true, source: true, consentAt: true },
    });

    if (rows.length === 0) {
      return {
        success: false,
        error: "No subscribers are waiting.",
        errorCode: "NOTHING_TO_SEND",
      };
    }

    const cutoff = Date.now() - KLAVIYO_HISTORICAL_MIN_AGE_MS;
    const groups = new Map<
      string,
      { source: "HOME" | "POPUP"; historical: boolean; rows: typeof rows }
    >();
    for (const row of rows) {
      const historical = row.consentAt.getTime() <= cutoff;
      const key = `${row.source}:${historical ? "historical" : "current"}`;
      const group = groups.get(key);
      if (group) group.rows.push(row);
      else groups.set(key, { source: row.source, historical, rows: [row] });
    }

    const outcomes: { ids: string[]; result: KlaviyoSubscribeResult }[] = [];
    for (const { source, historical, rows: group } of groups.values()) {
      const result = historical
        ? await importSubscribersToKlaviyo({
            source,
            profiles: group.map((r) => ({ email: r.email, consentAt: r.consentAt })),
          })
        : await subscribeEmailsToKlaviyo({
            source,
            emails: group.map((r) => r.email),
          });
      outcomes.push({ ids: group.map((r) => r.id), result });
    }

    const summary = await db.$transaction(
      async (tx) => {
        let sent = 0;
        let failed = 0;
        let error: string | null = null;

        for (const { ids, result } of outcomes) {
          const updated = await tx.newsletterSubscriber.updateMany({
            where: { id: { in: ids }, unsubscribedAt: null },
            data: result.ok
              ? { klaviyoSyncedAt: new Date(), klaviyoError: null }
              : { klaviyoError: result.error },
          });
          if (result.ok) {
            sent += updated.count;
          } else {
            failed += updated.count;
            if (error === null) error = result.error;
          }
        }

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "subscriber.klaviyo_sent",
            entityType: "NewsletterSubscriber",
            entityId: null,
            metadata: { attempted: rows.length, sent, failed, error },
          },
        });

        return { sent, failed, error };
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/admin/subscribers");

    return { success: true, data: summary };
  } catch (err) {
    console.error("[sendWaitingSubscribersToKlaviyoAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}
