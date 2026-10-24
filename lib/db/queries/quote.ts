import "server-only";

import { db } from "@/lib/db/client";
import { toISOString, dubaiDayBoundsUtc } from "@/lib/utils/date";
import { getSetting } from "@/lib/db/queries/settings";
import { deriveB2BStatus, type B2BDerivedStatus } from "@/lib/db/queries/b2b";
import {
  deriveVerificationStatus,
  type VerificationStatusProjection,
} from "@/lib/db/queries/verification";
import type { VerificationProjection } from "@/lib/db/queries/checkout";
import { roundMoney, sumMoney } from "@/lib/utils/currency";
import type {
  OrderStatus,
  QuoteStatus,
  Prisma,
  TicketStatus,
} from "@/app/generated/prisma/client";
import type { ShippingAddressSnapshot } from "@/types/order";

export type { QuoteStatus };

export interface QuoteListItemProjection {
  id: string;
  quoteNumber: string;
  status: QuoteStatus;
  createdAt: string;
  itemCount: number;
  firstProductName: string;
  quotedTotalAed: number | null;
  shippingCostAed: number | null;
  convertedOrderId: string | null;
}

export interface QuoteEventProjection {
  id: string;
  toStatus: QuoteStatus;
  note: string | null;
  createdAt: string;
}

export interface QuoteDetailAddonProjection {
  id: string;
  name: string;
  quantity: number;
  quotedUnitPriceAed: number | null;
  quotedLineTotalAed: number | null;
}

export interface QuoteDetailItemProjection {
  id: string;
  name: string;
  quantity: number;
  requestedQuantity: number | null;
  quotedUnitPriceAed: number | null;
  quotedLineTotalAed: number | null;
  selectedAddons: QuoteDetailAddonProjection[];
}

export interface QuoteDetailProjection {
  id: string;
  quoteNumber: string;
  status: QuoteStatus;
  createdAt: string;
  customerNote: string | null;
  quotedTotalAed: number | null;
  quotedAt: string | null;
  snapshotLegalName: string | null;
  snapshotTradeLicenseNo: string | null;
  snapshotVatNumber: string | null;
  items: QuoteDetailItemProjection[];
  events: QuoteEventProjection[];
  consentTermsBody: string | null;
  consentRulesBody: string | null;
  consentAvailable: boolean;
  convertedOrderId: string | null;
  convertedOrderNumber: string | null;
  sendNote: string | null;
  shippingCostAed: number | null;
  shippingMethodLabel: string | null;
  shippingAddress: ShippingAddressSnapshot | null;
}

export async function getCustomerQuotes(
  customerId: string,
  locale: "en" | "ar" | "ru",
  page: number,
  pageSize: number,
): Promise<{ quotes: QuoteListItemProjection[]; totalCount: number }> {
  const [rawQuotes, totalCount] = await db.$transaction([
    db.quoteRequest.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        quoteNumber: true,
        status: true,
        createdAt: true,
        quotedTotal: true,
        shippingCost: true,
        convertedOrderId: true,
        items: {
          select: {
            productNameEn: true,
            productNameAr: true,
            productNameRu: true,
          },
        },
      },
    }),
    db.quoteRequest.count({ where: { customerId } }),
  ]);

  const quotes = rawQuotes.map((quote) => {
    const first = quote.items[0] ?? null;

    const firstProductName = first
      ? locale === "ar"
        ? first.productNameAr
        : locale === "ru"
          ? (first.productNameRu ?? first.productNameEn)
          : first.productNameEn
      : "";

    return {
      id: quote.id,
      quoteNumber: quote.quoteNumber,
      status: quote.status,
      createdAt: toISOString(quote.createdAt),
      itemCount: quote.items.length,
      firstProductName,
      quotedTotalAed:
        quote.quotedTotal != null ? Number(quote.quotedTotal) : null,
      shippingCostAed:
        quote.shippingCost != null ? Number(quote.shippingCost) : null,
      convertedOrderId: quote.convertedOrderId,
    };
  });

  return { quotes, totalCount };
}

