import "server-only";
import { db } from "@/lib/db/client";
import { toISOString, dubaiDayBoundsUtc } from "@/lib/utils/date";
import type { SubscriberFilters } from "@/lib/validations/newsletter";
import type { Prisma } from "@/app/generated/prisma/client";

const SUBSCRIBERS_PAGE_SIZE = 25;

export function buildSubscriberWhere(
  f: SubscriberFilters,
): Prisma.NewsletterSubscriberWhereInput {
  const and: Prisma.NewsletterSubscriberWhereInput[] = [];

  if (f.search) {
    and.push({ email: { contains: f.search, mode: "insensitive" } });
  }
  if (f.status === "SUBSCRIBED") and.push({ unsubscribedAt: null });
  if (f.status === "UNSUBSCRIBED") and.push({ unsubscribedAt: { not: null } });
  if (f.source) and.push({ source: f.source });
  if (f.locale) and.push({ locale: f.locale });

  const fromBounds = f.from ? dubaiDayBoundsUtc(f.from) : null;
  if (fromBounds) and.push({ createdAt: { gte: fromBounds.start } });
  const toBounds = f.to ? dubaiDayBoundsUtc(f.to) : null;
  if (toBounds) and.push({ createdAt: { lt: toBounds.end } });

  if (f.klaviyo === "FAILED") {
    and.push({ unsubscribedAt: null, klaviyoError: { not: null } });
  }
  if (f.klaviyo === "SENT") {
    and.push({
      unsubscribedAt: null,
      klaviyoError: null,
      klaviyoSyncedAt: { not: null },
    });
  }
  if (f.klaviyo === "WAITING") {
    and.push({
      unsubscribedAt: null,
      klaviyoError: null,
      klaviyoSyncedAt: null,
    });
  }

  return { AND: and };
}

export const KLAVIYO_PENDING_WHERE: Prisma.NewsletterSubscriberWhereInput = {
  unsubscribedAt: null,
  OR: [{ klaviyoSyncedAt: null }, { klaviyoError: { not: null } }],
};

export async function getSubscriberSummary(): Promise<{
  subscribed: number;
  unsubscribed: number;
  waiting: number;
  failed: number;
}> {
  const [subscribed, unsubscribed, waiting, failed] = await Promise.all([
    db.newsletterSubscriber.count({ where: { unsubscribedAt: null } }),
    db.newsletterSubscriber.count({ where: { unsubscribedAt: { not: null } } }),
    db.newsletterSubscriber.count({
      where: buildSubscriberWhere({ klaviyo: "WAITING" }),
    }),
    db.newsletterSubscriber.count({
      where: buildSubscriberWhere({ klaviyo: "FAILED" }),
    }),
  ]);
  return { subscribed, unsubscribed, waiting, failed };
}

export function subscriberOrderBy(
  sort: SubscriberFilters["sort"],
): Prisma.NewsletterSubscriberOrderByWithRelationInput[] {
  if (sort === "oldest") return [{ createdAt: "asc" }, { id: "asc" }];
  if (sort === "email") return [{ email: "asc" }];
  return [{ createdAt: "desc" }, { id: "desc" }];
}

export interface AdminSubscriberRow {
  id: string;
  email: string;
  locale: string;
  source: "HOME" | "POPUP";
  createdAt: string;
  consentAt: string;
  unsubscribedAt: string | null;
  klaviyoSyncedAt: string | null;
  klaviyoError: string | null;
}

export async function getAdminSubscribers(
  filters: SubscriberFilters,
  pageNumber: number,
): Promise<{
  rows: AdminSubscriberRow[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const where = buildSubscriberWhere(filters);

  const page = Math.max(1, pageNumber);

  const [total, rows] = await Promise.all([
    db.newsletterSubscriber.count({ where }),
    db.newsletterSubscriber.findMany({
      where,
      orderBy: subscriberOrderBy(filters.sort),
      skip: (page - 1) * SUBSCRIBERS_PAGE_SIZE,
      take: SUBSCRIBERS_PAGE_SIZE,
      select: {
        id: true,
        email: true,
        locale: true,
        source: true,
        createdAt: true,
        consentAt: true,
        unsubscribedAt: true,
        klaviyoSyncedAt: true,
        klaviyoError: true,
      },
    }),
  ]);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      email: r.email,
      locale: r.locale,
      source: r.source,
      createdAt: toISOString(r.createdAt),
      consentAt: toISOString(r.consentAt),
      unsubscribedAt: r.unsubscribedAt ? toISOString(r.unsubscribedAt) : null,
      klaviyoSyncedAt: r.klaviyoSyncedAt
        ? toISOString(r.klaviyoSyncedAt)
        : null,
      klaviyoError: r.klaviyoError,
    })),
    total,
    page,
    pageSize: SUBSCRIBERS_PAGE_SIZE,
  };
}
