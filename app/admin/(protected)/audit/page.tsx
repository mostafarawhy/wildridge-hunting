import { requireStaff } from "@/lib/auth-staff";
import {
  getAuditLogList,
  getAuditFilterFacets,
} from "@/lib/db/queries/audit-log";
import type { AuditActorType } from "@/app/generated/prisma/enums";
import {
  FILTERABLE_AUDIT_CATEGORIES,
  type AuditCategory,
} from "@/lib/utils/audit-taxonomy";
import { AdminPageHeader } from "@/components/admin";
import AuditLogTable from "@/components/admin/AuditLogTable";
import AuditFilterBar from "@/components/admin/AuditFilterBar";
import AdminPaginationBar from "@/components/admin/AdminPaginationBar";

const VALID_ACTOR_TYPES: AuditActorType[] = ["STAFF", "CUSTOMER", "SYSTEM"];

const PAGE_SIZE = 50;

interface Props {
  searchParams: Promise<{
    category?: string;
    entityType?: string;
    action?: string;
    actorType?: string;
    actorId?: string;
    entityId?: string;
    q?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}

export default async function AdminAuditPage({ searchParams }: Props) {
  await requireStaff("audit:read");

  const {
    category: categoryParam,
    entityType,
    action,
    actorType: actorTypeParam,
    actorId,
    entityId,
    q,
    from,
    to,
    page: pageParam,
  } = await searchParams;

  const actorType =
    actorTypeParam &&
    VALID_ACTOR_TYPES.includes(actorTypeParam as AuditActorType)
      ? (actorTypeParam as AuditActorType)
      : undefined;

  const category =
    categoryParam &&
    FILTERABLE_AUDIT_CATEGORIES.includes(categoryParam as AuditCategory)
      ? (categoryParam as AuditCategory)
      : undefined;

  const page = Math.max(1, Number(pageParam ?? 1) || 1);

  const [{ items, total }, facets] = await Promise.all([
    getAuditLogList({
      entityType,
      action,
      actorType,
      actorId,
      entityId,
      search: q,
      from,
      to,
      category,
      page,
      pageSize: PAGE_SIZE,
    }),
    getAuditFilterFacets(),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <>
      <AdminPageHeader
        title="Audit Log"
        subtitle="System activity and change history"
      />
      <AuditFilterBar
        category={category ?? "ALL"}
        entityType={entityType ?? "ALL"}
        action={action ?? "ALL"}
        actorType={actorType ?? "ALL"}
        actorId={actorId ?? "ALL"}
        entityId={entityId ?? ""}
        query={q ?? ""}
        from={from ?? ""}
        to={to ?? ""}
        facets={facets}
      />
      <AuditLogTable rows={items} />
      <AdminPaginationBar totalPages={totalPages} />
    </>
  );
}
