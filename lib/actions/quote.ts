"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { auth } from "@/auth";
import { getSessionCustomerId } from "@/lib/auth-customer";
import { db } from "@/lib/db/client";
import {
  LIVE_CATEGORY_SELECT,
  isLiveCategory,
} from "@/lib/utils/catalog-visibility";
import { nextQuoteNumber } from "@/lib/db/queries/quote-sequence";
import { nextOrderNumber } from "@/lib/db/queries/order-sequence";
import { nextTicketNumber } from "@/lib/db/queries/ticket-sequence";
import { deriveB2BStatus } from "@/lib/db/queries/b2b";
import { getSetting } from "@/lib/db/queries/settings";
import {
  getComplianceSnapshot,
  deriveVerificationStatus,
} from "@/lib/db/queries/verification";
import { logAndSendEmail } from "@/lib/services/resend";
import {
  submitQuoteSchema,
  setQuotePricingSchema,
  transitionQuoteSchema,
  acceptQuoteSchema,
  cancelQuoteSchema,
  finalizeQuoteSchema,
  requestQuoteContactSchema,
} from "@/lib/validations/quote";
import { requireStaffAction } from "@/lib/auth-staff";
import {
  QUOTE_TRANSITIONS,
  isTerminalQuoteStatus,
} from "@/lib/utils/quote-status";
import { ORDER_STATUS_LABELS } from "@/lib/utils/order-status";
import {
  loadOrderEmailData,
  orderBaseRows,
  customerOrderChrome,
  staffOrderChrome,
} from "@/lib/email/order-email";
import {
  loadTicketEmailData,
  staffTicketChrome,
  customerTicketChrome,
} from "@/lib/email/ticket-email";
import {
  loadQuoteEmailData,
  customerQuoteChrome,
  staffQuoteChrome,
} from "@/lib/email/quote-email";
import { excerpt } from "@/lib/email/chrome";
import {
  archiveOrderComplianceDocuments,
  complianceDocumentRowsFromSnapshot,
} from "@/lib/services/compliance-archive";
import {
  multiplyMoney,
  sumMoney,
  roundMoney,
  formatAED,
} from "@/lib/utils/currency";
import type {
  ShippingAddressSnapshot,
  ComplianceSnapshot,
} from "@/types/order";
import type { Prisma } from "@/app/generated/prisma/client";

export type QuoteActionErrorCode =
  | "UNAUTHENTICATED"
  | "NOT_B2B"
  | "NO_B2B_ACCOUNT"
  | "B2B_EXPIRED"
  | "EMPTY_QUOTE"
  | "VALIDATION_ERROR"
  | "PRODUCT_NOT_FOUND"
  | "ADDON_NOT_LINKED"
  | "ADDRESS_NOT_FOUND"
  | "QUOTE_NOT_QUOTED"
  | "NOT_OWNER"
  | "TERMS_UNAVAILABLE"
  | "INTERNAL_ERROR";

export type QuoteActionResult =
  | { success: true; data: { quoteNumber: string } }
  | { success: false; error: string; errorCode: QuoteActionErrorCode };

export type QuoteAdminActionErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_TRANSITION"
  | "MISSING_PRICES"
  | "REASON_REQUIRED"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