export async function getCustomerQuoteDetail(
  quoteId: string,
  customerId: string,
  locale: "en" | "ar" | "ru",
): Promise<QuoteDetailProjection | null> {
  const quote = await db.quoteRequest.findUnique({
    where: { id: quoteId },
    select: {
      id: true,
      quoteNumber: true,
      status: true,
      createdAt: true,
      customerId: true,
      customerNote: true,
      quotedTotal: true,
      quotedAt: true,
      snapshotLegalNameEn: true,
      snapshotLegalNameAr: true,
      snapshotTradeLicenseNo: true,
      snapshotVatNumber: true,
      convertedOrderId: true,
      convertedOrder: { select: { orderNumber: true } },
      sendNote: true,
      shippingCost: true,
      shippingMethodLabel: true,
      shippingAddressSnapshot: true,
      items: {
        select: {
          id: true,
          productNameEn: true,
          productNameAr: true,
          productNameRu: true,
          quantity: true,
          requestedQuantity: true,
          quotedUnitPrice: true,
          quotedLineTotal: true,
          selectedAddons: {
            select: {
              id: true,
              addonNameEn: true,
              addonNameAr: true,
              addonNameRu: true,
              quantity: true,
              quotedUnitPrice: true,
              quotedLineTotal: true,
            },
          },
        },
      },
      events: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          toStatus: true,
          note: true,
          createdAt: true,
        },
      },
    },
  });

  if (!quote || quote.customerId !== customerId) return null;

  const [terms, rules] = await Promise.all([
    getSetting("quote_legal_terms"),
    getSetting("quote_rules"),
  ]);
  const localesFilled = (v: {
    en: { body: string };
    ar: { body: string };
    ru: { body: string };
  }) =>
    v.en.body.trim() !== "" &&
    v.ar.body.trim() !== "" &&
    v.ru.body.trim() !== "";
  const consentAvailable = localesFilled(terms) && localesFilled(rules);
  const consentTermsBody =
    terms[locale].body.trim() !== "" ? terms[locale].body : null;
  const consentRulesBody =
    rules[locale].body.trim() !== "" ? rules[locale].body : null;

  const items: QuoteDetailItemProjection[] = quote.items.map((item) => {
    const name =
      locale === "ar"
        ? item.productNameAr
        : locale === "ru"
          ? (item.productNameRu ?? item.productNameEn)
          : item.productNameEn;

    const selectedAddons: QuoteDetailAddonProjection[] =
      item.selectedAddons.map((addon) => {
        const addonName =
          locale === "ar"
            ? addon.addonNameAr
            : locale === "ru"
              ? (addon.addonNameRu ?? addon.addonNameEn)
              : addon.addonNameEn;

        return {
          id: addon.id,
          name: addonName,
          quantity: addon.quantity,
          quotedUnitPriceAed:
            addon.quotedUnitPrice != null
              ? Number(addon.quotedUnitPrice)
              : null,
          quotedLineTotalAed:
            addon.quotedLineTotal != null
              ? Number(addon.quotedLineTotal)
              : null,
        };
      });

    return {
      id: item.id,
      name,
      quantity: item.quantity,
      requestedQuantity: item.requestedQuantity,
      quotedUnitPriceAed:
        item.quotedUnitPrice != null ? Number(item.quotedUnitPrice) : null,
      quotedLineTotalAed:
        item.quotedLineTotal != null ? Number(item.quotedLineTotal) : null,
      selectedAddons,
    };
  });

  const events: QuoteEventProjection[] = quote.events.map((event) => ({
    id: event.id,
    toStatus: event.toStatus,
    note: event.note,
    createdAt: toISOString(event.createdAt),
  }));

  const snapshotLegalName =
    locale === "ar"
      ? (quote.snapshotLegalNameAr ?? quote.snapshotLegalNameEn)
      : quote.snapshotLegalNameEn;

  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    status: quote.status,
    createdAt: toISOString(quote.createdAt),
    customerNote: quote.customerNote,
    quotedTotalAed:
      quote.quotedTotal != null ? Number(quote.quotedTotal) : null,
    quotedAt: quote.quotedAt != null ? toISOString(quote.quotedAt) : null,
    snapshotLegalName,
    snapshotTradeLicenseNo: quote.snapshotTradeLicenseNo,
    snapshotVatNumber: quote.snapshotVatNumber,
    items,
    events,
    consentTermsBody,
    consentRulesBody,
    consentAvailable,
    convertedOrderId: quote.convertedOrderId,
    convertedOrderNumber: quote.convertedOrder?.orderNumber ?? null,
    sendNote: quote.sendNote,
    shippingCostAed:
      quote.shippingCost != null ? Number(quote.shippingCost) : null,
    shippingMethodLabel: quote.shippingMethodLabel,
    shippingAddress:
      (quote.shippingAddressSnapshot as ShippingAddressSnapshot | null) ?? null,
  };
}

