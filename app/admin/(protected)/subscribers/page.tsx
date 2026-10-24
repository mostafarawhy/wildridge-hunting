import { requireStaff } from "@/lib/auth-staff";
import {
  getAdminSubscribers,
  getSubscriberSummary,
} from "@/lib/db/queries/newsletter";
import { isKlaviyoConfigured } from "@/lib/services/klaviyo";
import { SubscriberFiltersSchema } from "@/lib/validations/newsletter";
import { AdminPageHeader } from "@/components/admin";
import AdminPaginationBar from "@/components/admin/AdminPaginationBar";
import SubscriberExportButton from "@/components/admin/SubscriberExportButton";
import SubscriberFilterBar from "@/components/admin/SubscriberFilterBar";
import SubscriberKlaviyoSendButton from "@/components/admin/SubscriberKlaviyoSendButton";
import SubscriberKlaviyoSendResult, {
  SubscriberKlaviyoSendResultProvider,
} from "@/components/admin/SubscriberKlaviyoSendResult";
import SubscriberSummaryTiles from "@/components/admin/SubscriberSummaryTiles";
import SubscribersTable from "@/components/admin/SubscribersTable";

interface Props {
  searchParams: Promise<{
    q?: string;
    status?: string;
    klaviyo?: string;
    source?: string;
    lang?: string;
    from?: string;
    to?: string;
    sort?: string;
    page?: string;
  }>;
}

export default async function AdminSubscribersPage({ searchParams }: Props) {
  await requireStaff("coupon:manage");

  const {
    q,
    status,
    klaviyo,
    source,
    lang,
    from,
    to,
    sort,
    page: pageParam,
  } = await searchParams;

  const filters = SubscriberFiltersSchema.parse({
    search: q,
    status,
    klaviyo,
    source,
    locale: lang,
    from,
    to,
    sort,
  });
  const page = Math.max(1, Number(pageParam ?? 1) || 1);

  const klaviyoConfigured = isKlaviyoConfigured();

  const [{ rows, total, pageSize }, summary] = await Promise.all([
    getAdminSubscribers(filters, page),
    getSubscriberSummary(),
  ]);
  const pendingCount = summary.waiting + summary.failed;

  const totalPages = Math.ceil(total / pageSize);

  return (
    <SubscriberKlaviyoSendResultProvider>
      <AdminPageHeader
        title="Subscribers"
        subtitle="People who signed up for the newsletter on the homepage or the popup"
        actions={
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              alignItems: "flex-start",
            }}
          >
            {klaviyoConfigured && (
              <SubscriberKlaviyoSendButton pendingCount={pendingCount} />
            )}
            <SubscriberExportButton filters={filters} />
          </div>
        }
      />
      <SubscriberKlaviyoSendResult />
      <SubscriberSummaryTiles
        subscribed={summary.subscribed}
        unsubscribed={summary.unsubscribed}
        waiting={summary.waiting}
        failed={summary.failed}
        klaviyoConfigured={klaviyoConfigured}
      />
      <SubscriberFilterBar filters={filters} />
      <p
        style={{
          fontSize: "var(--text-body-sm)",
          color: "#6b6b6b",
          marginBottom: "0.75rem",
        }}
      >
        {`${total.toLocaleString("en-US")} ${total === 1 ? "subscriber" : "subscribers"}`}
      </p>
      <SubscribersTable rows={rows} klaviyoConfigured={klaviyoConfigured} />
      <AdminPaginationBar totalPages={totalPages} />
    </SubscriberKlaviyoSendResultProvider>
  );
}
