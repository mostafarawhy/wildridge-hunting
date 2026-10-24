import "server-only";

import { db } from "@/lib/db/client";
import { sumMoney, roundMoney } from "@/lib/utils/currency";
import { emailDate } from "@/lib/email/order-email";
import { adminUrl, accountUrl } from "@/lib/email/links";
import {
  CUSTOMER_QUOTE_NOTE,
  STAFF_SALES_NOTE,
  type EmailChromeBadge,
  type EmailChromeOptions,
  type EmailInfoRow,
  type EmailOrderSummary,
  type EmailSummaryItem,
} from "@/lib/email/chrome";
import { QUOTE_STATUS_LABELS, getQuoteStatusTone } from "@/lib/utils/quote-status";
import type { EmailChromeBadgeTone } from "@/lib/email/chrome";

export interface QuoteEmailData {
  id: string;
  quoteNumber: string;
  statusLabel: string;
  statusTone: EmailChromeBadgeTone;
  quotedDate: string | null;
  requestedDate: string;
  company: string;
  tradeLicense: string;
  customerName: string;
  customerEmail: string;
  itemsLabel: string;
  summary: EmailOrderSummary | null;
  agreedTotal: number | null;
  quotedTotal: number | null;
  sendNote: string | null;
  quoteUrl: string;
  adminUrl: string;
}

function countLabel(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

export async function loadQuoteEmailData(
  quoteId: string,
): Promise<QuoteEmailData | null> {
  try {
    const quote = await db.quoteRequest.findUnique({
      where: { id: quoteId },
      select: {
        id: true,
        quoteNumber: true,
        status: true,
        createdAt: true,
        quotedAt: true,
        quotedTotal: true,
        shippingCost: true,
        shippingMethodLabel: true,
        sendNote: true,
        snapshotLegalNameEn: true,
        customer: { select: { name: true, email: true } },
        b2bAccount: { select: { companyNameEn: true, tradeLicenseNo: true } },
        items: {
          select: {
            productNameEn: true,
            quantity: true,
            quotedLineTotal: true,
            selectedAddons: {
              select: {
                addonNameEn: true,
                quantity: true,
                quotedLineTotal: true,
              },
            },
          },
        },
      },
    });

    if (!quote) return null;

    const items: EmailSummaryItem[] = quote.items.map((item) => ({
      name: item.productNameEn,
      quantity: item.quantity,
      lineTotal:
        item.quotedLineTotal != null ? Number(item.quotedLineTotal) : null,
      addons: item.selectedAddons.map((addon) => ({
        name: addon.addonNameEn,
        quantity: addon.quantity,
        lineTotal:
          addon.quotedLineTotal != null ? Number(addon.quotedLineTotal) : null,
      })),
    }));

    const totalAddons = quote.items.reduce(
      (sum, item) => sum + item.selectedAddons.length,
      0,
    );
    const itemsLabel =
      totalAddons > 0
        ? `${countLabel(quote.items.length, "product")}, ${countLabel(totalAddons, "add-on")}`
        : countLabel(quote.items.length, "product");

    const quotedTotal =
      quote.quotedTotal != null ? Number(quote.quotedTotal) : null;
    const shippingCost =
      quote.shippingCost != null ? Number(quote.shippingCost) : null;

    let summary: EmailOrderSummary | null = null;
    if (quotedTotal !== null) {
      const subtotal = sumMoney(
        items
          .map((item) => item.lineTotal)
          .filter((n): n is number => n !== null),
      );
      const addonTotal = sumMoney(
        items
          .flatMap((item) => item.addons.map((addon) => addon.lineTotal))
          .filter((n): n is number => n !== null),
      );

      if (roundMoney(sumMoney([subtotal, addonTotal])) !== roundMoney(quotedTotal)) {
        console.error(
          "[loadQuoteEmailData] subtotal/addonTotal do not sum to quotedTotal",
          quoteId,
        );
      } else {
        summary = {
          items,
          subtotal,
          addonTotal,
          shippingCost: shippingCost ?? 0,
          shippingMethodName: quote.shippingMethodLabel,
          shippingPending: shippingCost === null,
          discountAmount: 0,
          couponCode: null,
          loyaltyPointsUsed: 0,
          loyaltyDiscountAmount: 0,
          total: sumMoney([quotedTotal, shippingCost ?? 0]),
          taxAmount: null,
          vatRate: 0,
        };
      }
    }

    return {
      id: quote.id,
      quoteNumber: quote.quoteNumber,
      statusLabel: QUOTE_STATUS_LABELS[quote.status],
      statusTone: getQuoteStatusTone(quote.status),
      quotedDate: quote.quotedAt ? emailDate(quote.quotedAt) : null,
      requestedDate: emailDate(quote.createdAt),
      company: quote.snapshotLegalNameEn ?? quote.b2bAccount.companyNameEn,
      tradeLicense: quote.b2bAccount.tradeLicenseNo,
      customerName: quote.customer.name.trim(),
      customerEmail: quote.customer.email,
      itemsLabel,
      summary,
      agreedTotal: summary && !summary.shippingPending ? summary.total : null,
      quotedTotal,
      sendNote: quote.sendNote,
      quoteUrl: accountUrl(`/quotes/${quote.id}`),
      adminUrl: adminUrl(`/quotes/${quote.id}`),
    };
  } catch (err) {
    console.error("[loadQuoteEmailData]", quoteId, err);
    return null;
  }
}

export function customerQuoteChrome(
  data: QuoteEmailData,
  opts: {
    badge: EmailChromeBadge;
    infoRows: EmailInfoRow[];
    withSummary?: boolean;
    excerpt?: { label: string; text: string };
    ctaUrl?: string;
  },
): EmailChromeOptions {
  return {
    recipientName: data.customerName || undefined,
    badges: [opts.badge],
    infoRows: opts.infoRows,
    ctaUrl: opts.ctaUrl || data.quoteUrl || undefined,
    orderSummary: opts.withSummary && data.summary ? data.summary : undefined,
    messageExcerpt: opts.excerpt,
    showSupport: true,
    transparencyNote: CUSTOMER_QUOTE_NOTE,
  };
}

export function staffQuoteChrome(
  data: QuoteEmailData,
  opts: {
    badge: EmailChromeBadge;
    infoRows: EmailInfoRow[];
    transparencyNote?: string;
  },
): EmailChromeOptions {
  return {
    badges: [opts.badge],
    infoRows: opts.infoRows,
    ctaUrl: data.adminUrl || undefined,
    transparencyNote: opts.transparencyNote ?? STAFF_SALES_NOTE,
  };
}
