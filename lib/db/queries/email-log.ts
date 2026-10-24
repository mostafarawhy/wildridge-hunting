import "server-only";
import { db } from "@/lib/db/client";
import { toISOString, dubaiDayBoundsUtc } from "@/lib/utils/date";
import { UNPAUSABLE_TEMPLATE_KEYS } from "@/lib/email/defaults";
import type { EmailStatus } from "@/app/generated/prisma/enums";
import type { Prisma } from "@/app/generated/prisma/client";

export interface EmailLogListItem {
  id: string;
  templateKey: string;
  toEmail: string;
  subject: string | null;
  locale: string | null;
  status: EmailStatus;
  error: string | null;
  providerEmailId: string | null;
  orderId: string | null;
  quoteRequestId: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface EmailLogFilters {
  status?: EmailStatus;
  templateKey?: string;
  search?: string;
  from?: string;
  to?: string;
}

export interface EmailLogPage {
  items: EmailLogListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export async function getEmailLogList(
  opts?: EmailLogFilters & { page?: number; pageSize?: number },
): Promise<EmailLogPage> {
  const where: Prisma.EmailLogWhereInput = {};

  if (opts?.status) {
    where.status = opts.status;
  }

  if (opts?.templateKey) {
    where.templateKey = opts.templateKey;
  }

  const term = opts?.search?.trim();
  if (term) {
    where.OR = [
      { toEmail: { contains: term, mode: "insensitive" } },
      { subject: { contains: term, mode: "insensitive" } },
    ];
  }

  const fromBounds = opts?.from ? dubaiDayBoundsUtc(opts.from) : null;
  const toBounds = opts?.to ? dubaiDayBoundsUtc(opts.to) : null;
  if (fromBounds || toBounds) {
    where.createdAt = {
      ...(fromBounds ? { gte: fromBounds.start } : {}),
      ...(toBounds ? { lt: toBounds.end } : {}),
    };
  }

  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = opts?.pageSize ?? 50;
  const skip = (page - 1) * pageSize;

  const [total, rows] = await Promise.all([
    db.emailLog.count({ where }),
    db.emailLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        templateKey: true,
        toEmail: true,
        subject: true,
        locale: true,
        status: true,
        error: true,
        providerEmailId: true,
        orderId: true,
        quoteRequestId: true,
        sentAt: true,
        createdAt: true,
      },
    }),
  ]);

  const items = rows.map((row) => ({
    id: row.id,
    templateKey: row.templateKey,
    toEmail: row.toEmail,
    subject: row.subject,
    locale: row.locale,
    status: row.status,
    error: row.error,
    providerEmailId: row.providerEmailId,
    orderId: row.orderId,
    quoteRequestId: row.quoteRequestId,
    sentAt: row.sentAt ? toISOString(row.sentAt) : null,
    createdAt: toISOString(row.createdAt),
  }));

  return { items, total, page, pageSize };
}

export interface EmailLogFacets {
  templateKeys: string[];
}

export async function getEmailLogFacets(): Promise<EmailLogFacets> {
  const rows = await db.emailLog.findMany({
    distinct: ["templateKey"],
    select: { templateKey: true },
    orderBy: { templateKey: "asc" },
  });

  return { templateKeys: rows.map((r) => r.templateKey) };
}

export async function getPausedTemplateKeys(): Promise<string[]> {
  const rows = await db.emailTemplate.findMany({
    where: { locale: "en", enabled: false },
    select: { templateKey: true },
  });

  return rows
    .map((r) => r.templateKey)
    .filter((key) => !UNPAUSABLE_TEMPLATE_KEYS.has(key));
}
