"use server";

import { z } from "zod";
import { db } from "@/lib/db/client";
import { requireStaffAction } from "@/lib/auth-staff";
import { can } from "@/lib/utils/staff-permissions";
import { buildAdminQuotesWhere } from "@/lib/db/queries/quote";
import { QuoteStatus } from "@/app/generated/prisma/enums";
import {
  CONVERTED_QUOTE_LABEL,
  QUOTE_STATUS_LABELS,
} from "@/lib/utils/quote-status";
import { roundMoney, sumMoney } from "@/lib/utils/currency";
import { dubaiDay } from "@/lib/utils/date";
import type { Prisma } from "@/app/generated/prisma/client";

const EXPORT_ROW_CAP = 5000;

const filtersSchema = z.object({
  view: z
    .enum(["PRICING", "AWAITING", "ACCEPTED", "CONVERTED", "CLOSED"])
    .optional(),
  status: z.enum(QuoteStatus).optional(),
  priced: z.enum(["YES", "NO"]).optional(),
  from: z.string().trim().max(10).optional(),
  to: z.string().trim().max(10).optional(),
  search: z.string().trim().max(200).optional(),
  sort: z.enum(["newest", "oldest", "total_desc", "total_asc"]).optional(),
});

const exportInputSchema = z.union([
  z.object({ filters: filtersSchema }),
  z.object({ quoteIds: z.array(z.string().min(1)).min(1).max(500) }),
]);

export interface QuoteExportRow {
  quoteNumber: string;
  submitted: string;
  status: string;
  order: string;
  company: string;
  customer: string;
  email: string;
  tradeLicence: string;
  vatNumber: string;
  lines: number;
  unitsRequested: number;
  unitsQuoted: number;
  itemsTotal: number | null;
  shipping: number | null;
  quotedTotal: number | null;
  shippingMethod: string;
  quotedOn: string;
  quotedBy: string;
}

export interface QuoteExportLine {
  quoteNumber: string;
  status: string;
  type: "Product" | "Add-on";
  sku: string;
  item: string;
  requestedQty: number | null;
  quotedQty: number;
  unitPrice: number | null;
  lineTotal: number | null;
}

export type ExportQuotesErrorCode =
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

export type ExportQuotesResult =
  | {
      success: true;
      rows: QuoteExportRow[];
      lines: QuoteExportLine[];
      truncated: boolean;
    }
  | { success: false; error: string; errorCode: ExportQuotesErrorCode };

function moneyOrNull(value: Prisma.Decimal | null): number | null {
  return value === null ? null : roundMoney(Number(value));
}