// ─── Finalize projection ──────────────────────────────────────────────────────

export interface QuoteFinalizeAddonProjection {
  id: string;
  name: string;
  quantity: number;
  quotedUnitPriceAed: number | null;
  quotedLineTotalAed: number;
}

export interface QuoteFinalizeItemProjection {
  id: string;
  name: string;
  quantity: number;
  quotedUnitPriceAed: number | null;
  quotedLineTotalAed: number;
  selectedAddons: QuoteFinalizeAddonProjection[];
}

export interface QuoteFinalizeProjection {
  quote: {
    id: string;
    quoteNumber: string;
    status: QuoteStatus;
    convertedOrderId: string | null;
  };
  items: QuoteFinalizeItemProjection[];
  goodsSubtotalAed: number;
  addonSubtotalAed: number;
  b2bStatus: B2BDerivedStatus;
  restricted: boolean;
  verification: VerificationProjection;
  shippingCostAed: number | null;
  shippingAddress: ShippingAddressSnapshot | null;
  vatRate: number;
  taxAmountAed: number;
}

const VERIFICATION_RENEW_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export async function getQuoteFinalizeProjection(
  quoteId: string,
  customerId: string,
  locale: "en" | "ar" | "ru",
): Promise<QuoteFinalizeProjection | null> {
  const quote = await db.quoteRequest.findUnique({
    where: { id: quoteId },
    select: {
      id: true,
      quoteNumber: true,
      status: true,
      customerId: true,
      convertedOrderId: true,
      shippingCost: true,
      shippingAddressSnapshot: true,
      b2bAccount: { select: { status: true, expiresAt: true } },
      customer: {
        select: {
          name: true,
          email: true,
          verificationStatus: true,
          verifiedAt: true,
          verificationExpiresAt: true,
        },
      },
      items: {
        select: {
          id: true,
          productSku: true,
          productNameEn: true,
          productNameAr: true,
          productNameRu: true,
          quantity: true,
          quotedUnitPrice: true,
          quotedLineTotal: true,
          selectedAddons: {
            select: {
              id: true,
              addonNameEn: true,
              addonNameAr: true,
              addonNameRu: true,
              quantity: true,
              quotedUnitPrice: true,
              quotedLineTotal: true,
            },
          },
        },
      },
    },
  });

  if (!quote || quote.customerId !== customerId) return null;

  const productSkus = quote.items.map((i) => i.productSku);

  const [productRows, latestEvent, taxConfig] = await Promise.all([
    db.product.findMany({
      where: { sku: { in: productSkus } },
      select: { sku: true, requiresIdVerification: true },
    }),
    db.verificationEvent.findFirst({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        provider: true,
        status: true,
        rejectionReason: true,
        createdAt: true,
      },
    }),
    getSetting("tax_config"),
  ]);

  const restrictedSkuSet = new Set(
    productRows.filter((p) => p.requiresIdVerification).map((p) => p.sku),
  );
  const restricted = quote.items.some((i) =>
    restrictedSkuSet.has(i.productSku),
  );

  const items: QuoteFinalizeItemProjection[] = quote.items.map((item) => {
    const name =
      locale === "ar"
        ? item.productNameAr
        : locale === "ru"
          ? (item.productNameRu ?? item.productNameEn)
          : item.productNameEn;

    return {
      id: item.id,
      name,
      quantity: item.quantity,
      quotedUnitPriceAed:
        item.quotedUnitPrice != null ? Number(item.quotedUnitPrice) : null,
      quotedLineTotalAed: Number(item.quotedLineTotal ?? 0),
      selectedAddons: item.selectedAddons.map((addon) => ({
        id: addon.id,
        name:
          locale === "ar"
            ? addon.addonNameAr
            : locale === "ru"
              ? (addon.addonNameRu ?? addon.addonNameEn)
              : addon.addonNameEn,
        quantity: addon.quantity,
        quotedUnitPriceAed:
          addon.quotedUnitPrice != null ? Number(addon.quotedUnitPrice) : null,
        quotedLineTotalAed: Number(addon.quotedLineTotal ?? 0),
      })),
    };
  });

  const goodsSubtotalAed = sumMoney(items.map((i) => i.quotedLineTotalAed));
  const addonSubtotalAed = sumMoney(
    quote.items.flatMap((i) =>
      i.selectedAddons.map((a) => Number(a.quotedLineTotal ?? 0)),
    ),
  );

  const vatRate = taxConfig.vatRate;
  const taxableBaseAed = sumMoney([goodsSubtotalAed, addonSubtotalAed]);
  const taxAmountAed = roundMoney(
    taxableBaseAed - taxableBaseAed / (1 + vatRate),
  );

  const b2bStatus = deriveB2BStatus(
    quote.b2bAccount.status,
    quote.b2bAccount.expiresAt,
  );

  const verificationStatus = deriveVerificationStatus(
    quote.customer.verificationStatus as VerificationProjection["status"],
    quote.customer.verificationExpiresAt,
  );
  const canCheckout = !restricted || verificationStatus === "APPROVED";

  const verification: VerificationProjection = {
    required: restricted,
    status: verificationStatus,
    canCheckout,
    verifiedAt: quote.customer.verifiedAt
      ? toISOString(quote.customer.verifiedAt)
      : null,
    expiresAt: quote.customer.verificationExpiresAt
      ? toISOString(quote.customer.verificationExpiresAt)
      : null,
    nearExpiry: quote.customer.verificationExpiresAt
      ? quote.customer.verificationExpiresAt.getTime() - Date.now() <
        VERIFICATION_RENEW_WINDOW_MS
      : false,
    holderName: quote.customer.name ?? quote.customer.email ?? null,
    credential:
      latestEvent && verificationStatus === "APPROVED"
        ? {
            eventId: latestEvent.id,
            provider: latestEvent.provider as NonNullable<
              VerificationProjection["credential"]
            >["provider"],
          }
        : null,
    latestEvent:
      latestEvent && verificationStatus === "REJECTED"
        ? {
            id: latestEvent.id,
            status: latestEvent.status as VerificationProjection["status"],
            rejectionReason: latestEvent.rejectionReason,
            createdAt: toISOString(latestEvent.createdAt),
          }
        : null,
  };

  return {
    quote: {
      id: quote.id,
      quoteNumber: quote.quoteNumber,
      status: quote.status,
      convertedOrderId: quote.convertedOrderId,
    },
    items,
    goodsSubtotalAed,
    addonSubtotalAed,
    b2bStatus,
    restricted,
    verification,
    shippingCostAed:
      quote.shippingCost != null ? Number(quote.shippingCost) : null,
    shippingAddress:
      (quote.shippingAddressSnapshot as ShippingAddressSnapshot | null) ?? null,
    vatRate,
    taxAmountAed,
  };
}

