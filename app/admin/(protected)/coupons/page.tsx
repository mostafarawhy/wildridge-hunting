import Link from "next/link";
import { requireStaff } from "@/lib/auth-staff";
import {
  getAdminCoupons,
  getAdminCouponStatusCounts,
  getCouponSummary,
  ADMIN_COUPONS_PER_PAGE,
} from "@/lib/db/queries/coupon";
import type {
  AdminCouponFilters,
  CouponSourceFilter,
} from "@/lib/db/queries/coupon";
import { CouponType } from "@/app/generated/prisma/enums";
import { COUPON_STATUSES } from "@/lib/utils/coupon-display";
import type { CouponStatus } from "@/lib/utils/coupon-display";
import {
  AdminPageHeader,
  CouponFilterBar,
  CouponsTable,
} from "@/components/admin";
import AdminPaginationBar from "@/components/admin/AdminPaginationBar";
import CouponSummaryTiles from "@/components/admin/CouponSummaryTiles";

const VALID_SOURCES: CouponSourceFilter[] = ["manual", "reward"];

function isCouponStatus(value: string): value is CouponStatus {
  return (COUPON_STATUSES as string[]).includes(value);
}

function isCouponType(value: string): value is CouponType {
  return (Object.values(CouponType) as string[]).includes(value);
}

function isSource(value: string): value is CouponSourceFilter {
  return (VALID_SOURCES as string[]).includes(value);
}

interface Props {
  searchParams: Promise<{
    q?: string;
    status?: string;
    type?: string;
    source?: string;
    page?: string;
  }>;
}

export default async function AdminCouponsPage({ searchParams }: Props) {
  await requireStaff("coupon:manage");

  const sp = await searchParams;

  const status = sp.status && isCouponStatus(sp.status) ? sp.status : undefined;
  const type = sp.type && isCouponType(sp.type) ? sp.type : undefined;
  const source = sp.source && isSource(sp.source) ? sp.source : undefined;
  const search = sp.q?.trim() || undefined;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const now = new Date();

  const filters: AdminCouponFilters = { search, type, source };

  const [{ items, totalCount }, counts, summary] = await Promise.all([
    getAdminCoupons({ ...filters, status, page, now }),
    getAdminCouponStatusCounts(filters, now),
    getCouponSummary(now),
  ]);

  const totalPages = Math.ceil(totalCount / ADMIN_COUPONS_PER_PAGE);
  const from = totalCount === 0 ? 0 : (page - 1) * ADMIN_COUPONS_PER_PAGE + 1;
  const to = Math.min(page * ADMIN_COUPONS_PER_PAGE, totalCount);

  return (
    <>
      <AdminPageHeader
        title="Coupons"
        subtitle="Discount codes and promotions"
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
            <Link
              href="/admin/coupons/rewards"
              style={{
                fontSize: "var(--text-body)",
                color: "#0b0b0b",
                textDecoration: "underline",
              }}
            >
              Reward rules
            </Link>
            <Link
              href="/admin/coupons/new"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                height: "2.5rem",
                paddingInline: "1.25rem",
                fontSize: "var(--text-body-sm)",
                fontWeight: "var(--font-bold)",
                letterSpacing: "var(--tracking-widest)",
                textTransform: "uppercase",
                backgroundColor: "#0b0b0b",
                color: "#ffffff",
                textDecoration: "none",
                borderRadius: "0",
              }}
            >
              + New coupon
            </Link>
          </div>
        }
      />
      <CouponSummaryTiles {...summary} />
      <CouponFilterBar
        values={{
          status: status ?? "ALL",
          q: search ?? "",
          type: type ?? "",
          source: source ?? "",
        }}
        counts={counts}
      />
      <CouponsTable rows={items} />
      {totalCount > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: "#6b6b6b",
              margin: 0,
            }}
          >
            Showing {from}–{to} of {totalCount}
          </p>
          <AdminPaginationBar totalPages={totalPages} />
        </div>
      )}
    </>
  );
}
