import Link from "next/link";
import { requireStaff } from "@/lib/auth-staff";
import { isDemoMode } from "@/lib/config/demo";
import {
  getEmailLogList,
  getEmailLogFacets,
  getPausedTemplateKeys,
} from "@/lib/db/queries/email-log";
import { EMAIL_DEFAULTS } from "@/lib/email/defaults";
import { dubaiRecentDays } from "@/lib/utils/date";
import type { EmailStatus } from "@/app/generated/prisma/enums";
import { AdminPageHeader } from "@/components/admin";
import EmailLogTable from "@/components/admin/EmailLogTable";
import EmailLogFilterBar from "@/components/admin/EmailLogFilterBar";
import AdminPaginationBar from "@/components/admin/AdminPaginationBar";

const VALID_STATUSES: EmailStatus[] = ["PENDING", "SENT", "FAILED"];

const PAGE_SIZE = 50;

interface Props {
  searchParams: Promise<{
    status?: string;
    templateKey?: string;
    q?: string;
    from?: string;
    to?: string;
    range?: string;
    page?: string;
  }>;
}

export default async function AdminEmailLogPage({ searchParams }: Props) {
  await requireStaff("settings:manage");

  const {
    status: statusParam,
    templateKey,
    q,
    from,
    to,
    range,
    page: pageParam,
  } = await searchParams;

  const status =
    statusParam && VALID_STATUSES.includes(statusParam as EmailStatus)
      ? (statusParam as EmailStatus)
      : undefined;

  const page = Math.max(1, Number(pageParam ?? 1) || 1);

  const allTime = range === "all";
  const isDefaultRange = !from && !to && !allTime;
  const defaultRange = dubaiRecentDays(30);
  const effectiveFrom = isDefaultRange ? defaultRange.from : from;
  const effectiveTo = isDefaultRange ? defaultRange.to : to;

  const [{ items, total }, facets, pausedKeys] = await Promise.all([
    getEmailLogList({
      status,
      templateKey,
      search: q,
      from: effectiveFrom,
      to: effectiveTo,
      page,
      pageSize: PAGE_SIZE,
    }),
    getEmailLogFacets(),
    getPausedTemplateKeys(),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <>
      <AdminPageHeader
        title="Email Log"
        subtitle="Every transactional send and its outcome"
      />
      {isDemoMode() && (
        <div
          role="status"
          style={{
            padding: "0.625rem 0.875rem",
            marginBottom: "1.5rem",
            fontSize: "var(--text-body-sm)",
            backgroundColor: "var(--color-status-warning-bg)",
            border: "1px solid var(--color-status-warning-border)",
            color: "var(--color-status-warning-text)",
          }}
        >
          Demo: emails are simulated and never delivered. Each send is logged here as Simulated.
        </div>
      )}
      {pausedKeys.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            borderInlineStart: "3px solid var(--color-status-warning)",
            paddingInlineStart: "0.75rem",
            marginBottom: "1.5rem",
          }}
        >
          <p
            style={{
              fontSize: "var(--text-body)",
              color: "#0b0b0b",
              fontWeight: "var(--font-medium)",
              margin: 0,
            }}
          >
            Paused templates
          </p>
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: "#6b6b6b",
              margin: 0,
            }}
          >
            These send nothing and write no log rows.
          </p>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}
          >
            {pausedKeys.map((key) => (
              <Link
                key={key}
                href={`/admin/email-templates/${key}`}
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "var(--color-action-primary)",
                }}
              >
                {EMAIL_DEFAULTS[key]?.label ?? key}
              </Link>
            ))}
          </div>
        </div>
      )}
      <EmailLogFilterBar
        status={status ?? "ALL"}
        templateKey={templateKey ?? "ALL"}
        query={q ?? ""}
        from={effectiveFrom ?? ""}
        to={effectiveTo ?? ""}
        allTime={allTime}
        isDefaultRange={isDefaultRange}
        facets={facets}
      />
      <EmailLogTable rows={items} />
      <AdminPaginationBar totalPages={totalPages} />
    </>
  );
}