// ─── Admin projections ────────────────────────────────────────────────────────

export interface AdminQuoteListItemProjection {
  id: string;
  quoteNumber: string;
  status: QuoteStatus;
  createdAt: string;
  companyNameEn: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  itemCount: number;
  quotedTotalAed: number | null;
  shippingCostAed: number | null;
  convertedOrderId: string | null;
  convertedOrderNumber: string | null;
}

export interface AdminQuoteEventProjection {
  id: string;
  actor: string;
  staffName: string | null;
  fromStatus: QuoteStatus | null;
  toStatus: QuoteStatus;
  note: string | null;
  createdAt: string;
}

export interface AdminQuoteDetailItemProjection {
  id: string;
  name: string;
  quantity: number;
  requestedQuantity: number | null;
  quotedUnitPriceAed: number | null;
  quotedLineTotalAed: number | null;
  selectedAddons: QuoteDetailAddonProjection[];
}

export interface AdminQuoteDetailProjection {
  id: string;
  quoteNumber: string;
  status: QuoteStatus;
  createdAt: string;
  customerNote: string | null;
  internalNote: string | null;
  quotedTotalAed: number | null;
  quotedAt: string | null;
  quotedByStaffName: string | null;
  companyNameEn: string;
  snapshotLegalNameEn: string | null;
  snapshotLegalNameAr: string | null;
  snapshotTradeLicenseNo: string | null;
  snapshotVatNumber: string | null;
  b2bAccount: {
    id: string;
    companyNameEn: string;
    derivedStatus: B2BDerivedStatus;
  };
  customer: {
    id: string;
    name: string;
    email: string;
    verificationStatus: ReturnType<typeof deriveVerificationStatus>;
    latestVerificationEventId: string | null;
  };
  items: AdminQuoteDetailItemProjection[];
  events: AdminQuoteEventProjection[];
  sendNote: string | null;
  shippingCostAed: number | null;
  shippingMethodLabel: string | null;
  shippingAddress: ShippingAddressSnapshot | null;
  convertedOrderId: string | null;
  convertedOrderNumber: string | null;
  convertedOrderStatus: OrderStatus | null;
}

