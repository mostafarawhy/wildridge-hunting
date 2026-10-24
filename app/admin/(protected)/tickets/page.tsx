import Link from "next/link";
import { requireStaff } from "@/lib/auth-staff";
import {
  getAdminTickets,
  getTicketLinkTarget,
  getTicketQuickViewCounts,
} from "@/lib/db/queries/ticket";
import type { TicketStatus, TicketPriority, TicketCategory } from "@/lib/db/queries/ticket";
import { getAssignableStaff } from "@/lib/db/queries/staff";
import {
  TICKET_STATUS_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_CATEGORY_LABELS,
} from "@/lib/utils/ticket-status";
import { AdminPageHeader } from "@/components/admin";
import TicketsTable from "@/components/admin/TicketsTable";
import TicketFilterBar from "@/components/admin/TicketFilterBar";
import TicketCreateController from "@/components/admin/TicketCreateController";
import AdminPaginationBar from "@/components/admin/AdminPaginationBar";
import { can } from "@/lib/utils/staff-permissions";

const VALID_STATUSES = Object.keys(TICKET_STATUS_LABELS) as TicketStatus[];
const VALID_PRIORITIES = Object.keys(
  TICKET_PRIORITY_LABELS,
) as TicketPriority[];
const VALID_CATEGORIES = Object.keys(
  TICKET_CATEGORY_LABELS,
) as TicketCategory[];
const VALID_LINK_KINDS = ["order", "quote", "b2b", "verification", "none"] as const;
const VALID_SORTS = ["priority", "newest", "oldest", "updated"] as const;

const PAGE_SIZE = 50;

interface Props {
  searchParams: Promise<{
    status?: string;
    priority?: string;
    category?: string;
    link?: string;
    assignee?: string;
    source?: string;
    from?: string;
    to?: string;
    sort?: string;
    q?: string;
    orderId?: string;
    quoteRequestId?: string;
    b2bAccountId?: string;
    verificationEventId?: string;
    customerId?: string;
    page?: string;
  }>;
}

export default async function AdminTicketsPage({ searchParams }: Props) {
  const { id: currentStaffId, staffRole } = await requireStaff("ticket:read");

  const {
    status: statusParam,
    priority: priorityParam,
    category: categoryParam,
    link: linkParam,
    assignee: assigneeParam,
    source: sourceParam,
    from: fromParam,
    to: toParam,
    sort: sortParam,
    q,
    orderId,
    quoteRequestId,
    b2bAccountId,
    verificationEventId,
    customerId,
    page: pageParam,
  } = await searchParams;

  const validStatus =
    statusParam && VALID_STATUSES.includes(statusParam as TicketStatus)
      ? (statusParam as TicketStatus)
      : undefined;

  const validPriority =
    priorityParam && VALID_PRIORITIES.includes(priorityParam as TicketPriority)
      ? (priorityParam as TicketPriority)
      : undefined;

  const validCategory =
    categoryParam && VALID_CATEGORIES.includes(categoryParam as TicketCategory)
      ? (categoryParam as TicketCategory)
      : undefined;

  const validLinkKind =
    linkParam &&
    (VALID_LINK_KINDS as readonly string[]).includes(linkParam)
      ? (linkParam as (typeof VALID_LINK_KINDS)[number])
      : undefined;

  const validSort =
    sortParam && (VALID_SORTS as readonly string[]).includes(sortParam)
      ? (sortParam as (typeof VALID_SORTS)[number])
      : undefined;

  const validSource =
    sourceParam === "customer" || sourceParam === "staff"
      ? sourceParam
      : undefined;

  const assignableStaff = await getAssignableStaff();

  const validAssignee =
    assigneeParam === "unassigned" || assigneeParam === "me"
      ? assigneeParam
      : assigneeParam && assignableStaff.some((s) => s.id === assigneeParam)
        ? assigneeParam
        : undefined;

  const assigneeId =
    validAssignee === "unassigned"
      ? null
      : validAssignee === "me"
        ? currentStaffId
        : validAssignee;

  const showAll = statusParam === "ALL";
  const activeStatus = validStatus ?? (showAll ? "ALL" : "ACTIVE");
  const activePriority = validPriority ?? "ALL";
  const activeCategory = validCategory ?? "ALL";
  const activeLink = validLinkKind ?? "ALL";
  const activeAssignee = validAssignee ?? "ALL";
  const activeSource = validSource ?? "ALL";
  const activeSort = validSort ?? "priority";
  const search = q?.trim() || undefined;
  const page = Math.max(1, Number(pageParam ?? 1) || 1);

  const linkTargetParam = orderId
    ? { kind: "order" as const, id: orderId }
    : quoteRequestId
      ? { kind: "quote" as const, id: quoteRequestId }
      : b2bAccountId
        ? { kind: "b2b" as const, id: b2bAccountId }
        : verificationEventId
          ? { kind: "verification" as const, id: verificationEventId }
          : null;

  const [{ items: rows, total }, counts, prefill] = await Promise.all([
    getAdminTickets({
      status: validStatus,
      priority: validPriority,
      search,
      includeClosed: showAll,
      customerId,
      category: validCategory,
      linkKind: validLinkKind,
      assigneeId,
      source: validSource,
      from: fromParam,
      to: toParam,
      sort: validSort,
      page,
      pageSize: PAGE_SIZE,
    }),
    getTicketQuickViewCounts(currentStaffId),
    linkTargetParam
      ? getTicketLinkTarget(linkTargetParam.kind, linkTargetParam.id)
      : Promise.resolve(null),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const autoOpen = prefill !== null;

  const canManageTickets = can(staffRole, "ticket:manage");

  return (
    <>
      <AdminPageHeader
        title="Tickets"
        subtitle="Internal support & complaint cases"
        actions={
          canManageTickets ? (
            <TicketCreateController
              prefill={prefill}
              autoOpen={autoOpen}
              assignableStaff={assignableStaff}
            />
          ) : null
        }
      />
      {customerId && (
        <p style={{ fontSize: "var(--text-body-sm)", color: "var(--color-content-tertiary)" }}>
          Filtered to one customer.{" "}
          <Link
            href="/admin/tickets"
            style={{ color: "var(--color-action-primary)", textDecoration: "none" }}
          >
            Show all tickets →
          </Link>
        </p>
      )}
      <TicketFilterBar
        activeStatus={activeStatus}
        activePriority={activePriority}
        activeCategory={activeCategory}
        activeLink={activeLink}
        activeAssignee={activeAssignee}
        activeSource={activeSource}
        activeSort={activeSort}
        query={search ?? ""}
        from={fromParam ?? ""}
        to={toParam ?? ""}
        assignableStaff={assignableStaff}
        counts={counts}
      />
      <p style={{ fontSize: "var(--text-body-sm)", color: "var(--color-content-tertiary)" }}>
        {total} {total === 1 ? "ticket" : "tickets"}
      </p>
      <TicketsTable rows={rows} currentStaffId={currentStaffId} />
      <AdminPaginationBar totalPages={totalPages} />
    </>
  );
}