export async function submitQuoteAction(
  input: unknown,
): Promise<QuoteActionResult> {
  try {
    const session = await auth();
    const customerId = await getSessionCustomerId();
    if (!customerId) {
      return {
        success: false,
        error: "You must be signed in to request a quote.",
        errorCode: "UNAUTHENTICATED",
      };
    }
    if (session?.user?.role !== "B2B") {
      return {
        success: false,
        error: "Quote requests are available to approved business accounts.",
        errorCode: "NOT_B2B",
      };
    }

    const parsed = submitQuoteSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        errorCode: "VALIDATION_ERROR",
      };
    }
    if (parsed.data.items.length === 0) {
      return {
        success: false,
        error: "Add at least one product to your quote.",
        errorCode: "EMPTY_QUOTE",
      };
    }
    if (parsed.data.items.some((i) => i.addonIds.length > 0)) {
      return {
        success: false,
        error: "An add-on selection is invalid.",
        errorCode: "ADDON_NOT_LINKED",
      };
    }

    const b2b = await db.b2BAccount.findFirst({
      where: { customerId, status: "APPROVED" },
      select: {
        id: true,
        status: true,
        companyNameEn: true,
        companyNameAr: true,
        tradeLicenseNo: true,
        vatNumber: true,
        expiresAt: true,
      },
    });
    if (!b2b || b2b.status !== "APPROVED") {
      return {
        success: false,
        error: "Your business account isn't approved yet.",
        errorCode: "NO_B2B_ACCOUNT",
      };
    }
    if (deriveB2BStatus(b2b.status, b2b.expiresAt) !== "APPROVED") {
      return {
        success: false,
        error: "Your trade account has expired. Renew it to request quotes.",
        errorCode: "B2B_EXPIRED",
      };
    }

    const savedAddress = await db.customerAddress.findUnique({
      where: { id: parsed.data.addressId },
    });
    if (!savedAddress || savedAddress.customerId !== customerId) {
      return {
        success: false,
        error: "Address not found.",
        errorCode: "ADDRESS_NOT_FOUND",
      };
    }
    const shippingAddressSnapshot: ShippingAddressSnapshot = {
      fullName: savedAddress.fullName,
      phone: savedAddress.phone,
      addressLine1: savedAddress.addressLine1,
      addressLine2: savedAddress.addressLine2 ?? null,
      city: savedAddress.city,
      emirate: savedAddress.emirate,
      postalCode: savedAddress.postalCode ?? null,
      country: savedAddress.country,
      label: savedAddress.label ?? null,
    };

    const skus = parsed.data.items.map((i) => i.productSku);
    const productRows = await db.product.findMany({
      where: { sku: { in: skus } },
      select: {
        sku: true,
        nameEn: true,
        nameAr: true,
        nameRu: true,
        publishStatus: true,
        deletedAt: true,
        category: { select: LIVE_CATEGORY_SELECT },
      },
    });

    const productMap = new Map(productRows.map((p) => [p.sku, p]));

    for (const sku of skus) {
      const p = productMap.get(sku);
      if (
        !p ||
        p.deletedAt !== null ||
        p.publishStatus !== "PUBLISHED" ||
        !isLiveCategory(p.category)
      ) {
        return {
          success: false,
          error: "One or more products are no longer available.",
          errorCode: "PRODUCT_NOT_FOUND",
        };
      }
    }

    const now = new Date();
    const { quoteId, quoteNumber } = await db.$transaction(
      async (tx) => {
        const quoteNumber = await nextQuoteNumber(tx, now);
        const created = await tx.quoteRequest.create({
          data: {
            quoteNumber,
            customerId,
            b2bAccountId: b2b.id,
            snapshotLegalNameEn: b2b.companyNameEn,
            snapshotLegalNameAr: b2b.companyNameAr ?? null,
            snapshotTradeLicenseNo: b2b.tradeLicenseNo,
            snapshotVatNumber: b2b.vatNumber ?? null,
            status: "NEW",
            customerNote: parsed.data.customerNote ?? null,
            shippingAddressSnapshot,
            items: {
              create: parsed.data.items.map((it) => {
                const p = productMap.get(it.productSku)!;
                return {
                  productSku: it.productSku,
                  productNameEn: p.nameEn,
                  productNameAr: p.nameAr,
                  productNameRu: p.nameRu ?? null,
                  quantity: it.quantity,
                  requestedQuantity: it.quantity,
                };
              }),
            },
          },
          select: { id: true, quoteNumber: true },
        });
        await tx.quoteEvent.create({
          data: {
            quoteRequestId: created.id,
            actor: "CUSTOMER",
            toStatus: "NEW",
            note: null,
          },
        });
        return { quoteId: created.id, quoteNumber: created.quoteNumber };
      },
      { isolationLevel: "Serializable" },
    );

    const itemCount = parsed.data.items.length;
    after(async () => {
      const { sales: salesRecipients } = await getSetting("email_recipients");
      const data = await loadQuoteEmailData(quoteId);
      if (!data) return;
      await logAndSendEmail({
        templateKey: "quote_requested_customer",
        toEmail: data.customerEmail,
        payload: { quoteNumber },
        chromeOptions: customerQuoteChrome(data, {
          badge: { text: "Received", tone: "info" },
          infoRows: [
            { label: "Quote", value: data.quoteNumber },
            { label: "Company", value: data.company },
            { label: "Requested on", value: data.requestedDate },
            { label: "Items", value: data.itemsLabel },
          ],
        }),
      });
      for (const salesEmail of salesRecipients) {
        await logAndSendEmail({
          templateKey: "b2b_quote_requested",
          toEmail: salesEmail,
          payload: {
            quoteNumber,
            customerId,
            companyNameEn: b2b.companyNameEn,
            itemCount,
          },
          chromeOptions: staffQuoteChrome(data, {
            badge: { text: "New quote request", tone: "info" },
            infoRows: [
              { label: "Quote", value: data.quoteNumber },
              { label: "Company", value: data.company },
              { label: "Trade licence", value: data.tradeLicense },
              {
                label: "Customer",
                value: data.customerName
                  ? `${data.customerName} · ${data.customerEmail}`
                  : data.customerEmail,
              },
              { label: "Items", value: data.itemsLabel },
            ],
          }),
        });
      }
    });

    revalidatePath("/", "layout");
    return { success: true, data: { quoteNumber } };
  } catch (err) {
    console.error("[submitQuoteAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export async function setQuotePricingAction(
  input: unknown,
): Promise<
  | { success: true }
  | { success: false; error: string; errorCode: QuoteAdminActionErrorCode }
> {
  const staff = await requireStaffAction("quote:manage");

  try {
    const parsed = setQuotePricingSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        errorCode: "VALIDATION_ERROR",
      };
    }

    const {
      quoteId,
      lines,
      internalNote,
      shippingCost,
      shippingMethodLabel,
      sendNote,
      stockAttestation,
    } = parsed.data;

    const quotePreload = await db.quoteRequest.findUnique({
      where: { id: quoteId },
      select: {
        customer: { select: { email: true } },
        items: {
          select: {
            id: true,
            quantity: true,
            selectedAddons: {
              select: { id: true, quantity: true, quotedUnitPrice: true },
            },
          },
        },
      },
    });

    if (!quotePreload) {
      return {
        success: false,
        error: "Quote not found.",
        errorCode: "NOT_FOUND",
      };
    }

    const customerEmail = quotePreload.customer.email;
    const allItemIds = new Set(quotePreload.items.map((i) => i.id));
    const lineItemIds = new Set(lines.map((l) => l.itemId));

    for (const id of allItemIds) {
      if (!lineItemIds.has(id)) {
        return {
          success: false,
          error: "A price must be provided for every item on this quote.",
          errorCode: "MISSING_PRICES",
        };
      }
    }

    for (const id of lineItemIds) {
      if (!allItemIds.has(id)) {
        return {
          success: false,
          error: "An item on this request does not belong to this quote.",
          errorCode: "VALIDATION_ERROR",
        };
      }
    }

    const allAddonRowIds = new Set(
      quotePreload.items.flatMap((i) => i.selectedAddons.map((a) => a.id)),
    );
    for (const line of lines) {
      for (const addon of line.addons) {
        if (!allAddonRowIds.has(addon.selectedAddonId)) {
          return {
            success: false,
            error: "An add-on on this request does not belong to this quote.",
            errorCode: "VALIDATION_ERROR",
          };
        }
      }
    }

    const itemQuantityBeforeMap = new Map(
      quotePreload.items.map((i) => [i.id, i.quantity]),
    );

    const lineTotals = lines.map((l) =>
      multiplyMoney(l.quotedUnitPrice, l.quantity),
    );
    const addonLineTotals = lines.flatMap((l) =>
      l.addons.map((a) => multiplyMoney(a.quotedUnitPrice, a.quantity)),
    );
    const goodsSubtotal = sumMoney(lineTotals);
    const addonSubtotal = sumMoney(addonLineTotals);
    const quotedTotal = sumMoney([goodsSubtotal, addonSubtotal]);

    const lineChanges = lines
      .filter((l) => itemQuantityBeforeMap.get(l.itemId) !== l.quantity)
      .map((l) => ({
        itemId: l.itemId,
        quantityBefore: itemQuantityBeforeMap.get(l.itemId) ?? null,
        quantityAfter: l.quantity,
      }));

    const addonBeforeMap = new Map(
      quotePreload.items.flatMap((i) =>
        i.selectedAddons.map(
          (a) =>
            [
              a.id,
              {
                quantity: a.quantity,
                unitPrice:
                  a.quotedUnitPrice != null ? Number(a.quotedUnitPrice) : null,
              },
            ] as const,
        ),
      ),
    );

    const addonChanges = lines
      .flatMap((l) => l.addons)
      .filter((a) => {
        const before = addonBeforeMap.get(a.selectedAddonId);
        return (
          before?.quantity !== a.quantity ||
          before?.unitPrice !== a.quotedUnitPrice
        );
      })
      .map((a) => ({
        selectedAddonId: a.selectedAddonId,
        quantityBefore: addonBeforeMap.get(a.selectedAddonId)?.quantity ?? null,
        quantityAfter: a.quantity,
        unitPriceBefore:
          addonBeforeMap.get(a.selectedAddonId)?.unitPrice ?? null,
        unitPriceAfter: a.quotedUnitPrice,
      }));

    let quoteNumber = "";

    await db.$transaction(
      async (tx) => {
        const current = await tx.quoteRequest.findUnique({
          where: { id: quoteId },
          select: { status: true, quoteNumber: true },
        });

        if (!current) throw new Error("NOT_FOUND");
        if (isTerminalQuoteStatus(current.status))
          throw new Error("INVALID_TRANSITION");

        quoteNumber = current.quoteNumber;
        const fromStatus = current.status;
        const now = new Date();

        for (const line of lines) {
          const lineTotal = multiplyMoney(line.quotedUnitPrice, line.quantity);
          await tx.quoteItem.update({
            where: { id: line.itemId },
            data: {
              quotedUnitPrice: line.quotedUnitPrice,
              quotedLineTotal: lineTotal,
              quantity: line.quantity,
            },
          });

          for (const addon of line.addons) {
            const addonLineTotal = multiplyMoney(
              addon.quotedUnitPrice,
              addon.quantity,
            );
            await tx.quoteSelectedAddon.update({
              where: { id: addon.selectedAddonId },
              data: {
                quantity: addon.quantity,
                quotedUnitPrice: addon.quotedUnitPrice,
                quotedLineTotal: addonLineTotal,
              },
            });
          }
        }

        await tx.quoteRequest.update({
          where: { id: quoteId },
          data: {
            status: "QUOTED",
            quotedTotal,
            quotedAt: now,
            quotedByStaffId: staff.id,
            shippingCost,
            shippingMethodLabel,
            sendNote,
            ...(internalNote !== undefined ? { internalNote } : {}),
          },
        });

        await tx.quoteEvent.create({
          data: {
            quoteRequestId: quoteId,
            actor: "STAFF",
            staffId: staff.id,
            fromStatus,
            toStatus: "QUOTED",
            note: null,
          },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staff.id,
            action: "quote.quoted",
            entityType: "QuoteRequest",
            entityId: quoteId,
            before: { status: fromStatus },
            after: {
              status: "QUOTED",
              quotedTotal: Number(quotedTotal),
              goodsSubtotal,
              addonSubtotal,
              lineChanges,
              addonChanges,
              shippingCost,
              shippingMethodLabel,
              stockAttestation,
            },
            ...(internalNote !== undefined
              ? { metadata: { note: internalNote } }
              : {}),
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    after(async () => {
      const data = await loadQuoteEmailData(quoteId);
      if (!data) return;
      await logAndSendEmail({
        templateKey: "quote_quoted",
        toEmail: customerEmail,
        locale: "en",
        quoteRequestId: quoteId,
        payload: { quoteNumber, quotedTotal: formatAED(quotedTotal) },
        chromeOptions: customerQuoteChrome(data, {
          badge: { text: "Quote ready", tone: "success" },
          infoRows: [
            { label: "Quote", value: data.quoteNumber },
            { label: "Company", value: data.company },
            { label: "Quoted on", value: data.quotedDate ?? "" },
          ],
          withSummary: true,
          ...(data.sendNote
            ? {
                excerpt: {
                  label: "Note from our team",
                  text: excerpt(data.sendNote),
                },
              }
            : {}),
        }),
      });
    });

    revalidatePath("/admin/quotes");
    revalidatePath(`/admin/quotes/${quoteId}`);

    return { success: true };
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") {
        return {
          success: false,
          error: "Quote not found.",
          errorCode: "NOT_FOUND",
        };
      }
      if (err.message === "INVALID_TRANSITION") {
        return {
          success: false,
          error: "This quote cannot be modified.",
          errorCode: "INVALID_TRANSITION",
        };
      }
    }
    console.error("[setQuotePricingAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

const QUOTE_AUDIT_ACTION: Record<"CONTACTED" | "CLOSED" | "CANCELLED", string> =
  {
    CONTACTED: "quote.contacted",
    CLOSED: "quote.closed",
    CANCELLED: "quote.reject",
  };

export async function transitionQuoteAction(
  input: unknown,
): Promise<
  | { success: true }
  | { success: false; error: string; errorCode: QuoteAdminActionErrorCode }
> {
  const staff = await requireStaffAction("quote:manage");

  try {
    const parsed = transitionQuoteSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        errorCode: "VALIDATION_ERROR",
      };
    }

    const { quoteId, toStatus, note } = parsed.data;

    if (toStatus === "CANCELLED" && !note?.trim()) {
      return {
        success: false,
        error: "A reason is required when cancelling a quote.",
        errorCode: "REASON_REQUIRED",
      };
    }

    const quotePreload = await db.quoteRequest.findUnique({
      where: { id: quoteId },
      select: { customer: { select: { email: true } }, quoteNumber: true },
    });

    if (!quotePreload) {
      return {
        success: false,
        error: "Quote not found.",
        errorCode: "NOT_FOUND",
      };
    }

    const customerEmail = quotePreload.customer.email;
    const quoteNumber = quotePreload.quoteNumber;

    await db.$transaction(
      async (tx) => {
        const current = await tx.quoteRequest.findUnique({
          where: { id: quoteId },
          select: { status: true },
        });

        if (!current) throw new Error("NOT_FOUND");

        const allowed = QUOTE_TRANSITIONS[current.status];
        if (
          isTerminalQuoteStatus(current.status) ||
          !allowed.includes(toStatus)
        ) {
          throw new Error("INVALID_TRANSITION");
        }

        const fromStatus = current.status;

        await tx.quoteRequest.update({
          where: { id: quoteId },
          data: { status: toStatus },
        });

        await tx.quoteEvent.create({
          data: {
            quoteRequestId: quoteId,
            actor: "STAFF",
            staffId: staff.id,
            fromStatus,
            toStatus,
            note: note?.trim() ?? null,
          },
        });

        if (
          toStatus !== "CONTACTED" &&
          toStatus !== "CLOSED" &&
          toStatus !== "CANCELLED"
        ) {
          throw new Error("UNSUPPORTED_AUDIT_TRANSITION");
        }

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staff.id,
            action: QUOTE_AUDIT_ACTION[toStatus],
            entityType: "QuoteRequest",
            entityId: quoteId,
            before: { status: fromStatus },
            after: { status: toStatus },
            ...(note?.trim() ? { metadata: { reason: note.trim() } } : {}),
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    const trimmedNote = note?.trim() || null;
    after(async () => {
      const data = await loadQuoteEmailData(quoteId);
      if (!data) return;
      await logAndSendEmail({
        templateKey: "quote_status_changed",
        toEmail: customerEmail,
        locale: "en",
        quoteRequestId: quoteId,
        payload: { quoteNumber, toStatus: data.statusLabel, note: trimmedNote },
        chromeOptions: customerQuoteChrome(data, {
          badge: { text: data.statusLabel, tone: data.statusTone },
          infoRows: [
            { label: "Quote", value: data.quoteNumber },
            { label: "Status", value: data.statusLabel },
          ],
          ...(trimmedNote
            ? { excerpt: { label: "Note", text: excerpt(trimmedNote) } }
            : {}),
        }),
      });
    });

    revalidatePath("/admin/quotes");
    revalidatePath(`/admin/quotes/${quoteId}`);

    return { success: true };
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") {
        return {
          success: false,
          error: "Quote not found.",
          errorCode: "NOT_FOUND",
        };
      }
      if (err.message === "INVALID_TRANSITION") {
        return {
          success: false,
          error: "This status transition is not allowed.",
          errorCode: "INVALID_TRANSITION",
        };
      }
    }
    console.error("[transitionQuoteAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export type AcceptQuoteErrorCode =
  | "UNAUTHENTICATED"
  | "NOT_B2B"
  | "NOT_OWNER"
  | "B2B_EXPIRED"
  | "QUOTE_NOT_QUOTED"
  | "QUOTE_CHANGED"
  | "TERMS_UNAVAILABLE"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

export type AcceptQuoteResult =
  | { success: true; data: { quoteNumber: string } }
  | { success: false; error: string; errorCode: AcceptQuoteErrorCode };

export async function acceptQuoteAction(
  input: unknown,
  locale: "en" | "ar" | "ru",
): Promise<AcceptQuoteResult> {
  try {
    const session = await auth();
    const customerId = await getSessionCustomerId();
    if (!customerId) {
      return {
        success: false,
        error: "You must be signed in to accept a quote.",
        errorCode: "UNAUTHENTICATED",
      };
    }
    if (session?.user?.role !== "B2B") {
      return {
        success: false,
        error: "Quote acceptance is available to approved business accounts.",
        errorCode: "NOT_B2B",
      };
    }

    const parsed = acceptQuoteSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        errorCode: "VALIDATION_ERROR",
      };
    }

    const { quoteId } = parsed.data;

    const quote = await db.quoteRequest.findUnique({
      where: { id: quoteId },
      select: {
        id: true,
        customerId: true,
        status: true,
        quoteNumber: true,
        quotedTotal: true,
        b2bAccount: { select: { status: true, expiresAt: true } },
        customer: { select: { email: true } },
      },
    });

    if (!quote || quote.customerId !== customerId) {
      return {
        success: false,
        error: "Quote not found.",
        errorCode: "NOT_OWNER",
      };
    }

    if (
      deriveB2BStatus(quote.b2bAccount.status, quote.b2bAccount.expiresAt) !==
      "APPROVED"
    ) {
      return {
        success: false,
        error: "Your trade account has expired. Renew it to accept quotes.",
        errorCode: "B2B_EXPIRED",
      };
    }

    const [termsSetting, rulesSetting] = await Promise.all([
      getSetting("quote_legal_terms"),
      getSetting("quote_rules"),
    ]);
    const filled = (v: {
      en: { body: string };
      ar: { body: string };
      ru: { body: string };
    }) => v.en.body.trim() && v.ar.body.trim() && v.ru.body.trim();
    if (!filled(termsSetting) || !filled(rulesSetting)) {
      return {
        success: false,
        error: "This quote can't be accepted online right now.",
        errorCode: "TERMS_UNAVAILABLE",
      };
    }

    await db.$transaction(
      async (tx) => {
        const current = await tx.quoteRequest.findUnique({
          where: { id: quoteId },
          select: { status: true, quotedTotal: true, shippingCost: true },
        });

        if (
          !current ||
          current.status !== "QUOTED" ||
          current.quotedTotal == null
        ) {
          throw new Error("NOT_QUOTED");
        }

        const agreedTotal = sumMoney([
          Number(current.quotedTotal),
          Number(current.shippingCost ?? 0),
        ]);
        if (roundMoney(agreedTotal) !== roundMoney(parsed.data.expectedTotal)) {
          throw new Error("QUOTE_CHANGED");
        }

        await tx.quoteRequest.update({
          where: { id: quoteId },
          data: {
            status: "ACCEPTED",
            acceptedTermsSnapshot: termsSetting,
            acceptedRulesSnapshot: rulesSetting,
          },
        });

        await tx.quoteEvent.create({
          data: {
            quoteRequestId: quoteId,
            actor: "CUSTOMER",
            fromStatus: "QUOTED",
            toStatus: "ACCEPTED",
            note: null,
          },
        });

        await tx.auditLog.create({
          data: {
            actorType: "CUSTOMER",
            actorId: customerId,
            action: "quote.approve",
            entityType: "QuoteRequest",
            entityId: quoteId,
            before: { status: "QUOTED" },
            after: {
              status: "ACCEPTED",
              acceptedLocale: locale,
              goodsSubtotal: Number(current.quotedTotal),
              shippingCost: Number(current.shippingCost ?? 0),
              agreedTotal,
            },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    const acceptedQuotedTotal =
      quote.quotedTotal != null ? Number(quote.quotedTotal) : null;
    after(async () => {
      const { sales: acceptedSalesRecipients } = await getSetting("email_recipients");
      const data = await loadQuoteEmailData(quoteId);
      if (!data) return;
      for (const salesEmail of acceptedSalesRecipients) {
        await logAndSendEmail({
          templateKey: "quote_accepted",
          toEmail: salesEmail,
          quoteRequestId: quoteId,
          payload: {
            quoteNumber: quote.quoteNumber,
            quotedTotal:
              acceptedQuotedTotal != null ? formatAED(acceptedQuotedTotal) : null,
          },
          chromeOptions: staffQuoteChrome(data, {
            badge: { text: "Accepted", tone: "success" },
            infoRows: [
              { label: "Quote", value: data.quoteNumber },
              {
                label: "Customer",
                value: data.customerName
                  ? `${data.customerName} · ${data.customerEmail}`
                  : data.customerEmail,
              },
              { label: "Company", value: data.company },
              { label: "Items", value: data.itemsLabel },
              {
                label: "Agreed total",
                value:
                  data.agreedTotal !== null
                    ? formatAED(data.agreedTotal)
                    : "Shipping to be quoted",
              },
            ],
          }),
        });
      }
    });

    revalidatePath("/", "layout");
    return { success: true, data: { quoteNumber: quote.quoteNumber } };
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_QUOTED") {
      return {
        success: false,
        error: "This quote can no longer be accepted.",
        errorCode: "QUOTE_NOT_QUOTED",
      };
    }
    if (err instanceof Error && err.message === "QUOTE_CHANGED") {
      return {
        success: false,
        error:
          "This quote was updated. Please review the new total before accepting.",
        errorCode: "QUOTE_CHANGED",
      };
    }
    console.error("[acceptQuoteAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export type CancelQuoteErrorCode =
  | "UNAUTHENTICATED"
  | "NOT_B2B"
  | "NOT_OWNER"
  | "NOT_CANCELABLE"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

export type CancelQuoteResult =
  | { success: true }
  | { success: false; error: string; errorCode: CancelQuoteErrorCode };

export async function cancelQuoteAction(
  input: unknown,
): Promise<CancelQuoteResult> {
  try {
    const session = await auth();
    const customerId = await getSessionCustomerId();
    if (!customerId) {
      return {
        success: false,
        error: "You must be signed in to cancel a quote.",
        errorCode: "UNAUTHENTICATED",
      };
    }
    if (session?.user?.role !== "B2B") {
      return {
        success: false,
        error: "Quote cancellation is available to approved business accounts.",
        errorCode: "NOT_B2B",
      };
    }

    const parsed = cancelQuoteSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        errorCode: "VALIDATION_ERROR",
      };
    }

    const { quoteId } = parsed.data;

    const quote = await db.quoteRequest.findUnique({
      where: { id: quoteId },
      select: { id: true, customerId: true, status: true },
    });

    if (!quote || quote.customerId !== customerId) {
      return {
        success: false,
        error: "Quote not found.",
        errorCode: "NOT_OWNER",
      };
    }

    await db.$transaction(
      async (tx) => {
        const current = await tx.quoteRequest.findUnique({
          where: { id: quoteId },
          select: { status: true },
        });

        if (
          !current ||
          isTerminalQuoteStatus(current.status) ||
          !QUOTE_TRANSITIONS[current.status].includes("CANCELLED")
        ) {
          throw new Error("NOT_CANCELABLE");
        }

        const fromStatus = current.status;

        await tx.quoteRequest.update({
          where: { id: quoteId },
          data: { status: "CANCELLED" },
        });

        await tx.quoteEvent.create({
          data: {
            quoteRequestId: quoteId,
            actor: "CUSTOMER",
            fromStatus,
            toStatus: "CANCELLED",
            note: null,
          },
        });

        await tx.auditLog.create({
          data: {
            actorType: "CUSTOMER",
            actorId: customerId,
            action: "quote.cancelled_by_customer",
            entityType: "QuoteRequest",
            entityId: quoteId,
            before: { status: fromStatus },
            after: { status: "CANCELLED" },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/", "layout");

    after(async () => {
      const data = await loadQuoteEmailData(quoteId);
      if (!data) return;
      const { sales: salesRecipients } =
        await getSetting("email_recipients");
      for (const salesEmail of salesRecipients) {
        await logAndSendEmail({
          templateKey: "quote_cancelled_staff",
          toEmail: salesEmail,
          payload: { quoteNumber: data.quoteNumber },
          chromeOptions: staffQuoteChrome(data, {
            badge: { text: data.statusLabel, tone: data.statusTone },
            infoRows: [
              { label: "Quote", value: data.quoteNumber },
              { label: "Company", value: data.company },
              { label: "Customer", value: data.customerName },
            ],
          }),
        });
      }
    });

    return { success: true };
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_CANCELABLE") {
      return {
        success: false,
        error: "This quote can no longer be cancelled.",
        errorCode: "NOT_CANCELABLE",
      };
    }
    console.error("[cancelQuoteAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export type RequestQuoteContactErrorCode =
  | "UNAUTHENTICATED"
  | "NOT_B2B"
  | "NOT_OWNER"
  | "NOT_ELIGIBLE"
  | "VALIDATION_ERROR"
  | "ALREADY_OPEN"
  | "INTERNAL_ERROR";

export type RequestQuoteContactResult =
  | { success: true; data: { ticketNumber: string } }
  | {
      success: false;
      error: string;
      errorCode: RequestQuoteContactErrorCode;
      existingTicketNumber?: string;
    };

class QuoteContactAlreadyOpenError extends Error {
  readonly existingTicketNumber: string;
  constructor(existingTicketNumber: string) {
    super("ALREADY_OPEN");
    this.name = "QuoteContactAlreadyOpenError";
    this.existingTicketNumber = existingTicketNumber;
  }
}

export async function requestQuoteContactAction(
  input: unknown,
): Promise<RequestQuoteContactResult> {
  try {
    const session = await auth();
    const customerId = await getSessionCustomerId();
    if (!customerId) {
      return {
        success: false,
        error: "You must be signed in to request contact about a quote.",
        errorCode: "UNAUTHENTICATED",
      };
    }
    if (session?.user?.role !== "B2B") {
      return {
        success: false,
        error: "Contact requests are available to approved business accounts.",
        errorCode: "NOT_B2B",
      };
    }

    const parsed = requestQuoteContactSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        errorCode: "VALIDATION_ERROR",
      };
    }

    const { quoteId, reason, message } = parsed.data;

    const quote = await db.quoteRequest.findUnique({
      where: { id: quoteId },
      select: {
        id: true,
        customerId: true,
        status: true,
        quoteNumber: true,
        customer: { select: { email: true } },
      },
    });

    if (!quote || quote.customerId !== customerId) {
      return {
        success: false,
        error: "Quote not found.",
        errorCode: "NOT_OWNER",
      };
    }

    if (isTerminalQuoteStatus(quote.status)) {
      return {
        success: false,
        error: "Contact requests aren't available for this quote anymore.",
        errorCode: "NOT_ELIGIBLE",
      };
    }

    const now = new Date();
    let ticketId: string;
    let ticketNumber: string;
    try {
      const result = await db.$transaction(
        async (tx) => {
          const openRequest = await tx.ticket.findFirst({
            where: {
              quoteRequestId: quoteId,
              createdByCustomerId: customerId,
              status: { in: ["OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER"] },
            },
            select: { ticketNumber: true },
          });
          if (openRequest) {
            throw new QuoteContactAlreadyOpenError(openRequest.ticketNumber);
          }

          const ticketNumber = await nextTicketNumber(tx, now);
          const created = await tx.ticket.create({
            data: {
              ticketNumber,
              subject: `Quote ${quote.quoteNumber} — contact request`,
              description: message.trim(),
              category: "QUOTE_ISSUE",
              priority: "NORMAL",
              status: "OPEN",
              quoteRequestId: quoteId,
              customerId,
              contactEmail: quote.customer.email,
              createdByCustomerId: customerId,
              quoteContactReason: reason,
            },
            select: { id: true, ticketNumber: true },
          });
          await tx.ticketEvent.create({
            data: {
              ticketId: created.id,
              type: "STATUS_CHANGE",
              actor: "CUSTOMER",
              fromStatus: null,
              toStatus: "OPEN",
              note: null,
            },
          });
          return { ticketId: created.id, ticketNumber: created.ticketNumber };
        },
        { isolationLevel: "Serializable" },
      );
      ticketId = result.ticketId;
      ticketNumber = result.ticketNumber;
    } catch (err) {
      if (err instanceof QuoteContactAlreadyOpenError) {
        return {
          success: false,
          error: "You already have an open request about this quote.",
          errorCode: "ALREADY_OPEN",
          existingTicketNumber: err.existingTicketNumber,
        };
      }
      throw err;
    }

    revalidatePath("/admin/tickets");
    revalidatePath("/[locale]/account/quotes/[id]", "page");

    after(async () => {
      const { support: supportRecipients } = await getSetting("email_recipients");
      const data = await loadTicketEmailData(ticketId);
      if (!data) return;
      await logAndSendEmail({
        templateKey: "ticket.created_customer",
        toEmail: quote.customer.email,
        payload: { ticketNumber },
        chromeOptions: customerTicketChrome(data, {
          excerpt: { label: "Your message", text: excerpt(data.description) },
        }),
      });
      for (const toEmail of supportRecipients) {
        await logAndSendEmail({
          templateKey: "ticket.created",
          toEmail,
          payload: {
            ticketNumber,
            subject: `contact request for quote ${quote.quoteNumber}`,
            detail: `Reason: ${reason}`,
          },
          chromeOptions: staffTicketChrome(data, {
            excerpt: { label: "Message", text: excerpt(data.description) },
          }),
        });
      }
    });

    return { success: true, data: { ticketNumber } };
  } catch (err) {
    console.error("[requestQuoteContactAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

// ─── finalizeAcceptedQuoteAction ──────────────────────────────────────────────

export type FinalizeQuoteErrorCode =
  | "UNAUTHENTICATED"
  | "NOT_B2B"
  | "NOT_OWNER"
  | "B2B_EXPIRED"
  | "INVALID_STATUS"
  | "ALREADY_CONVERTED"
  | "ID_VERIFICATION_REQUIRED"
  | "QUOTE_MISSING_SHIPPING"
  | "QUOTE_TOTAL_MISMATCH"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

export type FinalizeQuoteResult =
  | { success: true; data: { orderId: string; redirectUrl: string } }
  | { success: false; error: string; errorCode: FinalizeQuoteErrorCode };

export async function finalizeAcceptedQuoteAction(
  input: unknown,
  locale: "en" | "ar" | "ru",
): Promise<FinalizeQuoteResult> {
  try {
    const session = await auth();
    const customerId = await getSessionCustomerId();
    if (!customerId) {
      return {
        success: false,
        error: "You must be signed in to finalize a quote.",
        errorCode: "UNAUTHENTICATED",
      };
    }
    if (session?.user?.role !== "B2B") {
      return {
        success: false,
        error: "Quote finalization is available to approved business accounts.",
        errorCode: "NOT_B2B",
      };
    }

    const parsed = finalizeQuoteSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        errorCode: "VALIDATION_ERROR",
      };
    }
    const validatedInput = parsed.data;

    const quote = await db.quoteRequest.findUnique({
      where: { id: validatedInput.quoteId },
      select: {
        id: true,
        customerId: true,
        status: true,
        quotedTotal: true,
        quoteNumber: true,
        convertedOrderId: true,
        shippingCost: true,
        shippingAddressSnapshot: true,
        b2bAccount: { select: { status: true, expiresAt: true } },
        customer: {
          select: {
            email: true,
            name: true,
            role: true,
            verificationStatus: true,
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
                addonId: true,
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

    if (!quote || quote.customerId !== customerId) {
      return {
        success: false,
        error: "Quote not found.",
        errorCode: "NOT_OWNER",
      };
    }

    if (
      deriveB2BStatus(quote.b2bAccount.status, quote.b2bAccount.expiresAt) !==
      "APPROVED"
    ) {
      return {
        success: false,
        error: "Your trade account has expired. Renew it to finalize quotes.",
        errorCode: "B2B_EXPIRED",
      };
    }

    if (quote.shippingAddressSnapshot == null || quote.shippingCost == null) {
      return {
        success: false,
        error:
          "Shipping details are missing on this quote. Please contact us to continue.",
        errorCode: "QUOTE_MISSING_SHIPPING",
      };
    }

    const shippingAddressSnapshot =
      quote.shippingAddressSnapshot as ShippingAddressSnapshot;
    const shippingCost = Number(quote.shippingCost);

    const productSkus = quote.items.map((i) => i.productSku);
    const productRows = await db.product.findMany({
      where: { sku: { in: productSkus } },
      select: { sku: true, requiresIdVerification: true },
    });
    const restrictedSkus = productRows
      .filter((p) => p.requiresIdVerification)
      .map((p) => p.sku);

    const quoteAddonIds = [
      ...new Set(
        quote.items.flatMap((i) => i.selectedAddons.map((a) => a.addonId)),
      ),
    ];

    const [quoteProductImageRows, quoteAddonImageRows] = await Promise.all([
      productSkus.length
        ? db.productImage.findMany({
            where: { productSku: { in: productSkus } },
            select: { productSku: true, storageKey: true, displayOrder: true },
            orderBy: { displayOrder: "asc" },
          })
        : Promise.resolve([]),
      quoteAddonIds.length
        ? db.addon.findMany({
            where: { addonId: { in: quoteAddonIds } },
            select: { addonId: true, storageKey: true },
          })
        : Promise.resolve([]),
    ]);

    const quoteProductImageMap = new Map<string, string | null>();
    for (const row of quoteProductImageRows) {
      if (!quoteProductImageMap.has(row.productSku)) {
        quoteProductImageMap.set(row.productSku, row.storageKey);
      }
    }
    const quoteAddonImageMap = new Map(
      quoteAddonImageRows.map((a) => [a.addonId, a.storageKey] as const),
    );

    if (restrictedSkus.length > 0) {
      const verificationStatus = deriveVerificationStatus(
        quote.customer.verificationStatus as Parameters<
          typeof deriveVerificationStatus
        >[0],
        quote.customer.verificationExpiresAt,
      );
      if (verificationStatus !== "APPROVED") {
        return {
          success: false,
          error:
            "ID verification is required before you can finalize this order.",
          errorCode: "ID_VERIFICATION_REQUIRED",
        };
      }
    }

    const complianceSnapshot: ComplianceSnapshot = await getComplianceSnapshot(
      customerId,
      restrictedSkus,
    );

    const subtotal = sumMoney(
      quote.items.map((i) => Number(i.quotedLineTotal ?? 0)),
    );
    const addonTotal = sumMoney(
      quote.items.flatMap((i) =>
        i.selectedAddons.map((a) => Number(a.quotedLineTotal ?? 0)),
      ),
    );
    const derivedQuotedTotal = sumMoney([subtotal, addonTotal]);

    if (
      quote.quotedTotal == null ||
      roundMoney(Number(quote.quotedTotal)) !== roundMoney(derivedQuotedTotal)
    ) {
      return {
        success: false,
        error:
          "This quote's totals don't match our records. Please contact us before continuing.",
        errorCode: "QUOTE_TOTAL_MISMATCH",
      };
    }

    const { vatRate } = await getSetting("tax_config");

    const total = sumMoney([derivedQuotedTotal, shippingCost]);
    const taxAmount = roundMoney(
      derivedQuotedTotal - derivedQuotedTotal / (1 + vatRate),
    );

    const orderStatus = "AWAITING_MANUAL_PAYMENT" as const;

    const paymentProviderName = "MANUAL" as const;

    let orderId: string;
    let orderNumber: string;

    try {
      const result = await db.$transaction(
        async (tx) => {
          const current = await tx.quoteRequest.findUnique({
            where: { id: quote.id },
            select: { status: true, convertedOrderId: true },
          });

          if (!current) throw new Error("INVALID_STATUS");
          if (current.convertedOrderId !== null) {
            throw new Error("ALREADY_CONVERTED");
          }
          if (current.status !== "ACCEPTED") {
            throw new Error("INVALID_STATUS");
          }

          const generatedOrderNumber = await nextOrderNumber(tx, new Date());

          const order = await tx.order.create({
            data: {
              orderNumber: generatedOrderNumber,
              customerId,
              status: orderStatus,
              subtotal,
              addonTotal,
              shippingCost,
              discountAmount: 0,
              loyaltyPointsEarned: 0,
              loyaltyPointsFrozenAt: new Date(),
              couponCode: null,
              taxAmount,
              total,
              paymentProvider: paymentProviderName,
              shippingAddressSnapshot,
              complianceSnapshot,
              items: {
                create: quote.items.map((item) => ({
                  itemType: "PRODUCT" as const,
                  productSku: item.productSku,
                  itemNameEn: item.productNameEn,
                  itemNameAr: item.productNameAr,
                  itemNameRu: item.productNameRu,
                  itemImageSnapshot:
                    quoteProductImageMap.get(item.productSku) ?? null,
                  unitPrice: item.quotedUnitPrice!,
                  quantity: item.quantity,
                  lineTotal: item.quotedLineTotal!,
                })),
              },
            },
            select: { id: true, orderNumber: true },
          });

          const complianceRows =
            complianceDocumentRowsFromSnapshot(complianceSnapshot);
          if (complianceRows.length > 0) {
            await tx.orderComplianceDocument.createMany({
              data: complianceRows.map((row) => ({
                orderId: order.id,
                ...row,
              })),
            });
          }

          const productItems = await tx.orderItem.findMany({
            where: { orderId: order.id, itemType: "PRODUCT" },
            select: { id: true, productSku: true },
          });

          for (const item of quote.items) {
            const parentItem = productItems.find(
              (oi) => oi.productSku === item.productSku,
            );
            if (!parentItem) continue;

            for (const addon of item.selectedAddons) {
              await tx.orderItem.create({
                data: {
                  orderId: order.id,
                  itemType: "ADDON",
                  addonId: addon.addonId,
                  parentOrderItemId: parentItem.id,
                  itemNameEn: addon.addonNameEn,
                  itemNameAr: addon.addonNameAr,
                  itemNameRu: addon.addonNameRu,
                  itemImageSnapshot:
                    quoteAddonImageMap.get(addon.addonId) ?? null,
                  unitPrice: addon.quotedUnitPrice ?? 0,
                  quantity: addon.quantity,
                  lineTotal: addon.quotedLineTotal ?? 0,
                },
              });
            }
          }

          await tx.orderEvent.create({
            data: {
              orderId: order.id,
              actor: "SYSTEM",
              toStatus: orderStatus,
              rawPayload: {
                source: "quote_finalize",
                quoteNumber: quote.quoteNumber,
              },
            },
          });

          await tx.quoteRequest.update({
            where: { id: quote.id },
            data: { convertedOrderId: order.id },
          });

          await tx.auditLog.create({
            data: {
              actorType: "CUSTOMER",
              actorId: customerId,
              action: "quote.converted",
              entityType: "QuoteRequest",
              entityId: quote.id,
              before: {
                status: "ACCEPTED",
              } as unknown as Prisma.InputJsonValue,
              after: {
                status: "ACCEPTED",
                convertedOrderId: order.id,
                goodsSubtotal: subtotal,
                addonSubtotal: addonTotal,
                shippingCost,
                agreedTotal: total,
              } as unknown as Prisma.InputJsonValue,
            },
          });

          return { orderId: order.id, orderNumber: order.orderNumber };
        },
        { isolationLevel: "Serializable" },
      );

      orderId = result.orderId;
      orderNumber = result.orderNumber;
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === "ALREADY_CONVERTED") {
          return {
            success: false,
            error: "This quote has already been converted to an order.",
            errorCode: "ALREADY_CONVERTED",
          };
        }
        if (err.message === "INVALID_STATUS") {
          return {
            success: false,
            error: "This quote can no longer be finalized.",
            errorCode: "INVALID_STATUS",
          };
        }
      }
      throw err;
    }

    revalidatePath("/[locale]/account/quotes/[id]", "page");
    revalidatePath("/[locale]/account/orders/[id]", "page");

    after(async () => {
      await archiveOrderComplianceDocuments(orderId);
      const { orders: orderRecipients } = await getSetting("email_recipients");
      const data = await loadOrderEmailData(orderId);
      if (!data) return;
      const awaitingBadge = {
        text: ORDER_STATUS_LABELS.AWAITING_MANUAL_PAYMENT,
        tone: "warning" as const,
      };
      await logAndSendEmail({
        templateKey: "order_awaiting_payment",
        toEmail: data.customerEmail,
        orderId,
        payload: { orderNumber },
        chromeOptions: customerOrderChrome(data, {
          badge: awaitingBadge,
          infoRows: orderBaseRows(data),
          withSummary: true,
          withAddress: true,
        }),
      });
      for (const toEmail of orderRecipients) {
        await logAndSendEmail({
          templateKey: "order_received_staff",
          toEmail,
          orderId,
          payload: { orderNumber },
          chromeOptions: staffOrderChrome(data, { badge: awaitingBadge }),
        });
      }
    });

    return {
      success: true,
      data: {
        orderId,
        redirectUrl: `/${locale}/account/orders/${orderId}`,
      },
    };
  } catch (err) {
    console.error("[finalizeAcceptedQuoteAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}