export interface AdminQuoteLinkedRecords {
  tickets: {
    total: number;
    items: {
      id: string;
      ticketNumber: string;
      status: TicketStatus;
      createdAt: string;
    }[];
  };
}

export const ADMIN_QUOTE_VIEWS = [
  "PRICING",
  "AWAITING",
  "ACCEPTED",
  "CONVERTED",
  "CLOSED",
] as const;

export type AdminQuoteView = (typeof ADMIN_QUOTE_VIEWS)[number];

export function quoteViewWhere(
  view: AdminQuoteView,
): Prisma.QuoteRequestWhereInput {
  switch (view) {
    case "PRICING":
      return { status: { in: ["NEW", "CONTACTED"] } };
    case "AWAITING":
      return { status: "QUOTED" };
    case "ACCEPTED":
      return { status: "ACCEPTED", convertedOrderId: null };
    case "CONVERTED":
      return { convertedOrderId: { not: null } };
    case "CLOSED":
      return { status: { in: ["CLOSED", "CANCELLED"] } };
  }
}

export interface AdminQuoteFilters {
  view?: AdminQuoteView;
  status?: QuoteStatus;
  priced?: "YES" | "NO";
  search?: string;
  from?: string;
  to?: string;
  sort?: "newest" | "oldest" | "total_desc" | "total_asc";
}

export interface AdminQuotesSummary {
  all: number;
  pricing: number;
  awaiting: number;
  accepted: number;
  converted: number;
  closed: number;
}

export interface AdminQuotesPage {
  rows: AdminQuoteListItemProjection[];
  total: number;
  page: number;
  totalPages: number;
  summary: AdminQuotesSummary;
}

const ADMIN_QUOTE_ORDER_BY: Record<
  NonNullable<AdminQuoteFilters["sort"]>,
  Prisma.QuoteRequestOrderByWithRelationInput[]
> = {
  newest: [{ createdAt: "desc" }, { id: "asc" }],
  oldest: [{ createdAt: "asc" }, { id: "asc" }],
  total_desc: [
    { quotedTotal: { sort: "desc", nulls: "last" } },
    { id: "asc" },
  ],
  total_asc: [
    { quotedTotal: { sort: "asc", nulls: "last" } },
    { id: "asc" },
  ],
};

export function buildAdminQuotesWhere(
  filters: AdminQuoteFilters,
): Prisma.QuoteRequestWhereInput {
  const and: Prisma.QuoteRequestWhereInput[] = [];

  if (filters.view) {
    and.push(quoteViewWhere(filters.view));
  }
  if (filters.status) {
    and.push({ status: filters.status });
  }
  if (filters.priced === "YES") {
    and.push({ quotedTotal: { not: null } });
  } else if (filters.priced === "NO") {
    and.push({ quotedTotal: null });
  }

  const term = filters.search?.trim();
  if (term) {
    and.push({
      OR: [
        { quoteNumber: { contains: term, mode: "insensitive" } },
        {
          b2bAccount: {
            companyNameEn: { contains: term, mode: "insensitive" },
          },
        },
        { customer: { name: { contains: term, mode: "insensitive" } } },
        { customer: { email: { contains: term, mode: "insensitive" } } },
      ],
    });
  }

  const fromBounds = filters.from ? dubaiDayBoundsUtc(filters.from) : null;
  const toBounds = filters.to ? dubaiDayBoundsUtc(filters.to) : null;
  if (fromBounds || toBounds) {
    and.push({
      createdAt: {
        ...(fromBounds ? { gte: fromBounds.start } : {}),
        ...(toBounds ? { lt: toBounds.end } : {}),
      },
    });
  }

  return { AND: and };
}

