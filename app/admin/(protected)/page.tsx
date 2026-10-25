import { requireStaff } from "@/lib/auth-staff";
import {
  getDashboardKpis,
  getDashboardTrends,
  getDashboardQueues,
  getOrderPipeline,
} from "@/lib/db/queries/admin-dashboard";
import { formatAED } from "@/lib/utils/currency";
import {
  AdminPageHeader,
  DashboardActionList,
  KpiCard,
  OrderPipelineCard,
  RevenueTrendChart,
} from "@/components/admin";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireStaff("dashboard:view");

  const [kpis, trends, queues, pipeline] = await Promise.all([
    getDashboardKpis(),
    getDashboardTrends(),
    getDashboardQueues(),
    getOrderPipeline(),
  ]);

  const gstTime = new Intl.DateTimeFormat("en-AE", {
    timeZone: "Asia/Dubai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());

  const ordersSparkline = trends.orders.map((d) => d.value);
  const aovSparkline = trends.aov.map((d) => d.value);
  const customersSparkline = trends.newCustomers.map((d) => d.value);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <AdminPageHeader
        title="Dashboard"
        subtitle={`Updated ${gstTime} GST`}
      />

      <div
        style={{
          backgroundColor: "#ffffff",
          border: "1px solid var(--color-shop-divider)",
          padding: "1.25rem 1.5rem",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.5rem 1rem",
            marginBottom: "0.75rem",
          }}
        >
          <div>
            <p
              style={{
                fontSize: "var(--text-label)",
                fontWeight: "var(--font-semibold)",
                letterSpacing: "var(--tracking-wide)",
                textTransform: "uppercase",
                color: "#6b6b6b",
                marginBottom: "0.375rem",
              }}
            >
              Revenue · last 30 days
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                flexWrap: "wrap",
              }}
            >
              <p
                dir="ltr"
                style={{
                  fontSize: "var(--text-display-sm)",
                  fontWeight: "var(--font-bold)",
                  color: "#0b0b0b",
                  lineHeight: "var(--leading-tight)",
                }}
              >
                {formatAED(kpis.revenue.value, "en")}
              </p>
              {kpis.revenue.deltaPct !== null && (
                <span
                  style={{
                    fontSize: "var(--text-body-sm)",
                    fontWeight: "var(--font-semibold)",
                    color:
                      kpis.revenue.deltaPct > 0 ? "#166534" : "#991b1b",
                    backgroundColor:
                      kpis.revenue.deltaPct > 0 ? "#dcfce7" : "#fee2e2",
                    paddingInline: "0.5rem",
                    paddingBlock: "0.25rem",
                  }}
                >
                  {kpis.revenue.deltaPct > 0 ? "↑" : "↓"}{" "}
                  {Math.abs(kpis.revenue.deltaPct)}%
                </span>
              )}
            </div>
          </div>
          <p
            dir="ltr"
            style={{
              fontSize: "var(--text-body-sm)",
              color: "#6b6b6b",
              textAlign: "end",
              flexShrink: 0,
            }}
          >
            {kpis.orders.value.toLocaleString("en-AE")} orders ·{" "}
            {formatAED(kpis.aov.value, "en")} avg
          </p>
        </div>
        <RevenueTrendChart
          current={trends.revenue}
          previous={trends.revenuePrevious}
        />
      </div>

      <div
        className="grid grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(170px,1fr))]"
        style={{ gap: "1rem" }}
      >
        <KpiCard
          label="Orders"
          value={kpis.orders.value}
          deltaPct={kpis.orders.deltaPct}
          sparkline={ordersSparkline}
          format="number"
        />
        <KpiCard
          label="Avg order value"
          value={kpis.aov.value}
          deltaPct={kpis.aov.deltaPct}
          sparkline={aovSparkline}
          format="currency"
        />
        <KpiCard
          label="Active customers"
          value={kpis.customers.value}
          newInPeriod={kpis.customers.newInPeriod}
          sparkline={customersSparkline}
          format="number"
        />
      </div>

      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        }}
      >
        <DashboardActionList
          newQuotes={queues.newQuotes}
          openTickets={queues.openTickets}
          pendingB2B={queues.pendingB2B}
          staleShipped={queues.staleShipped}
          staleShippedDays={queues.staleShippedDays}
          ordersAwaitingAction={queues.ordersAwaitingAction}
          refundsOwed={queues.refundsOwed}
        />
        <OrderPipelineCard pipeline={pipeline} />
      </div>
    </div>
  );
}