export async function exportQuotesAction(
  input: unknown,
): Promise<ExportQuotesResult> {
  const staff = await requireStaffAction("quote:read");

  if (!can(staff.staffRole, "quote:manage")) {
    return {
      success: false,
      error: "You do not have permission to export quotes.",
      errorCode: "FORBIDDEN",
    };
  }

  const parsed = exportInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid export request.",
      errorCode: "VALIDATION_ERROR",
    };
  }

  try {
    const data = parsed.data;
    const mode: "filtered" | "selected" =
      "filters" in data ? "filtered" : "selected";

    const where: Prisma.QuoteRequestWhereInput =
      "filters" in data
        ? buildAdminQuotesWhere(data.filters)
        : { id: { in: data.quoteIds } };

    const sort = "filters" in data ? data.filters.sort : undefined;
    const orderBy: Prisma.QuoteRequestOrderByWithRelationInput[] =
      sort === "oldest"
        ? [{ createdAt: "asc" }, { id: "asc" }]
        : sort === "total_desc"
          ? [{ quotedTotal: { sort: "desc", nulls: "last" } }, { id: "asc" }]
          : sort === "total_asc"
            ? [{ quotedTotal: { sort: "asc", nulls: "last" } }, { id: "asc" }]
            : [{ createdAt: "desc" }, { id: "asc" }];

    const result = await db.$transaction(async (tx) => {
      const matching = await tx.quoteRequest.count({ where });

      const quotes = await tx.quoteRequest.findMany({
        where,
        orderBy,
        take: EXPORT_ROW_CAP,
        select: {
          quoteNumber: true,
          status: true,
          createdAt: true,
          snapshotTradeLicenseNo: true,
          snapshotVatNumber: true,
          quotedTotal: true,
          quotedAt: true,
          shippingCost: true,
          shippingMethodLabel: true,
          convertedOrderId: true,
          convertedOrder: { select: { orderNumber: true } },
          quotedByStaff: { select: { name: true } },
          b2bAccount: {
            select: {
              companyNameEn: true,
              tradeLicenseNo: true,
              vatNumber: true,
            },
          },
          customer: { select: { name: true, email: true } },
          items: {
            orderBy: { createdAt: "asc" },
            select: {
              productSku: true,
              productNameEn: true,
              quantity: true,
              requestedQuantity: true,
              quotedUnitPrice: true,
              quotedLineTotal: true,
              selectedAddons: {
                orderBy: { createdAt: "asc" },
                select: {
                  addonId: true,
                  addonNameEn: true,
                  quantity: true,
                  quotedUnitPrice: true,
                  quotedLineTotal: true,
                },
              },
            },
          },
        },
      });

      const statusOf = (quote: (typeof quotes)[number]) =>
        quote.convertedOrderId !== null
          ? CONVERTED_QUOTE_LABEL
          : QUOTE_STATUS_LABELS[quote.status];

      const rows: QuoteExportRow[] = quotes.map((quote) => {
        const itemsTotal = moneyOrNull(quote.quotedTotal);
        const shipping = moneyOrNull(quote.shippingCost);
        return {
          quoteNumber: quote.quoteNumber,
          submitted: dubaiDay(quote.createdAt),
          status: statusOf(quote),
          order: quote.convertedOrder?.orderNumber ?? "",
          company: quote.b2bAccount.companyNameEn,
          customer: quote.customer.name,
          email: quote.customer.email,
          tradeLicence:
            quote.snapshotTradeLicenseNo ?? quote.b2bAccount.tradeLicenseNo,
          vatNumber: quote.snapshotVatNumber ?? quote.b2bAccount.vatNumber ?? "",
          lines: quote.items.length,
          unitsRequested: quote.items.reduce(
            (sum, item) => sum + (item.requestedQuantity ?? item.quantity),
            0,
          ),
          unitsQuoted: quote.items.reduce((sum, item) => sum + item.quantity, 0),
          itemsTotal,
          shipping,
          quotedTotal:
            itemsTotal !== null && shipping !== null
              ? sumMoney([itemsTotal, shipping])
              : null,
          shippingMethod: quote.shippingMethodLabel ?? "",
          quotedOn: quote.quotedAt ? dubaiDay(quote.quotedAt) : "",
          quotedBy: quote.quotedByStaff?.name ?? "",
        };
      });

      const lines: QuoteExportLine[] = quotes.flatMap((quote) => {
        const status = statusOf(quote);
        return quote.items.flatMap((item) => [
          {
            quoteNumber: quote.quoteNumber,
            status,
            type: "Product" as const,
            sku: item.productSku,
            item: item.productNameEn,
            requestedQty: item.requestedQuantity,
            quotedQty: item.quantity,
            unitPrice: moneyOrNull(item.quotedUnitPrice),
            lineTotal: moneyOrNull(item.quotedLineTotal),
          },
          ...item.selectedAddons.map((addon) => ({
            quoteNumber: quote.quoteNumber,
            status,
            type: "Add-on" as const,
            sku: addon.addonId,
            item: addon.addonNameEn,
            requestedQty: null,
            quotedQty: addon.quantity,
            unitPrice: moneyOrNull(addon.quotedUnitPrice),
            lineTotal: moneyOrNull(addon.quotedLineTotal),
          })),
        ]);
      });

      await tx.auditLog.create({
        data: {
          actorType: "STAFF",
          actorId: staff.id,
          action: "quote.exported",
          entityType: "QuoteRequest",
          entityId: null,
          metadata: {
            count: rows.length,
            lineCount: lines.length,
            mode,
            filters: "filters" in data ? data.filters : null,
            capped: matching > EXPORT_ROW_CAP,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      return { rows, lines, truncated: matching > EXPORT_ROW_CAP };
    });

    return { success: true, ...result };
  } catch (err) {
    console.error("[exportQuotesAction]", err);
    return {
      success: false,
      error: "The export could not be recorded, so no file was produced.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}