export async function getAdminQuotes(
  opts: AdminQuoteFilters & { page: number; pageSize: number },
): Promise<AdminQuotesPage> {
  const where = buildAdminQuotesWhere(opts);

  const [
    total,
    summaryAll,
    summaryPricing,
    summaryAwaiting,
    summaryAccepted,
    summaryConverted,
    summaryClosed,
  ] = await Promise.all([
    db.quoteRequest.count({ where }),
    db.quoteRequest.count(),
    db.quoteRequest.count({ where: quoteViewWhere("PRICING") }),
    db.quoteRequest.count({ where: quoteViewWhere("AWAITING") }),
    db.quoteRequest.count({ where: quoteViewWhere("ACCEPTED") }),
    db.quoteRequest.count({ where: quoteViewWhere("CONVERTED") }),
    db.quoteRequest.count({ where: quoteViewWhere("CLOSED") }),
  ]);

  const summary: AdminQuotesSummary = {
    all: summaryAll,
    pricing: summaryPricing,
    awaiting: summaryAwaiting,
    accepted: summaryAccepted,
    converted: summaryConverted,
    closed: summaryClosed,
  };

  const totalPages = Math.max(1, Math.ceil(total / opts.pageSize));
  const page = Math.min(Math.max(1, opts.page), totalPages);

  const rows = await db.quoteRequest.findMany({
    where,
    orderBy: ADMIN_QUOTE_ORDER_BY[opts.sort ?? "newest"],
    skip: (page - 1) * opts.pageSize,
    take: opts.pageSize,
    select: {
      id: true,
      quoteNumber: true,
      status: true,
      createdAt: true,
      quotedTotal: true,
      shippingCost: true,
      convertedOrderId: true,
      convertedOrder: { select: { orderNumber: true } },
      customerId: true,
      b2bAccount: { select: { companyNameEn: true } },
      customer: { select: { name: true, email: true } },
      items: { select: { id: true } },
    },
  });

  const items: AdminQuoteListItemProjection[] = rows.map((row) => ({
    id: row.id,
    quoteNumber: row.quoteNumber,
    status: row.status,
    createdAt: toISOString(row.createdAt),
    companyNameEn: row.b2bAccount.companyNameEn,
    customerId: row.customerId,
    customerName: row.customer.name,
    customerEmail: row.customer.email,
    itemCount: row.items.length,
    quotedTotalAed: row.quotedTotal != null ? Number(row.quotedTotal) : null,
    shippingCostAed: row.shippingCost != null ? Number(row.shippingCost) : null,
    convertedOrderId: row.convertedOrderId,
    convertedOrderNumber: row.convertedOrder?.orderNumber ?? null,
  }));

  return { rows: items, total, page, totalPages, summary };
}

