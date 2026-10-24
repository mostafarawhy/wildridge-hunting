"use client";

import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import DataTable from "@/components/admin/DataTable";
import ProductRowActions from "@/components/admin/ProductRowActions";
import FadeImage from "@/components/ui/FadeImage";
import PublishStatusPill from "@/components/ui/PublishStatusPill";
import { formatAED } from "@/lib/utils/currency";
import { getImageUrl } from "@/lib/utils/images";
import type { AdminProductListItemProjection } from "@/lib/db/queries/products";

interface Props {
  rows: AdminProductListItemProjection[];
}

export default function ProductsTable({ rows }: Props) {
  const router = useRouter();

  return (
    <DataTable
      rows={rows}
      getRowKey={(row) => row.id}
      onRowClick={(row) => {
        const href = `/admin/products/${row.id}`;
        startNavigationProgress(href);
        router.push(href);
      }}
      emptyMessage="No products match these filters."
      columns={[
        {
          key: "thumbnail",
          header: "Image",
          render: (row) => (
            <div
              style={{
                position: "relative",
                width: 48,
                height: 48,
                flexShrink: 0,
                overflow: "hidden",
                border: "1px solid var(--color-shop-divider)",
              }}
            >
              <FadeImage
                src={getImageUrl(row.primaryImageKey)}
                alt=""
                fill
                sizes="48px"
                className="object-cover"
              />
            </div>
          ),
        },
        {
          key: "product",
          header: "Product",
          render: (row) => {
            const flags: string[] = [];
            if (row.requiresIdVerification) flags.push("ID required");
            if (row.serialTracking === "SERIAL") flags.push("Serial");
            if (row.serialTracking === "LOT") flags.push("Lot");
            if (row.accessoryCount > 0) {
              flags.push(
                `${row.accessoryCount} ${row.accessoryCount === 1 ? "accessory" : "accessories"}`,
              );
            }
            return (
              <div>
                <p style={{ fontWeight: "var(--font-medium)", color: "#0b0b0b" }}>
                  {row.nameEn}
                </p>
                <p
                  dir="ltr"
                  style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}
                >
                  {row.sku} · {row.brand} · {row.categoryNameEn}
                </p>
                {flags.length > 0 && (
                  <p style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
                    {flags.join(" · ")}
                  </p>
                )}
              </div>
            );
          },
        },
        {
          key: "price",
          header: "Price",
          align: "end",
          render: (row) => (
            <div dir="ltr" style={{ textAlign: "end" }}>
              <span style={{ color: "#0b0b0b" }}>
                {formatAED(row.price, "en")}
              </span>
              {row.compareAtPrice != null && (
                <span
                  style={{
                    display: "block",
                    fontSize: "var(--text-body-sm)",
                    color: "#6b6b6b",
                    textDecoration: "line-through",
                  }}
                >
                  {formatAED(row.compareAtPrice, "en")}
                </span>
              )}
            </div>
          ),
        },
        {
          key: "stock",
          header: "Stock",
          align: "end",
          render: (row) => {
            const isOut = row.stockQuantity === 0;
            const isLow = !isOut && row.stockQuantity <= row.lowStockThreshold;
            const label = isOut ? "Out of stock" : isLow ? "Low stock" : "In stock";
            const color = isOut ? "#991b1b" : isLow ? "#854d0e" : "#166534";
            return (
              <span dir="ltr" style={{ color, whiteSpace: "nowrap" }}>
                {row.stockQuantity} · {label}
              </span>
            );
          },
        },
        {
          key: "status",
          header: "Status",
          render: (row) => <PublishStatusPill status={row.publishStatus} />,
        },
        {
          key: "actions",
          header: "Actions",
          align: "end",
          render: (row) => (
            <ProductRowActions
              id={row.id}
              name={row.nameEn}
              status={row.publishStatus}
              slugEn={row.slugEn}
              categorySlug={row.categorySlug}
            />
          ),
        },
      ]}
    />
  );
}