export async function getAdminQuoteDetail(
  quoteId: string,
): Promise<AdminQuoteDetailProjection | null> {
  const quote = await db.quoteRequest.findUnique({
    where: { id: quoteId },
    select: {
      id: true,
      quoteNumber: true,
      status: true,
      createdAt: true,
      customerNote: true,
      internalNote: true,
      quotedTotal: true,
      quotedAt: true,
      snapshotLegalNameEn: true,
      snapshotLegalNameAr: true,
      snapshotTradeLicenseNo: true,
      snapshotVatNumber: true,
      sendNote: true,
      shippingCost: true,
      shippingMethodLabel: true,
      shippingAddressSnapshot: true,
      convertedOrderId: true,
      convertedOrder: { select: { orderNumber: true, status: true } },
      b2bAccount: {
        select: { id: true, companyNameEn: true, status: true, expiresAt: true },
      },
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          verificationStatus: true,
          verificationExpiresAt: true,
        },
      },
      quotedByStaff: { select: { name: true } },
      items: {
        select: {
          id: true,
          productNameEn: true,
          quantity: true,
          requestedQuantity: true,
          quotedUnitPrice: true,
          quotedLineTotal: true,
          selectedAddons: {
            select: {
              id: true,
              addonNameEn: true,
              quantity: true,
              quotedUnitPrice: true,
              quotedLineTotal: true,
            },
          },
        },
      },
      events: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          actor: true,
          fromStatus: true,
          toStatus: true,
          note: true,
          createdAt: true,
          staff: { select: { name: true } },
        },
      },
    },
  });

  if (!quote) return null;

  const latestVerificationEvent = await db.verificationEvent.findFirst({
    where: { customerId: quote.customer.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  const items: AdminQuoteDetailItemProjection[] = quote.items.map((item) => ({
    id: item.id,
    name: item.productNameEn,
    quantity: item.quantity,
    requestedQuantity: item.requestedQuantity,
    quotedUnitPriceAed:
      item.quotedUnitPrice != null ? Number(item.quotedUnitPrice) : null,
    quotedLineTotalAed:
      item.quotedLineTotal != null ? Number(item.quotedLineTotal) : null,
    selectedAddons: item.selectedAddons.map((addon) => ({
      id: addon.id,
      name: addon.addonNameEn,
      quantity: addon.quantity,
      quotedUnitPriceAed:
        addon.quotedUnitPrice != null ? Number(addon.quotedUnitPrice) : null,
      quotedLineTotalAed:
        addon.quotedLineTotal != null ? Number(addon.quotedLineTotal) : null,
    })),
  }));

  const events: AdminQuoteEventProjection[] = quote.events.map((event) => ({
    id: event.id,
    actor: event.actor,
    staffName: event.staff?.name ?? null,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    note: event.note ?? null,
    createdAt: toISOString(event.createdAt),
  }));

  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    status: quote.status,
    createdAt: toISOString(quote.createdAt),
    customerNote: quote.customerNote,
    internalNote: quote.internalNote,
    quotedTotalAed:
      quote.quotedTotal != null ? Number(quote.quotedTotal) : null,
    quotedAt: quote.quotedAt != null ? toISOString(quote.quotedAt) : null,
    quotedByStaffName: quote.quotedByStaff?.name ?? null,
    companyNameEn: quote.b2bAccount.companyNameEn,
    snapshotLegalNameEn: quote.snapshotLegalNameEn,
    snapshotLegalNameAr: quote.snapshotLegalNameAr,
    snapshotTradeLicenseNo: quote.snapshotTradeLicenseNo,
    snapshotVatNumber: quote.snapshotVatNumber,
    b2bAccount: {
      id: quote.b2bAccount.id,
      companyNameEn: quote.b2bAccount.companyNameEn,
      derivedStatus: deriveB2BStatus(
        quote.b2bAccount.status,
        quote.b2bAccount.expiresAt,
      ),
    },
    customer: {
      id: quote.customer.id,
      name: quote.customer.name,
      email: quote.customer.email,
      verificationStatus: deriveVerificationStatus(
        quote.customer
          .verificationStatus as VerificationStatusProjection["status"],
        quote.customer.verificationExpiresAt,
      ),
      latestVerificationEventId: latestVerificationEvent?.id ?? null,
    },
    items,
    events,
    sendNote: quote.sendNote,
    shippingCostAed:
      quote.shippingCost != null ? Number(quote.shippingCost) : null,
    shippingMethodLabel: quote.shippingMethodLabel,
    shippingAddress:
      (quote.shippingAddressSnapshot as ShippingAddressSnapshot | null) ?? null,
    convertedOrderId: quote.convertedOrderId,
    convertedOrderNumber: quote.convertedOrder?.orderNumber ?? null,
    convertedOrderStatus: quote.convertedOrder?.status ?? null,
  };
}

export async function getAdminQuoteLinkedRecords(
  quoteId: string,
): Promise<AdminQuoteLinkedRecords> {
  const [ticketTotal, tickets] = await Promise.all([
    db.ticket.count({ where: { quoteRequestId: quoteId } }),
    db.ticket.findMany({
      where: { quoteRequestId: quoteId },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: 5,
      select: {
        id: true,
        ticketNumber: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    tickets: {
      total: ticketTotal,
      items: tickets.map((t) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        status: t.status,
        createdAt: toISOString(t.createdAt),
      })),
    },
  };
}
