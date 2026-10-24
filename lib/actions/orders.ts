"use server";

import {
  DEMO_PLACEHOLDER_DOCUMENT,
  DEMO_UPLOAD_MESSAGE,
  isDemoMode,
} from "@/lib/config/demo";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { auth } from "@/auth";
import { getSessionCustomerId } from "@/lib/auth-customer";
import { db } from "@/lib/db/client";
import {
  LIVE_CATEGORY_SELECT,
  isLiveCategory,
} from "@/lib/utils/catalog-visibility";
import { placeOrderSchema } from "@/lib/validations/checkout";
import {
  getCheckoutProjection,
  resolveShipping,
} from "@/lib/db/queries/checkout";
import { nextOrderNumber } from "@/lib/db/queries/order-sequence";
import { getPaymentProvider } from "@/lib/services/payment";
import type { CreatePaymentResult } from "@/lib/services/payment/types";
import {
  checkCardPayment,
  settleCardPayment,
  GatewayUnavailableError,
} from "@/lib/services/card-payment";
import {
  holdOrderStock,
  unwindStock,
  ItemUnavailableError,
} from "@/lib/services/order-unwind";
import {
  sumMoney,
  multiplyMoney,
  roundMoney,
  formatAED,
} from "@/lib/utils/currency";
import { dubaiDay, dubaiDayBoundsUtc } from "@/lib/utils/date";
import { getSetting } from "@/lib/db/queries/settings";
import { resolveCoupon } from "@/lib/db/queries/coupon";
import { getEffectiveCouponRole } from "@/lib/utils/shop-mode";
import { getComplianceSnapshot } from "@/lib/db/queries/verification";
import type {
  ShippingAddressSnapshot,
  ShippingMethodSnapshot,
  ComplianceSnapshot,
} from "@/types/order";
import { requireStaffAction } from "@/lib/auth-staff";
import {
  transitionOrderSchema,
  quoteOrderShippingSchema,
  approveShippingQuoteSchema,
  declineShippingQuoteSchema,
  retryOrderPaymentSchema,
  recordOrderContactSchema,
  markOrderPaidSchema,
  requestOrderContactSchema,
  confirmOrderDeliverySchema,
} from "@/lib/validations/order";
import { nextTicketNumber } from "@/lib/db/queries/ticket-sequence";
import {
  isTerminalOrderStatus,
  getForwardPath,
  ORDER_STATUS_LABELS,
} from "@/lib/utils/order-status";
import { runOrderDeliveredEffects } from "@/lib/services/order-delivered";
import {
  freezeOrderPoints,
  spendOrderPoints,
  returnOrderPoints,
  InsufficientPointsError,
} from "@/lib/services/loyalty";
import { checkRedemption, redeemRuleOf } from "@/lib/utils/loyalty-points";
import { logAndSendEmail } from "@/lib/services/resend";
import {
  loadOrderEmailData,
  orderBaseRows,
  customerOrderChrome,
  staffOrderChrome,
  emailDate,
} from "@/lib/email/order-email";
import {
  loadTicketEmailData,
  staffTicketChrome,
  customerTicketChrome,
} from "@/lib/email/ticket-email";
import { excerpt } from "@/lib/email/chrome";
import { paymentMethodLabel } from "@/lib/utils/payment-method";
import { Prisma } from "@/app/generated/prisma/client";
import type { OrderStatus, CustomerRole } from "@/app/generated/prisma/client";
import { clientEnv } from "@/lib/env.client";
import { serialsComplete } from "@/lib/utils/order-serials";
import { uploadFile, deleteFile } from "@/lib/services/storage";
import {
  archiveOrderComplianceDocuments,
  complianceDocumentRowsFromSnapshot,
} from "@/lib/services/compliance-archive";
import { detectMimeType, MAX_FILE_SIZE_BYTES } from "@/lib/validations/b2b";

// ─── Error / result types ─────────────────────────────────────────────────────

export type CreateOrderErrorCode =
  | "UNAUTHENTICATED"
  | "VALIDATION_ERROR"
  | "EMPTY_CART"
  | "ID_VERIFICATION_REQUIRED"
  | "ADDRESS_NOT_FOUND"
  | "ADDRESS_VALIDATION_ERROR"
  | "SHIPPING_UNAVAILABLE"
  | "INSUFFICIENT_STOCK"
  | "COUPON_NOT_APPLICABLE"
  | "COUPON_FREE_SHIPPING_NOT_APPLICABLE"
  | "POINTS_NOT_AVAILABLE"
  | "POINTS_BELOW_MINIMUM"
  | "POINTS_OVER_LIMIT"
  | "POINTS_INSUFFICIENT_BALANCE"
  | "POINTS_RATE_CHANGED"
  | "PAYMENT_INIT_FAILED"
  | "INTERNAL_ERROR";

export type CreateOrderResult =
  | {
      success: true;
      data: { orderId: string; orderNumber: string; redirectUrl: string };
    }
  | { success: false; error: string; errorCode: CreateOrderErrorCode };

export type VerifyPaymentErrorCode =
  | "ORDER_NOT_FOUND"
  | "UNAUTHORIZED"
  | "PROVIDER_ERROR"
  | "INTERNAL_ERROR";

export type VerifyPaymentResult =
  | {
      success: true;
      data: {
        orderId: string;
        orderNumber: string;
        status: "PAID" | "PAYMENT_PENDING" | "PAYMENT_FAILED";
      };
    }
  | { success: false; error: string; errorCode: VerifyPaymentErrorCode };

class InsufficientStockError extends Error {
  constructor(sku: string) {
    super(`Insufficient stock for SKU: ${sku}`);
    this.name = "InsufficientStockError";
  }
}

class CouponError extends Error {
  constructor() {
    super("Coupon no longer applicable");
    this.name = "CouponError";
  }
}

// ─── createOrderAction ────────────────────────────────────────────────────────

export async function createOrderAction(
  input: unknown,
  locale: "en" | "ar" | "ru",
): Promise<CreateOrderResult> {
  try {
    // 1. Auth
    const customerId = await getSessionCustomerId();
    if (!customerId) {
      return {
        success: false,
        error: "You must be logged in to place an order.",
        errorCode: "UNAUTHENTICATED",
      };
    }

    // 2. Validate
    const parsed = placeOrderSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        errorCode: "VALIDATION_ERROR",
      };
    }
    const validatedInput = parsed.data;

    // 3. Resolve address
    let shippingAddressSnapshot: ShippingAddressSnapshot;

    if (validatedInput.addressSource === "saved") {
      const saved = await db.customerAddress.findUnique({
        where: { id: validatedInput.addressId },
      });
      if (!saved || saved.customerId !== customerId) {
        return {
          success: false,
          error: "Address not found.",
          errorCode: "ADDRESS_NOT_FOUND",
        };
      }
      shippingAddressSnapshot = {
        fullName: saved.fullName,
        phone: saved.phone,
        addressLine1: saved.addressLine1,
        addressLine2: saved.addressLine2 ?? null,
        city: saved.city,
        emirate: saved.emirate,
        postalCode: saved.postalCode ?? null,
        country: saved.country,
        label: saved.label ?? null,
      };
    } else {
      // addressSource === "new" — address already validated by Zod
      const addr = validatedInput.address;
      shippingAddressSnapshot = {
        fullName: addr.fullName,
        phone: addr.phone,
        addressLine1: addr.addressLine1,
        addressLine2: addr.addressLine2 ?? null,
        city: addr.city,
        emirate: addr.emirate,
        postalCode: addr.postalCode ?? null,
        country: addr.country,
        label: addr.label ?? null,
      };
    }

    // 4. Load cart projection
    const projection = await getCheckoutProjection(customerId, locale);
    if (!projection.ok) {
      return {
        success: false,
        error: "Your cart is empty.",
        errorCode: "EMPTY_CART",
      };
    }
    const { cart, customer, verification } = projection.data;

    if (verification.required && !verification.canCheckout) {
      return {
        success: false,
        error: "ID verification is required before you can place this order.",
        errorCode: "ID_VERIFICATION_REQUIRED",
      };
    }

    const restrictedSkus = cart.items
      .filter((i) => i.requiresIdVerification)
      .map((i) => i.productSku);

    const complianceSnapshot: ComplianceSnapshot = await getComplianceSnapshot(
      customerId,
      restrictedSkus,
    );

    // 5. Compute totals server-side (never trust client)
    const subtotal = sumMoney(
      cart.items.map((item) => multiplyMoney(item.unitPriceAed, item.quantity)),
    );

    const { vatRate } = await getSetting("tax_config");
    const loyaltyProgram = await getSetting("loyalty_program");

    const resolution = await resolveShipping({
      country: shippingAddressSnapshot.country,
      emirate: shippingAddressSnapshot.emirate,
      subtotal,
    });

    if (!resolution.serviceable) {
      return {
        success: false,
        error: "Selected shipping method is unavailable for this address.",
        errorCode: "SHIPPING_UNAVAILABLE",
      };
    }

    if (resolution.quoteRequired) {
      // ── HELD ORDER (manual shipping quote) ──
      if ((validatedInput.pointsToUse ?? 0) > 0) {
        return {
          success: false,
          error: "Points can't be used when shipping is quoted separately.",
          errorCode: "POINTS_NOT_AVAILABLE",
        };
      }
      const goodsTotal = subtotal;

      let heldCouponCode: string | null = null;
      let heldDiscount = 0;

      if (validatedInput.couponCode) {
        const heldCouponRole = await getEffectiveCouponRole(customerId);

        const couponResolution = await resolveCoupon(
          validatedInput.couponCode,
          {
            customerId,
            role: heldCouponRole,
            goodsTotal,
            shippingCost: 0,
          },
        );

        if (!couponResolution.valid) {
          return {
            success: false,
            error:
              "This coupon is no longer valid. Please remove it and try again.",
            errorCode: "COUPON_NOT_APPLICABLE",
          };
        }

        if (couponResolution.freeShipping) {
          return {
            success: false,
            error:
              "Free shipping coupons can't be used for destinations that require a shipping quote.",
            errorCode: "COUPON_FREE_SHIPPING_NOT_APPLICABLE",
          };
        }

        heldCouponCode = couponResolution.code;
        heldDiscount =
          couponResolution.discountAmount > 0 && !couponResolution.freeShipping
            ? couponResolution.discountAmount
            : 0;
      }

      const heldTotal = Math.max(0, sumMoney([subtotal, -heldDiscount]));
      const heldTax = roundMoney(heldTotal - heldTotal / (1 + vatRate));
      const paymentProviderName = "NGENIUS";

      // Batch-fetch trilingual names for snapshots BEFORE the transaction.
      const heldProductSkus = cart.items.map((i) => i.productSku);

      const [heldProductNameRows, heldProductImageRows] = await Promise.all([
        heldProductSkus.length
          ? db.product.findMany({
              where: { sku: { in: heldProductSkus } },
              select: { sku: true, nameEn: true, nameAr: true, nameRu: true },
            })
          : Promise.resolve([]),
        heldProductSkus.length
          ? db.productImage.findMany({
              where: { productSku: { in: heldProductSkus } },
              select: {
                productSku: true,
                storageKey: true,
                displayOrder: true,
              },
              orderBy: { displayOrder: "asc" },
            })
          : Promise.resolve([]),
      ]);

      const heldProductNameMap = new Map(
        heldProductNameRows.map((p) => [p.sku, p] as const),
      );
      const heldProductImageMap = new Map<string, string | null>();
      for (const row of heldProductImageRows) {
        if (!heldProductImageMap.has(row.productSku)) {
          heldProductImageMap.set(row.productSku, row.storageKey);
        }
      }

      let orderId: string;
      let orderNumber: string;

      try {
        const result = await db.$transaction(
          async (tx) => {
            // Stock re-check (don't trust projection)
            for (const cartItem of cart.items) {
              const product = await tx.product.findUnique({
                where: { sku: cartItem.productSku },
                select: {
                  sku: true,
                  stockQuantity: true,
                  publishStatus: true,
                  deletedAt: true,
                  category: { select: LIVE_CATEGORY_SELECT },
                },
              });
              if (
                !product ||
                product.deletedAt ||
                product.publishStatus !== "PUBLISHED" ||
                !isLiveCategory(product.category) ||
                product.stockQuantity < cartItem.quantity
              ) {
                throw new InsufficientStockError(cartItem.productSku);
              }
            }

            // Reserve stock
            for (const cartItem of cart.items) {
              await tx.product.update({
                where: { sku: cartItem.productSku },
                data: {
                  stockQuantity: { decrement: cartItem.quantity },
                  reservedQuantity: { increment: cartItem.quantity },
                },
              });
            }

            const frozenAt = new Date();
            const loyaltyPointsEarned = await freezeOrderPoints(tx, {
              items: cart.items.map((i) => ({
                productSku: i.productSku,
                unitPriceAed: i.unitPriceAed,
                quantity: i.quantity,
              })),
              discountAmount: heldDiscount,
              program: loyaltyProgram,
              at: frozenAt,
            });

            const generatedOrderNumber = await nextOrderNumber(tx, new Date());

            const order = await tx.order.create({
              data: {
                orderNumber: generatedOrderNumber,
                customerId,
                status: "AWAITING_SHIPPING_QUOTE",
                subtotal,
                addonTotal: 0,
                shippingCost: 0,
                discountAmount: heldDiscount,
                loyaltyPointsEarned,
                loyaltyPointsFrozenAt: frozenAt,
                couponCode: heldCouponCode,
                taxAmount: heldTax,
                total: heldTotal,
                paymentProvider: paymentProviderName,
                shippingAddressSnapshot,
                complianceSnapshot,
                customerNote: validatedInput.customerNote ?? null,
                items: {
                  create: cart.items.map((cartItem) => {
                    const snap = heldProductNameMap.get(cartItem.productSku);
                    return {
                      itemType: "PRODUCT" as const,
                      productSku: cartItem.productSku,
                      itemNameEn: snap?.nameEn ?? cartItem.productName,
                      itemNameAr: snap?.nameAr ?? cartItem.productName,
                      itemNameRu: snap?.nameRu ?? null,
                      itemImageSnapshot:
                        heldProductImageMap.get(cartItem.productSku) ?? null,
                      unitPrice: cartItem.unitPriceAed,
                      quantity: cartItem.quantity,
                      lineTotal: multiplyMoney(
                        cartItem.unitPriceAed,
                        cartItem.quantity,
                      ),
                    };
                  }),
                },
              },
              select: {
                id: true,
                orderNumber: true,
              },
            });

            const heldComplianceRows =
              complianceDocumentRowsFromSnapshot(complianceSnapshot);
            if (heldComplianceRows.length > 0) {
              await tx.orderComplianceDocument.createMany({
                data: heldComplianceRows.map((row) => ({
                  orderId: order.id,
                  ...row,
                })),
              });
            }

            for (const cartItem of cart.items) {
              const productSnap = await tx.product.findUnique({
                where: { sku: cartItem.productSku },
                select: { stockQuantity: true },
              });
              const qBefore =
                (productSnap?.stockQuantity ?? 0) + cartItem.quantity;
              await tx.stockMovement.create({
                data: {
                  productSku: cartItem.productSku,
                  delta: -cartItem.quantity,
                  quantityBefore: qBefore,
                  quantityAfter: qBefore - cartItem.quantity,
                  type: "SALE",
                  reference: order.id,
                },
              });
            }

            await tx.orderEvent.create({
              data: {
                orderId: order.id,
                actor: "SYSTEM",
                toStatus: "AWAITING_SHIPPING_QUOTE",
                rawPayload: {
                  source: "checkout",
                  heldForQuote: true,
                },
              },
            });

            // Wipe cart items (leave Cart row for reuse)
            await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

            return { orderId: order.id, orderNumber: order.orderNumber };
          },
          { isolationLevel: "Serializable" },
        );

        orderId = result.orderId;
        orderNumber = result.orderNumber;
      } catch (err) {
        if (err instanceof InsufficientStockError) {
          return {
            success: false,
            error: "One or more items in your cart are out of stock.",
            errorCode: "INSUFFICIENT_STOCK",
          };
        }
        throw err; // re-throw for outer catch
      }

      // Save new address if requested (non-fatal, fire-and-forget).
      if (
        validatedInput.addressSource === "new" &&
        validatedInput.address.saveToProfile
      ) {
        const addr = validatedInput.address;
        void db.customerAddress
          .create({
            data: {
              customerId,
              fullName: addr.fullName,
              phone: addr.phone,
              addressLine1: addr.addressLine1,
              addressLine2: addr.addressLine2 ?? null,
              city: addr.city,
              emirate: addr.emirate,
              postalCode: addr.postalCode ?? null,
              country: addr.country,
              label: addr.label ?? null,
            },
          })
          .catch((err) =>
            console.error(
              "[createOrderAction] Failed to save new address:",
              err,
            ),
          );
      }

      revalidatePath("/[locale]/checkout", "page");

      after(async () => {
        await archiveOrderComplianceDocuments(orderId);
        const { orders: heldOrderRecipients } = await getSetting("email_recipients");
        const data = await loadOrderEmailData(orderId);
        if (!data) return;
        const heldBadge = {
          text: ORDER_STATUS_LABELS.AWAITING_SHIPPING_QUOTE,
          tone: "warning" as const,
        };
        await logAndSendEmail({
          templateKey: "order_received",
          toEmail: data.customerEmail,
          orderId,
          payload: { orderNumber: data.orderNumber },
          chromeOptions: customerOrderChrome(data, {
            badge: heldBadge,
            infoRows: orderBaseRows(data),
            withSummary: true,
            withAddress: true,
          }),
        });
        for (const toEmail of heldOrderRecipients) {
          await logAndSendEmail({
            templateKey: "order_received_staff",
            toEmail,
            orderId,
            payload: { orderNumber: data.orderNumber },
            chromeOptions: staffOrderChrome(data, { badge: heldBadge }),
          });
        }
      });

      return {
        success: true,
        data: {
          orderId,
          orderNumber,
          redirectUrl: `/${locale}/account/orders/${orderId}`,
        },
      };
    }

    const resolvedMethods = resolution.methods;

    const chosenMethodId =
      validatedInput.shippingMethodId ?? resolvedMethods[0]?.id ?? null;
    const chosenMethod =
      resolvedMethods.find((m) => m.id === chosenMethodId) ?? null;

    if (!chosenMethod) {
      return {
        success: false,
        error: "Selected shipping method is unavailable for this address.",
        errorCode: "SHIPPING_UNAVAILABLE",
      };
    }

    let shippingCost = chosenMethod.priceAed;
    let discountAmount = 0;
    let appliedCouponCode: string | null = null;
    let appliedCouponId: string | null = null;
    let redemptionDiscount = 0;
    const goodsTotal = subtotal;
    const eligibleShippingForCoupon = chosenMethod.freeShippingEligible
      ? chosenMethod.priceAed
      : 0;
    let couponRole: CustomerRole = "B2C";

    if (validatedInput.couponCode) {
      couponRole = await getEffectiveCouponRole(customerId);

      const resolution = await resolveCoupon(validatedInput.couponCode, {
        customerId,
        role: couponRole,
        goodsTotal,
        shippingCost: eligibleShippingForCoupon,
      });

      if (!resolution.valid) {
        return {
          success: false,
          error:
            "This coupon is no longer valid. Please remove it and try again.",
          errorCode: "COUPON_NOT_APPLICABLE",
        };
      }

      if (resolution.discountAmount > 0) {
        appliedCouponCode = resolution.code;
        appliedCouponId = resolution.couponId;
        redemptionDiscount = resolution.discountAmount;
        if (resolution.freeShipping) {
          shippingCost = 0;
        } else {
          discountAmount = resolution.discountAmount;
        }
      }
    }

    const pointsRequested = validatedInput.pointsToUse ?? 0;
    let pointsUsed = 0;
    let loyaltyDiscountAmount = 0;
    if (pointsRequested > 0) {
      if (validatedInput.pointsRate !== loyaltyProgram.redeemPointsPerAed) {
        return {
          success: false,
          error: "The value of points has changed.",
          errorCode: "POINTS_RATE_CHANGED",
        };
      }
      const redemption = checkRedemption({
        points: pointsRequested,
        goodsAfterCoupon: roundMoney(
          Math.max(0, sumMoney([subtotal, -discountAmount])),
        ).toFixed(2),
        balance: customer.loyaltyPoints,
        rule: redeemRuleOf(loyaltyProgram),
      });
      if (!redemption.ok) {
        const errorCode =
          redemption.reason === "BELOW_MINIMUM"
            ? "POINTS_BELOW_MINIMUM"
            : redemption.reason === "OVER_LIMIT"
              ? "POINTS_OVER_LIMIT"
              : "POINTS_INSUFFICIENT_BALANCE";
        return {
          success: false,
          error: "These points can't be applied to this order.",
          errorCode,
        };
      }
      pointsUsed = pointsRequested;
      loyaltyDiscountAmount = redemption.discountAed;
    }

    const total = Math.max(
      0,
      sumMoney([subtotal, shippingCost, -discountAmount, -loyaltyDiscountAmount]),
    );
    const goodsBase = Math.max(0, sumMoney([subtotal, -discountAmount, -loyaltyDiscountAmount]));
    const taxAmount = roundMoney(goodsBase - goodsBase / (1 + vatRate));

    const shippingMethodSnapshot: ShippingMethodSnapshot = {
      id: chosenMethod.id,
      code: chosenMethod.code,
      nameEn: chosenMethod.nameEn,
      nameAr: chosenMethod.nameAr,
      nameRu: chosenMethod.nameRu,
      priceAed: chosenMethod.priceAed,
      estimatedDaysMin: chosenMethod.estimatedDaysMin,
      estimatedDaysMax: chosenMethod.estimatedDaysMax,
    };

    const paymentProviderName = "NGENIUS";

    // 6. Batch-fetch trilingual names for snapshots BEFORE the transaction.
    //    Moves 2N+1 queries out of the tx, shortening lock duration.
    const productSkus = cart.items.map((i) => i.productSku);

    const [productNameRows, productImageRows] =
      await Promise.all([
        productSkus.length
          ? db.product.findMany({
              where: { sku: { in: productSkus } },
              select: { sku: true, nameEn: true, nameAr: true, nameRu: true },
            })
          : Promise.resolve([]),
        productSkus.length
          ? db.productImage.findMany({
              where: { productSku: { in: productSkus } },
              select: {
                productSku: true,
                storageKey: true,
                displayOrder: true,
              },
              orderBy: { displayOrder: "asc" },
            })
          : Promise.resolve([]),
      ]);

    const productNameMap = new Map(
      productNameRows.map((p) => [p.sku, p] as const),
    );
    const productImageMap = new Map<string, string | null>();
    for (const row of productImageRows) {
      if (!productImageMap.has(row.productSku)) {
        productImageMap.set(row.productSku, row.storageKey);
      }
    }

    // 7. Transaction (Serializable to prevent oversold-stock races)
    let orderId: string;
    let orderNumber: string;

    try {
      const result = await db.$transaction(
        async (tx) => {
          // 7a. Stock re-check (don't trust projection)
          for (const cartItem of cart.items) {
            const product = await tx.product.findUnique({
              where: { sku: cartItem.productSku },
              select: {
                sku: true,
                stockQuantity: true,
                publishStatus: true,
                deletedAt: true,
                category: { select: LIVE_CATEGORY_SELECT },
              },
            });
            if (
              !product ||
              product.deletedAt ||
              product.publishStatus !== "PUBLISHED" ||
              !isLiveCategory(product.category) ||
              product.stockQuantity < cartItem.quantity
            ) {
              throw new InsufficientStockError(cartItem.productSku);
            }
          }

          // 7b. Reserve stock
          for (const cartItem of cart.items) {
            await tx.product.update({
              where: { sku: cartItem.productSku },
              data: {
                stockQuantity: { decrement: cartItem.quantity },
                reservedQuantity: { increment: cartItem.quantity },
              },
            });
          }

          const frozenAt = new Date();
          const loyaltyPointsEarned = await freezeOrderPoints(tx, {
            items: cart.items.map((i) => ({
              productSku: i.productSku,
              unitPriceAed: i.unitPriceAed,
              quantity: i.quantity,
            })),
            discountAmount: sumMoney([discountAmount, loyaltyDiscountAmount]),
            program: loyaltyProgram,
            at: frozenAt,
          });

          // 7c. Generate order number (inside transaction)
          const generatedOrderNumber = await nextOrderNumber(tx, new Date());

          // 7d. Create order with PRODUCT items in nested write.
          //     ADDON rows need parentOrderItemId, created in a second pass below.
          const order = await tx.order.create({
            data: {
              orderNumber: generatedOrderNumber,
              customerId,
              status: "PAYMENT_PENDING",
              subtotal,
              addonTotal: 0,
              shippingCost,
              discountAmount,
              loyaltyPointsEarned,
              loyaltyPointsFrozenAt: frozenAt,
              loyaltyPointsUsed: pointsUsed,
              loyaltyDiscountAmount,
              couponCode: appliedCouponCode,
              taxAmount,
              total,
              paymentProvider: paymentProviderName,
              shippingAddressSnapshot,
              shippingMethodSnapshot,
              complianceSnapshot,
              customerNote: validatedInput.customerNote ?? null,
              items: {
                create: cart.items.map((cartItem) => {
                  const snap = productNameMap.get(cartItem.productSku);
                  return {
                    itemType: "PRODUCT" as const,
                    productSku: cartItem.productSku,
                    itemNameEn: snap?.nameEn ?? cartItem.productName,
                    itemNameAr: snap?.nameAr ?? cartItem.productName,
                    itemNameRu: snap?.nameRu ?? null,
                    itemImageSnapshot:
                      productImageMap.get(cartItem.productSku) ?? null,
                    unitPrice: cartItem.unitPriceAed,
                    quantity: cartItem.quantity,
                    lineTotal: multiplyMoney(
                      cartItem.unitPriceAed,
                      cartItem.quantity,
                    ),
                  };
                }),
              },
            },
            select: {
              id: true,
              orderNumber: true,
            },
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

          for (const cartItem of cart.items) {
            const productSnap = await tx.product.findUnique({
              where: { sku: cartItem.productSku },
              select: { stockQuantity: true },
            });
            const qBefore =
              (productSnap?.stockQuantity ?? 0) + cartItem.quantity;
            await tx.stockMovement.create({
              data: {
                productSku: cartItem.productSku,
                delta: -cartItem.quantity,
                quantityBefore: qBefore,
                quantityAfter: qBefore - cartItem.quantity,
                type: "SALE",
                reference: order.id,
              },
            });
          }

          // 7f. ORDER_CREATED event
          await tx.orderEvent.create({
            data: {
              orderId: order.id,
              actor: "SYSTEM",
              toStatus: "PAYMENT_PENDING",
              rawPayload: {
                source: "checkout",
                paymentProvider: paymentProviderName,
              },
            },
          });

          if (appliedCouponId && validatedInput.couponCode) {
            const reCheck = await resolveCoupon(
              validatedInput.couponCode,
              {
                customerId,
                role: couponRole,
                goodsTotal,
                shippingCost: eligibleShippingForCoupon,
              },
              tx,
            );
            if (!reCheck.valid) {
              throw new CouponError();
            }
            await tx.coupon.update({
              where: { id: appliedCouponId },
              data: { usedCount: { increment: 1 } },
            });
            await tx.couponRedemption.create({
              data: {
                couponId: appliedCouponId,
                customerId,
                orderId: order.id,
                discountAmount: redemptionDiscount,
              },
            });
          }

          await spendOrderPoints(tx, {
            customerId,
            orderId: order.id,
            points: pointsUsed,
          });

          // 7g. Wipe cart items (leave Cart row for reuse)
          await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

          return { orderId: order.id, orderNumber: order.orderNumber };
        },
        { isolationLevel: "Serializable" },
      );

      orderId = result.orderId;
      orderNumber = result.orderNumber;
    } catch (err) {
      if (err instanceof InsufficientStockError) {
        return {
          success: false,
          error: "One or more items in your cart are out of stock.",
          errorCode: "INSUFFICIENT_STOCK",
        };
      }
      if (err instanceof CouponError) {
        return {
          success: false,
          error:
            "This coupon is no longer valid. Please remove it and try again.",
          errorCode: "COUPON_NOT_APPLICABLE",
        };
      }
      if (err instanceof InsufficientPointsError) {
        return {
          success: false,
          error: "Your points balance has changed.",
          errorCode: "POINTS_INSUFFICIENT_BALANCE",
        };
      }
      throw err; // re-throw for outer catch
    }

    // 8. Initiate payment (outside transaction — tx already committed)
    let paymentResult: CreatePaymentResult;
    try {
      const provider = getPaymentProvider();
      const returnUrl = `${clientEnv.NEXT_PUBLIC_APP_URL}/${locale}/checkout/success?orderId=${orderId}`;

      paymentResult = await provider.createPayment({
        orderId,
        orderNumber,
        amount: total,
        currency: "AED",
        customerEmail: customer.email,
        customerName: customer.name,
        returnUrl,
        locale,
        metadata: { orderNumber },
      });
    } catch (err) {
      console.error("[createOrderAction] Payment start failed:", err);
      paymentResult = {
        success: false,
        errorCode: "PAYMENT_START_FAILED",
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    }

    if (!paymentResult.success) {
      await db.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: orderId },
          data: { status: "PAYMENT_FAILED" },
        });
        await returnOrderPoints(tx, { customerId, orderId });

        const orderItems = await tx.orderItem.findMany({
          where: { orderId },
          select: {
            itemType: true,
            productSku: true,
            addonId: true,
            quantity: true,
          },
        });

        for (const item of orderItems) {
          if (item.itemType === "PRODUCT" && item.productSku) {
            const productSnap = await tx.product.findUnique({
              where: { sku: item.productSku },
              select: { stockQuantity: true },
            });
            const before = productSnap?.stockQuantity ?? 0;

            await tx.product.update({
              where: { sku: item.productSku },
              data: {
                stockQuantity: { increment: item.quantity },
                reservedQuantity: { decrement: item.quantity },
              },
            });

            await tx.stockMovement.create({
              data: {
                productSku: item.productSku,
                delta: item.quantity,
                quantityBefore: before,
                quantityAfter: before + item.quantity,
                type: "RETURN",
                reference: orderId,
                staffId: null,
                reason: "Payment failed",
              },
            });
          } else if (item.itemType === "ADDON" && item.addonId) {
            const addonSnap = await tx.product.findUnique({
              where: { sku: item.addonId },
              select: { stockQuantity: true },
            });
            const before = addonSnap?.stockQuantity ?? 0;

            await tx.product.update({
              where: { sku: item.addonId },
              data: {
                stockQuantity: { increment: item.quantity },
                reservedQuantity: { decrement: item.quantity },
              },
            });

            await tx.stockMovement.create({
              data: {
                productSku: item.addonId,
                delta: item.quantity,
                quantityBefore: before,
                quantityAfter: before + item.quantity,
                type: "RETURN",
                reference: orderId,
                staffId: null,
                reason: "Payment failed",
              },
            });
          }
        }

        await tx.orderEvent.create({
          data: {
            orderId,
            actor: "SYSTEM",
            fromStatus: "PAYMENT_PENDING",
            toStatus: "PAYMENT_FAILED",
            rawPayload: {
              errorCode: paymentResult.errorCode,
              errorMessage: paymentResult.errorMessage,
            },
          },
        });
      });

      return {
        success: false,
        error: "Payment could not be initiated. Please try again.",
        errorCode: "PAYMENT_INIT_FAILED",
      };
    }

    // Save provider refs
    await db.$transaction([
      db.order.update({
        where: { id: orderId },
        data: {
          nGeniusOrderRef: paymentResult.providerOrderId,
          nGeniusPayRef: paymentResult.providerPaymentId ?? null,
        },
      }),
      db.paymentTransaction.create({
        data: {
          orderId,
          provider: "NGENIUS",
          providerOrderId: paymentResult.providerOrderId,
          providerPaymentId: paymentResult.providerPaymentId ?? null,
          status: "INITIATED",
          amount: total,
          rawResponse:
            paymentResult.rawResponse as import("@/app/generated/prisma/client").Prisma.InputJsonValue,
        },
      }),
    ]);

    // 9. Save new address if requested (non-fatal, fire-and-forget).
    //    `void` marks the floating promise as intentional.
    if (
      validatedInput.addressSource === "new" &&
      validatedInput.address.saveToProfile
    ) {
      const addr = validatedInput.address;
      void db.customerAddress
        .create({
          data: {
            customerId,
            fullName: addr.fullName,
            phone: addr.phone,
            addressLine1: addr.addressLine1,
            addressLine2: addr.addressLine2 ?? null,
            city: addr.city,
            emirate: addr.emirate,
            postalCode: addr.postalCode ?? null,
            country: addr.country,
            label: addr.label ?? null,
          },
        })
        .catch((err) =>
          console.error("[createOrderAction] Failed to save new address:", err),
        );
    }

    revalidatePath("/[locale]/checkout", "page");
    revalidatePath("/", "layout");

    return {
      success: true,
      data: {
        orderId,
        orderNumber,
        redirectUrl: paymentResult.redirectUrl,
      },
    };
  } catch (err) {
    console.error("[createOrderAction]", err);
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

// ─── verifyPaymentAction ──────────────────────────────────────────────────────

export async function verifyPaymentAction(
  orderId: string,
): Promise<VerifyPaymentResult> {
  try {
    // 1. Fetch order
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        customerId: true,
        status: true,
        nGeniusOrderRef: true,
        nGeniusPayRef: true,
        paymentProvider: true,
        total: true,
        customer: { select: { email: true, name: true } },
        items: {
          select: {
            id: true,
            itemType: true,
            productSku: true,
            addonId: true,
            quantity: true,
          },
        },
        convertedFromQuote: { select: { id: true } },
      },
    });

    if (!order) {
      return {
        success: false,
        error: "Order not found.",
        errorCode: "ORDER_NOT_FOUND",
      };
    }

    // 2. Verify caller owns the order
    const customerId = await getSessionCustomerId();
    if (!customerId || customerId !== order.customerId) {
      return {
        success: false,
        error: "Unauthorized.",
        errorCode: "UNAUTHORIZED",
      };
    }

    // 3. Idempotency: already settled
    if (order.status === "PAID") {
      return {
        success: true,
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          status: "PAID",
        },
      };
    }

    if (order.status === "PAYMENT_FAILED") {
      return {
        success: true,
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          status: "PAYMENT_FAILED",
        },
      };
    }

    // 4. Verify with provider (status is PAYMENT_PENDING)
    if (!order.nGeniusOrderRef) {
      return {
        success: false,
        error: "No provider reference on order.",
        errorCode: "PROVIDER_ERROR",
      };
    }

    let result: Awaited<ReturnType<typeof checkCardPayment>>;
    try {
      result = await checkCardPayment({
        providerOrderId: order.nGeniusOrderRef,
        providerPaymentId: order.nGeniusPayRef,
      });
    } catch (err) {
      if (err instanceof GatewayUnavailableError) {
        return {
          success: false,
          error: "The payment provider could not be reached.",
          errorCode: "PROVIDER_ERROR",
        };
      }
      throw err;
    }

    const status = await settleCardPayment(order.id, result, {
      kind: "SYSTEM",
    });

    return {
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status:
          status === "PAID"
            ? "PAID"
            : status === "PAYMENT_PENDING"
              ? "PAYMENT_PENDING"
              : "PAYMENT_FAILED",
      },
    };
  } catch (err) {
    console.error("[verifyPaymentAction]", err);
    return {
      success: false,
      error: "An unexpected error occurred.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

// ─── transitionOrderAction ────────────────────────────────────────────────────

export type OrderAdminActionErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_TRANSITION"
  | "REASON_REQUIRED"
  | "VALIDATION_ERROR"
  | "STATUS_CHANGED"
  | "SERIALS_INCOMPLETE"
  | "INVALID_DATE"
  | "INTERNAL_ERROR";

function emailDay(day: string): string {
  const bounds = dubaiDayBoundsUtc(day);
  return bounds ? emailDate(bounds.start) : day;
}

function dubaiDayStoredAt(day: string): Date {
  if (day === dubaiDay(new Date())) return new Date();
  const bounds = dubaiDayBoundsUtc(day);
  if (!bounds) throw new Error("INVALID_DATE");
  return bounds.start;
}

export type OrderAdminActionResult =
  | { success: true }
  | { success: false; error: string; errorCode: OrderAdminActionErrorCode };

export async function transitionOrderAction(
  input: unknown,
): Promise<OrderAdminActionResult> {
  const staff = await requireStaffAction("order:update");

  try {
    const parsed = transitionOrderSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        errorCode: "VALIDATION_ERROR",
      };
    }

    const {
      orderId,
      expectedStatus,
      toStatus,
      note,
      trackingNumber,
      trackingUrl,
      carrier,
      parcelCount,
      shippedOn,
      estimatedDelivery,
      shipmentNote,
    } = parsed.data;

    if (toStatus === "SHIPPED" && !trackingNumber?.trim()) {
      return {
        success: false,
        error: "A tracking number is required to mark this order as shipped.",
        errorCode: "VALIDATION_ERROR",
      };
    }

    const orderPreload = await db.order.findUnique({
      where: { id: orderId },
      select: {
        orderNumber: true,
        customer: { select: { email: true } },
      },
    });

    if (!orderPreload) {
      return {
        success: false,
        error: "Order not found.",
        errorCode: "NOT_FOUND",
      };
    }

    let finalTrackingNumber: string | undefined;
    let finalTrackingUrl: string | undefined;

    await db.$transaction(
      async (tx) => {
        const current = await tx.order.findUnique({
          where: { id: orderId },
          select: {
            status: true,
            paidAt: true,
            createdAt: true,
          },
        });

        if (!current) throw new Error("NOT_FOUND");

        if (current.status !== expectedStatus) {
          throw new Error("STATUS_CHANGED");
        }

        if (isTerminalOrderStatus(current.status)) {
          throw new Error("INVALID_TRANSITION");
        }

        const fromStatus = current.status;

        let auditPath: string[] = [];

        const path = getForwardPath(fromStatus, toStatus);
        if (path.length === 0) throw new Error("INVALID_TRANSITION");

        auditPath = path;

        if (path.includes("READY_TO_SHIP") || path.includes("SHIPPED")) {
          const serialRows = await tx.orderItem.findMany({
            where: { orderId, itemType: "PRODUCT" },
            select: {
              id: true,
              productSku: true,
              itemNameEn: true,
              quantity: true,
              product: { select: { serialTracking: true } },
              serials: {
                select: { unitIndex: true, value: true, overrideReason: true },
              },
            },
          });
          const serialsOk = serialsComplete(
            serialRows.map((row) => ({
              id: row.id,
              productSku: row.productSku,
              name: row.itemNameEn,
              quantity: row.quantity,
              serialTracking: row.product?.serialTracking ?? "NONE",
              serials: row.serials,
            })),
          );
          if (!serialsOk) throw new Error("SERIALS_INCOMPLETE");
        }

        const trimmedTrackingNumber = trackingNumber?.trim();
        const trimmedTrackingUrl = trackingUrl?.trim();

        if (path.includes("SHIPPED")) {
          if (!trimmedTrackingNumber) throw new Error("TRACKING_REQUIRED");
          finalTrackingNumber = trimmedTrackingNumber;
          finalTrackingUrl = trimmedTrackingUrl || undefined;
        }

        const updateData: Prisma.OrderUpdateInput = { status: toStatus };
        if (path.includes("SHIPPED")) {
          if (!shippedOn) throw new Error("INVALID_DATE");
          const today = dubaiDay(new Date());
          const earliest = dubaiDay(current.paidAt ?? current.createdAt);
          if (shippedOn > today || shippedOn < earliest) {
            throw new Error("INVALID_DATE");
          }
          if (estimatedDelivery) {
            const latest = dubaiDay(
              new Date(
                new Date(`${shippedOn}T00:00:00.000Z`).getTime() + 60 * 864e5,
              ),
            );
            if (estimatedDelivery < shippedOn || estimatedDelivery > latest) {
              throw new Error("INVALID_DATE");
            }
          }

          updateData.trackingNumber = trimmedTrackingNumber;
          updateData.trackingUrl = trimmedTrackingUrl || null;
          updateData.shippedAt = dubaiDayStoredAt(shippedOn);
          updateData.carrier = carrier ?? null;
          updateData.parcelCount = parcelCount ?? null;
          updateData.shipmentNote = shipmentNote?.trim() || null;
          updateData.estimatedDelivery = estimatedDelivery
            ? dubaiDayStoredAt(estimatedDelivery)
            : null;
        }

        await tx.order.update({
          where: { id: orderId },
          data: updateData,
        });

        // Backfill intermediate steps (all except the final target)
        let prev = fromStatus;
        for (const step of path.slice(0, -1)) {
          await tx.orderEvent.create({
            data: {
              orderId,
              actor: "STAFF",
              staffId: staff.id,
              fromStatus: prev,
              toStatus: step,
              note: null,
              trackingNumber:
                step === "SHIPPED" ? (trimmedTrackingNumber ?? null) : null,
              trackingUrl:
                step === "SHIPPED" ? trimmedTrackingUrl || null : null,
            },
          });
          prev = step;
        }

        // Final target event (carries the user's note)
        await tx.orderEvent.create({
          data: {
            orderId,
            actor: "STAFF",
            staffId: staff.id,
            fromStatus: prev,
            toStatus,
            note: note?.trim() ?? null,
            trackingNumber:
              toStatus === "SHIPPED" ? (trimmedTrackingNumber ?? null) : null,
            trackingUrl:
              toStatus === "SHIPPED" ? trimmedTrackingUrl || null : null,
            ...(toStatus === "SHIPPED"
              ? {
                  rawPayload: {
                    source: "shipment",
                    carrier: carrier ?? null,
                    parcelCount: parcelCount ?? null,
                    shippedOn: shippedOn ?? null,
                    estimatedDelivery: estimatedDelivery ?? null,
                  } as unknown as Prisma.InputJsonValue,
                }
              : {}),
          },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staff.id,
            action: "order.status_changed",
            entityType: "Order",
            entityId: orderId,
            metadata: {
              fromStatus,
              toStatus,
              path: auditPath,
              note: note?.trim() ?? null,
              trackingNumber: finalTrackingNumber ?? null,
              trackingUrl: finalTrackingUrl ?? null,
              ...(auditPath.includes("SHIPPED")
                ? {
                    carrier: carrier ?? null,
                    parcelCount: parcelCount ?? null,
                    shippedOn: shippedOn ?? null,
                    estimatedDelivery: estimatedDelivery ?? null,
                    shipmentNote: shipmentNote?.trim() || null,
                  }
                : {}),
            } as unknown as Prisma.InputJsonValue,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    if (toStatus === "SHIPPED") {
      after(async () => {
        const data = await loadOrderEmailData(orderId);
        if (!data) return;
        await logAndSendEmail({
          templateKey: "order_shipped",
          toEmail: data.customerEmail,
          locale: "en",
          orderId,
          payload: {
            orderNumber: data.orderNumber,
            trackingNumber: data.trackingNumber,
            carrier: carrier ?? null,
            parcelCount: parcelCount ?? null,
          },
          chromeOptions: customerOrderChrome(data, {
            badge: { text: ORDER_STATUS_LABELS.SHIPPED, tone: "info" },
            infoRows: [
              { label: "Order", value: data.orderNumber },
              ...(carrier ? [{ label: "Carrier", value: carrier }] : []),
              ...(data.trackingNumber
                ? [{ label: "Tracking number", value: data.trackingNumber }]
                : []),
              ...(data.trackingUrl ? [{ label: "Tracking link", value: data.trackingUrl }] : []),
              ...(parcelCount !== undefined
                ? [{ label: "Parcels", value: String(parcelCount) }]
                : []),
              ...(shippedOn
                ? [{ label: "Shipped on", value: emailDay(shippedOn) }]
                : []),
              ...(estimatedDelivery
                ? [
                    {
                      label: "Estimated delivery",
                      value: emailDay(estimatedDelivery),
                    },
                  ]
                : []),
              ...(shipmentNote?.trim()
                ? [{ label: "Note", value: shipmentNote.trim() }]
                : []),
            ],
            withSummary: true,
            withAddress: true,
          }),
        });
      });
    }

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orderId}`);

    return { success: true };
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") {
        return {
          success: false,
          error: "Order not found.",
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
      if (err.message === "INVALID_DATE") {
        return {
          success: false,
          error:
            "Check the dates: shipped on cannot be in the future or before the order was paid, and estimated delivery must fall within 60 days after shipping.",
          errorCode: "INVALID_DATE",
        };
      }
      if (err.message === "SERIALS_INCOMPLETE") {
        return {
          success: false,
          error: "Record every serial or lot number before this order can be packed.",
          errorCode: "SERIALS_INCOMPLETE",
        };
      }
      if (err.message === "STATUS_CHANGED") {
        return {
          success: false,
          error: "This order changed since you opened it. Reload the page.",
          errorCode: "STATUS_CHANGED",
        };
      }
      if (err.message === "TRACKING_REQUIRED") {
        return {
          success: false,
          error: "A tracking number is required to mark this order as shipped.",
          errorCode: "VALIDATION_ERROR",
        };
      }
    }
    console.error("[transitionOrderAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

// ─── quoteOrderShippingAction ─────────────────────────────────────────────────

export async function quoteOrderShippingAction(
  input: unknown,
): Promise<OrderAdminActionResult> {
  const staff = await requireStaffAction("order:update");

  try {
    const parsed = quoteOrderShippingSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        errorCode: "VALIDATION_ERROR",
      };
    }

    const { orderId, shippingQuoteAed } = parsed.data;

    const orderPreload = await db.order.findUnique({
      where: { id: orderId },
      select: { orderNumber: true },
    });

    if (!orderPreload) {
      return {
        success: false,
        error: "Order not found.",
        errorCode: "NOT_FOUND",
      };
    }

    const { vatRate } = await getSetting("tax_config");

    await db.$transaction(
      async (tx) => {
        const current = await tx.order.findUnique({
          where: { id: orderId },
          select: {
            status: true,
            subtotal: true,
            addonTotal: true,
            discountAmount: true,
            shippingCost: true,
            taxAmount: true,
            total: true,
          },
        });

        if (!current) throw new Error("NOT_FOUND");

        if (
          current.status !== "AWAITING_SHIPPING_QUOTE" &&
          current.status !== "AWAITING_QUOTE_APPROVAL"
        ) {
          throw new Error("INVALID_TRANSITION");
        }

        const subtotal = Number(current.subtotal);
        const addonTotal = Number(current.addonTotal);
        const discountAmount = Number(current.discountAmount);
        const shippingCost = roundMoney(shippingQuoteAed);
        const total = Math.max(
          0,
          sumMoney([subtotal, addonTotal, shippingCost, -discountAmount]),
        );
        const goodsBase = Math.max(
          0,
          sumMoney([subtotal, addonTotal, -discountAmount]),
        );
        const taxAmount = roundMoney(goodsBase - goodsBase / (1 + vatRate));

        await tx.order.update({
          where: { id: orderId },
          data: {
            shippingCost,
            total,
            taxAmount,
            status: "AWAITING_QUOTE_APPROVAL",
            shippingQuotedAt: new Date(),
            shippingQuotedBy: staff.id,
          },
        });

        await tx.orderEvent.create({
          data: {
            orderId,
            actor: "STAFF",
            staffId: staff.id,
            fromStatus: current.status,
            toStatus: "AWAITING_QUOTE_APPROVAL",
            note: null,
            trackingNumber: null,
            trackingUrl: null,
            rawPayload: {
              shippingQuoteAed: shippingCost,
              previousTotal: Number(current.total),
            },
          },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staff.id,
            action: "order.shipping_quote",
            entityType: "Order",
            entityId: orderId,
            before: {
              status: current.status,
              shippingCost: Number(current.shippingCost),
              taxAmount: Number(current.taxAmount),
              total: Number(current.total),
            } as unknown as Prisma.InputJsonValue,
            after: {
              status: "AWAITING_QUOTE_APPROVAL",
              shippingCost,
              taxAmount,
              total,
            } as unknown as Prisma.InputJsonValue,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orderId}`);

    after(async () => {
      const data = await loadOrderEmailData(orderId);
      if (!data) return;
      await logAndSendEmail({
        templateKey: "order_shipping_quoted",
        toEmail: data.customerEmail,
        orderId: data.id,
        payload: { orderNumber: data.orderNumber },
        chromeOptions: customerOrderChrome(data, {
          badge: {
            text: ORDER_STATUS_LABELS.AWAITING_QUOTE_APPROVAL,
            tone: "warning",
          },
          infoRows: orderBaseRows(data),
          withSummary: true,
          withAddress: true,
        }),
      });
    });

    return { success: true };
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") {
        return {
          success: false,
          error: "Order not found.",
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
    console.error("[quoteOrderShippingAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

// ─── Customer quote result types ──────────────────────────────────────────────

export type CustomerQuoteErrorCode =
  | "UNAUTHENTICATED"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "INVALID_STATUS"
  | "QUOTE_CHANGED"
  | "COUPON_NOT_APPLICABLE"
  | "PAYMENT_INIT_FAILED"
  | "INTERNAL_ERROR";

export type ApproveQuoteResult =
  | { success: true; data: { redirectUrl: string } }
  | { success: false; error: string; errorCode: CustomerQuoteErrorCode };

export type CustomerQuoteResult =
  | { success: true }
  | { success: false; error: string; errorCode: CustomerQuoteErrorCode };

// ─── declineShippingQuoteAction ───────────────────────────────────────────────

export async function declineShippingQuoteAction(
  input: unknown,
): Promise<CustomerQuoteResult> {
  try {
    const customerId = await getSessionCustomerId();
    if (!customerId) {
      return {
        success: false,
        error: "You must be logged in to decline a shipping quote.",
        errorCode: "UNAUTHENTICATED",
      };
    }

    const parsed = declineShippingQuoteSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        errorCode: "VALIDATION_ERROR",
      };
    }
    const { orderId, reason } = parsed.data;

    await db.$transaction(
      async (tx) => {
        const current = await tx.order.findUnique({
          where: { id: orderId },
          select: { customerId: true, status: true, total: true },
        });

        if (!current || current.customerId !== customerId) {
          throw new Error("NOT_FOUND");
        }

        if (current.status !== "AWAITING_QUOTE_APPROVAL") {
          throw new Error("INVALID_STATUS");
        }

        const items = await tx.orderItem.findMany({
          where: { orderId },
          select: {
            itemType: true,
            productSku: true,
            addonId: true,
            quantity: true,
          },
        });

        for (const item of items) {
          if (item.itemType === "PRODUCT" && item.productSku) {
            const productSnap = await tx.product.findUnique({
              where: { sku: item.productSku },
              select: { stockQuantity: true },
            });
            const before = productSnap?.stockQuantity ?? 0;

            await tx.product.update({
              where: { sku: item.productSku },
              data: {
                stockQuantity: { increment: item.quantity },
                reservedQuantity: { decrement: item.quantity },
              },
            });

            await tx.stockMovement.create({
              data: {
                productSku: item.productSku,
                delta: item.quantity,
                quantityBefore: before,
                quantityAfter: before + item.quantity,
                type: "RETURN",
                reference: orderId,
                staffId: null,
                reason: "Quote declined by customer",
              },
            });
          } else if (item.itemType === "ADDON" && item.addonId) {
            const addonSnap = await tx.product.findUnique({
              where: { sku: item.addonId },
              select: { stockQuantity: true },
            });
            const before = addonSnap?.stockQuantity ?? 0;

            await tx.product.update({
              where: { sku: item.addonId },
              data: {
                stockQuantity: { increment: item.quantity },
                reservedQuantity: { decrement: item.quantity },
              },
            });

            await tx.stockMovement.create({
              data: {
                productSku: item.addonId,
                delta: item.quantity,
                quantityBefore: before,
                quantityAfter: before + item.quantity,
                type: "RETURN",
                reference: orderId,
                staffId: null,
                reason: "Quote declined by customer",
              },
            });
          }
        }

        await tx.order.update({
          where: { id: orderId },
          data: { status: "CANCELLED" },
        });

        await tx.orderEvent.create({
          data: {
            orderId,
            actor: "CUSTOMER",
            fromStatus: "AWAITING_QUOTE_APPROVAL",
            toStatus: "CANCELLED",
            note: reason ?? null,
          },
        });

        await tx.auditLog.create({
          data: {
            actorType: "CUSTOMER",
            actorId: customerId,
            action: "order.quote_declined",
            entityType: "Order",
            entityId: orderId,
            before: {
              status: "AWAITING_QUOTE_APPROVAL",
              total: Number(current.total),
            } as unknown as Prisma.InputJsonValue,
            after: {
              status: "CANCELLED",
            } as unknown as Prisma.InputJsonValue,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/[locale]/account/orders/[id]", "page");

    after(async () => {
      const { orders: orderRecipients } = await getSetting("email_recipients");
      const data = await loadOrderEmailData(orderId);
      if (!data) return;
      const trimmedReason = (reason ?? "").trim();
      for (const toEmail of orderRecipients) {
        await logAndSendEmail({
          templateKey: "order_quote_declined_staff",
          toEmail,
          orderId: data.id,
          payload: { orderNumber: data.orderNumber },
          chromeOptions: staffOrderChrome(data, {
            badge: { text: ORDER_STATUS_LABELS.CANCELLED, tone: "neutral" },
            extraRows: trimmedReason
              ? [{ label: "Reason", value: excerpt(trimmedReason) }]
              : undefined,
          }),
        });
      }
    });

    return { success: true };
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") {
        return {
          success: false,
          error: "Order not found.",
          errorCode: "NOT_FOUND",
        };
      }
      if (err.message === "INVALID_STATUS") {
        return {
          success: false,
          error: "This order is not awaiting quote approval.",
          errorCode: "INVALID_STATUS",
        };
      }
    }
    console.error("[declineShippingQuoteAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

// ─── approveShippingQuoteAction ───────────────────────────────────────────────

export async function approveShippingQuoteAction(
  input: unknown,
  locale: "en" | "ar" | "ru",
): Promise<ApproveQuoteResult> {
  try {
    const customerId = await getSessionCustomerId();
    if (!customerId) {
      return {
        success: false,
        error: "You must be logged in to approve a shipping quote.",
        errorCode: "UNAUTHENTICATED",
      };
    }

    const parsed = approveShippingQuoteSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        errorCode: "VALIDATION_ERROR",
      };
    }
    const { orderId, expectedTotal } = parsed.data;

    const preload = await db.order.findUnique({
      where: { id: orderId },
      select: {
        customerId: true,
        status: true,
        total: true,
        couponCode: true,
        subtotal: true,
        addonTotal: true,
        discountAmount: true,
        orderNumber: true,
        customer: { select: { email: true, name: true, role: true } },
      },
    });

    if (!preload || preload.customerId !== customerId) {
      return {
        success: false,
        error: "Order not found.",
        errorCode: "NOT_FOUND",
      };
    }

    const goodsTotal = sumMoney([
      Number(preload.subtotal),
      Number(preload.addonTotal),
    ]);

    let txResult: { couponId: string | null; approvedTotal: number };

    try {
      txResult = await db.$transaction(
        async (tx) => {
          const current = await tx.order.findUnique({
            where: { id: orderId },
            select: {
              status: true,
              total: true,
              couponCode: true,
              discountAmount: true,
            },
          });

          if (!current) throw new Error("NOT_FOUND");

          if (current.status !== "AWAITING_QUOTE_APPROVAL") {
            throw new Error("INVALID_STATUS");
          }

          if (roundMoney(Number(current.total)) !== roundMoney(expectedTotal)) {
            throw new Error("QUOTE_CHANGED");
          }

          let burnedCouponId: string | null = null;

          if (current.couponCode) {
            const resolution = await resolveCoupon(
              current.couponCode,
              {
                customerId,
                role: preload.customer.role,
                goodsTotal,
                shippingCost: 0,
              },
              tx,
            );

            if (!resolution.valid) {
              throw new Error("COUPON_NOT_APPLICABLE");
            }

            await tx.coupon.update({
              where: { id: resolution.couponId },
              data: { usedCount: { increment: 1 } },
            });

            await tx.couponRedemption.create({
              data: {
                couponId: resolution.couponId,
                customerId,
                orderId,
                discountAmount: Number(current.discountAmount),
              },
            });

            burnedCouponId = resolution.couponId;
          }

          await tx.order.update({
            where: { id: orderId },
            data: { status: "PAYMENT_PENDING" },
          });

          await tx.orderEvent.create({
            data: {
              orderId,
              actor: "CUSTOMER",
              fromStatus: "AWAITING_QUOTE_APPROVAL",
              toStatus: "PAYMENT_PENDING",
              rawPayload: { approvedTotal: Number(current.total) },
            },
          });

          await tx.auditLog.create({
            data: {
              actorType: "CUSTOMER",
              actorId: customerId,
              action: "order.quote_approved",
              entityType: "Order",
              entityId: orderId,
              before: {
                status: "AWAITING_QUOTE_APPROVAL",
                total: Number(current.total),
              } as unknown as Prisma.InputJsonValue,
              after: {
                status: "PAYMENT_PENDING",
                total: Number(current.total),
              } as unknown as Prisma.InputJsonValue,
            },
          });

          return {
            couponId: burnedCouponId,
            approvedTotal: Number(current.total),
          };
        },
        { isolationLevel: "Serializable" },
      );
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === "NOT_FOUND") {
          return {
            success: false,
            error: "Order not found.",
            errorCode: "NOT_FOUND",
          };
        }
        if (err.message === "INVALID_STATUS") {
          return {
            success: false,
            error: "This order is not awaiting quote approval.",
            errorCode: "INVALID_STATUS",
          };
        }
        if (err.message === "QUOTE_CHANGED") {
          return {
            success: false,
            error:
              "The shipping quote has changed. Please review the updated total before approving.",
            errorCode: "QUOTE_CHANGED",
          };
        }
        if (err.message === "COUPON_NOT_APPLICABLE") {
          return {
            success: false,
            error:
              "Your coupon is no longer valid. Please contact support to proceed.",
            errorCode: "COUPON_NOT_APPLICABLE",
          };
        }
      }
      throw err;
    }

    // Initiate payment (outside transaction — tx already committed)
    const provider = getPaymentProvider();
    const returnUrl = `${clientEnv.NEXT_PUBLIC_APP_URL}/${locale}/checkout/success?orderId=${orderId}`;

    const paymentResult = await provider.createPayment({
      orderId,
      orderNumber: preload.orderNumber,
      amount: txResult.approvedTotal,
      currency: "AED",
      customerEmail: preload.customer.email,
      customerName: preload.customer.name,
      returnUrl,
      locale,
      metadata: { orderNumber: preload.orderNumber },
    });

    if (!paymentResult.success) {
      await db.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: orderId },
          data: { status: "AWAITING_QUOTE_APPROVAL" },
        });

        if (txResult.couponId) {
          await tx.coupon.update({
            where: { id: txResult.couponId },
            data: { usedCount: { decrement: 1 } },
          });
          await tx.couponRedemption.deleteMany({ where: { orderId } });
        }

        await tx.orderEvent.create({
          data: {
            orderId,
            actor: "SYSTEM",
            fromStatus: "PAYMENT_PENDING",
            toStatus: "AWAITING_QUOTE_APPROVAL",
            rawPayload: {
              errorCode: paymentResult.errorCode,
              errorMessage: paymentResult.errorMessage,
            },
          },
        });
      });

      revalidatePath("/[locale]/account/orders/[id]", "page");

      return {
        success: false,
        error: "Payment could not be initiated. Please try again.",
        errorCode: "PAYMENT_INIT_FAILED",
      };
    }

    // Save provider refs
    await db.$transaction([
      db.order.update({
        where: { id: orderId },
        data: {
          nGeniusOrderRef: paymentResult.providerOrderId,
          nGeniusPayRef: paymentResult.providerPaymentId ?? null,
        },
      }),
      db.paymentTransaction.create({
        data: {
          orderId,
          provider: "NGENIUS",
          providerOrderId: paymentResult.providerOrderId,
          providerPaymentId: paymentResult.providerPaymentId ?? null,
          status: "INITIATED",
          amount: txResult.approvedTotal,
          rawResponse: paymentResult.rawResponse as Prisma.InputJsonValue,
        },
      }),
    ]);

    revalidatePath("/[locale]/account/orders/[id]", "page");

    return {
      success: true,
      data: { redirectUrl: paymentResult.redirectUrl },
    };
  } catch (err) {
    console.error("[approveShippingQuoteAction]", err);
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

// ─── Retry order payment result types ─────────────────────────────────────────

export type RetryOrderPaymentErrorCode =
  | "UNAUTHENTICATED"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "INVALID_STATUS"
  | "TOTAL_CHANGED"
  | "RETRY_IN_PROGRESS"
  | "POINTS_INSUFFICIENT_BALANCE"
  | "ITEM_UNAVAILABLE"
  | "PAYMENT_INIT_FAILED"
  | "INTERNAL_ERROR";

export type RetryOrderPaymentResult =
  | { success: true; data: { redirectUrl: string } }
  | { success: false; error: string; errorCode: RetryOrderPaymentErrorCode };

const RETRYABLE_PAYMENT_STATUSES: OrderStatus[] = [
  "PAYMENT_PENDING",
  "PAYMENT_FAILED",
];

// ─── retryOrderPaymentAction ──────────────────────────────────────────────────

export async function retryOrderPaymentAction(
  input: unknown,
  locale: "en" | "ar" | "ru",
): Promise<RetryOrderPaymentResult> {
  try {
    const customerId = await getSessionCustomerId();
    if (!customerId) {
      return {
        success: false,
        error: "You must be logged in to pay for an order.",
        errorCode: "UNAUTHENTICATED",
      };
    }

    const parsed = retryOrderPaymentSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        errorCode: "VALIDATION_ERROR",
      };
    }
    const { orderId, expectedTotal } = parsed.data;

    const preload = await db.order.findUnique({
      where: { id: orderId },
      select: {
        customerId: true,
        orderNumber: true,
        status: true,
        nGeniusOrderRef: true,
        nGeniusPayRef: true,
        customer: { select: { email: true, name: true } },
      },
    });

    if (!preload || preload.customerId !== customerId) {
      return {
        success: false,
        error: "Order not found.",
        errorCode: "NOT_FOUND",
      };
    }

    const returnUrl = `${clientEnv.NEXT_PUBLIC_APP_URL}/${locale}/checkout/success?orderId=${orderId}`;

    let closing: {
      providerOrderId: string;
      status: "FAILED" | "CANCELLED";
      failureCode: string | null;
      failureMessage: string | null;
    } | null = null;

    if (preload.status === "PAYMENT_PENDING" && preload.nGeniusOrderRef) {
      let check: Awaited<ReturnType<typeof checkCardPayment>>;
      try {
        check = await checkCardPayment({
          providerOrderId: preload.nGeniusOrderRef,
          providerPaymentId: preload.nGeniusPayRef,
        });
      } catch (err) {
        if (err instanceof GatewayUnavailableError) {
          return {
            success: false,
            error: "Payment could not be initiated. Please try again.",
            errorCode: "PAYMENT_INIT_FAILED",
          };
        }
        throw err;
      }

      if (check.success) {
        const settled = await settleCardPayment(orderId, check, {
          kind: "SYSTEM",
        });
        if (settled === "PAID") {
          return { success: true, data: { redirectUrl: returnUrl } };
        }
      } else {
        closing = {
          providerOrderId: preload.nGeniusOrderRef,
          status: check.status === "PENDING" ? "CANCELLED" : check.status,
          failureCode: check.errorCode ?? null,
          failureMessage:
            check.status === "PENDING"
              ? "Replaced by a new payment attempt"
              : (check.errorMessage ?? null),
        };
      }
    }

    let txResult: { previousStatus: OrderStatus; amount: number };

    try {
      txResult = await db.$transaction(
        async (tx) => {
          const current = await tx.order.findUnique({
            where: { id: orderId },
            select: {
              status: true,
              total: true,
              loyaltyPointsUsed: true,
              convertedFromQuote: { select: { id: true } },
            },
          });

          if (!current) throw new Error("NOT_FOUND");

          if (!RETRYABLE_PAYMENT_STATUSES.includes(current.status)) {
            throw new Error("INVALID_STATUS");
          }

          if (roundMoney(Number(current.total)) !== roundMoney(expectedTotal)) {
            throw new Error("TOTAL_CHANGED");
          }

          if (current.status === "PAYMENT_FAILED") {
            await holdOrderStock(tx, orderId);
          }

          if (closing) {
            await tx.paymentTransaction.updateMany({
              where: {
                orderId,
                providerOrderId: closing.providerOrderId,
                status: { in: ["INITIATED", "PENDING"] },
              },
              data: {
                status: closing.status,
                failureCode: closing.failureCode,
                failureMessage: closing.failureMessage,
              },
            });
          }

          if (current.loyaltyPointsUsed > 0) {
            await spendOrderPoints(tx, {
              customerId,
              orderId,
              points: current.loyaltyPointsUsed,
            });
          }

          await tx.order.update({
            where: { id: orderId },
            data: { status: "PAYMENT_PENDING" },
          });

          await tx.orderEvent.create({
            data: {
              orderId,
              actor: "CUSTOMER",
              fromStatus: current.status,
              toStatus: "PAYMENT_PENDING",
              rawPayload: { retriedTotal: Number(current.total) },
            },
          });

          await tx.auditLog.create({
            data: {
              actorType: "CUSTOMER",
              actorId: customerId,
              action: "order.payment_retried",
              entityType: "Order",
              entityId: orderId,
              before: {
                status: current.status,
                total: Number(current.total),
              } as unknown as Prisma.InputJsonValue,
              after: {
                status: "PAYMENT_PENDING",
                total: Number(current.total),
              } as unknown as Prisma.InputJsonValue,
            },
          });

          return {
            previousStatus: current.status,
            amount: Number(current.total),
          };
        },
        { isolationLevel: "Serializable" },
      );
    } catch (err) {
      if (err instanceof InsufficientPointsError) {
        return {
          success: false,
          error: "Not enough points to retry this order.",
          errorCode: "POINTS_INSUFFICIENT_BALANCE",
        };
      }
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2034"
      ) {
        return {
          success: false,
          error: "Another payment attempt is already in progress.",
          errorCode: "RETRY_IN_PROGRESS",
        };
      }
      if (err instanceof ItemUnavailableError) {
        return {
          success: false,
          error: "An item in this order is no longer available.",
          errorCode: "ITEM_UNAVAILABLE",
        };
      }
      if (err instanceof Error) {
        if (err.message === "NOT_FOUND") {
          return {
            success: false,
            error: "Order not found.",
            errorCode: "NOT_FOUND",
          };
        }
        if (err.message === "INVALID_STATUS") {
          return {
            success: false,
            error: "This order is no longer awaiting payment.",
            errorCode: "INVALID_STATUS",
          };
        }
        if (err.message === "TOTAL_CHANGED") {
          return {
            success: false,
            error:
              "The order total has changed. Please refresh and review the new total.",
            errorCode: "TOTAL_CHANGED",
          };
        }
      }
      throw err;
    }

    const provider = getPaymentProvider();

    const paymentResult = await provider.createPayment({
      orderId,
      orderNumber: preload.orderNumber,
      amount: txResult.amount,
      currency: "AED",
      customerEmail: preload.customer.email,
      customerName: preload.customer.name,
      returnUrl,
      locale,
      metadata: { orderNumber: preload.orderNumber },
    });

    if (!paymentResult.success) {
      await db.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: orderId },
          data: { status: txResult.previousStatus },
        });

        if (txResult.previousStatus === "PAYMENT_FAILED") {
          await returnOrderPoints(tx, { customerId, orderId });
          await unwindStock(tx, {
            orderId,
            staffId: null,
            reason: "Payment could not start",
            releaseReservation: true,
          });
        }

        await tx.orderEvent.create({
          data: {
            orderId,
            actor: "SYSTEM",
            fromStatus: "PAYMENT_PENDING",
            toStatus: txResult.previousStatus,
            rawPayload: {
              errorCode: paymentResult.errorCode,
              errorMessage: paymentResult.errorMessage,
            },
          },
        });
      });

      revalidatePath("/[locale]/account/orders/[id]", "page");

      return {
        success: false,
        error: "Payment could not be initiated. Please try again.",
        errorCode: "PAYMENT_INIT_FAILED",
      };
    }

    await db.$transaction([
      db.order.update({
        where: { id: orderId },
        data: {
          nGeniusOrderRef: paymentResult.providerOrderId,
          nGeniusPayRef: paymentResult.providerPaymentId ?? null,
        },
      }),
      db.paymentTransaction.create({
        data: {
          orderId,
          provider: "NGENIUS",
          providerOrderId: paymentResult.providerOrderId,
          providerPaymentId: paymentResult.providerPaymentId ?? null,
          status: "INITIATED",
          amount: txResult.amount,
          rawResponse: paymentResult.rawResponse as Prisma.InputJsonValue,
        },
      }),
    ]);

    revalidatePath("/[locale]/account/orders/[id]", "page");

    return {
      success: true,
      data: { redirectUrl: paymentResult.redirectUrl },
    };
  } catch (err) {
    console.error("[retryOrderPaymentAction]", err);
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export type RecordOrderContactErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

export type RecordOrderContactResult =
  | { success: true }
  | { success: false; error: string; errorCode: RecordOrderContactErrorCode };

export async function recordOrderContactAction(
  input: unknown,
): Promise<RecordOrderContactResult> {
  const staff = await requireStaffAction("order:record_contact");

  try {
    const parsed = recordOrderContactSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        errorCode: "VALIDATION_ERROR",
      };
    }

    const { orderId, note } = parsed.data;
    const trimmedNote = note?.trim() || null;

    await db.$transaction(
      async (tx) => {
        const current = await tx.order.findUnique({
          where: { id: orderId },
          select: { status: true },
        });

        if (!current) throw new Error("NOT_FOUND");

        await tx.orderEvent.create({
          data: {
            orderId,
            actor: "STAFF",
            staffId: staff.id,
            fromStatus: null,
            toStatus: current.status,
            note: trimmedNote,
            trackingNumber: null,
            trackingUrl: null,
          },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staff.id,
            action: "order.contacted",
            entityType: "Order",
            entityId: orderId,
            metadata: {
              status: current.status,
              hasNote: trimmedNote !== null,
            } as unknown as Prisma.InputJsonValue,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    return { success: true };
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return {
        success: false,
        error: "Order not found.",
        errorCode: "NOT_FOUND",
      };
    }
    console.error("[recordOrderContactAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

const PAYMENT_PROOFS_BUCKET = "payment-proofs";

function sanitizeProofFilename(originalName: string): string {
  return originalName.replace(/[^a-zA-Z0-9.\-]/g, "_");
}

export type MarkOrderPaidErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "MISSING_PROOF"
  | "FILE_TOO_LARGE"
  | "INVALID_FILE_TYPE"
  | "UPLOAD_FAILED"
  | "INVALID_STATUS"
  | "BALANCE_CHANGED"
  | "OVERPAYMENT"
  | "DUPLICATE_REFERENCE"
  | "RECORDING_IN_PROGRESS"
  | "MISSING_METHOD_LABEL"
  | "FUTURE_PAID_DATE"
  | "INTERNAL_ERROR";

export type MarkOrderPaidResult =
  | { success: true; data: { fullySettled: boolean } }
  | { success: false; error: string; errorCode: MarkOrderPaidErrorCode };

export async function markOrderPaidAction(
  formData: unknown,
): Promise<MarkOrderPaidResult> {
  const staff = await requireStaffAction("order:mark_paid");

  let uploadedKey: string | null = null;

  try {
    if (!(formData instanceof FormData)) {
      return {
        success: false,
        error: "Invalid input.",
        errorCode: "VALIDATION_ERROR",
      };
    }

    const parsed = markOrderPaidSchema.safeParse({
      orderId: formData.get("orderId"),
      method: formData.get("method"),
      externalReference: formData.get("externalReference"),
      amount: formData.get("amount"),
      paidAt: formData.get("paidAt"),
      expectedOutstanding: formData.get("expectedOutstanding"),
      notes: formData.get("notes") ?? undefined,
      acknowledged: formData.get("acknowledged") === "true",
      methodOtherLabel: formData.get("methodOtherLabel") ?? undefined,
    });

    if (!parsed.success) {
      if (
        parsed.error.issues.some((i) => i.message === "MISSING_METHOD_LABEL")
      ) {
        return {
          success: false,
          error: "Describe the payment method when recording an Other payment.",
          errorCode: "MISSING_METHOD_LABEL",
        };
      }
      if (parsed.error.issues.some((i) => i.message === "FUTURE_PAID_DATE")) {
        return {
          success: false,
          error: "The paid date cannot be in the future.",
          errorCode: "FUTURE_PAID_DATE",
        };
      }
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        errorCode: "VALIDATION_ERROR",
      };
    }

    const {
      orderId,
      method,
      externalReference,
      amount,
      paidAt,
      expectedOutstanding,
      notes,
      methodOtherLabel,
    } = parsed.data;

    let proofFilename: string = DEMO_PLACEHOLDER_DOCUMENT.filename;
    let proofMimeType: string = DEMO_PLACEHOLDER_DOCUMENT.mimeType;
    let storageKey: string = DEMO_PLACEHOLDER_DOCUMENT.key;

    const proofInput = formData.get("proof");
    if (isDemoMode() && proofInput instanceof File && proofInput.size > 0) {
      return {
        success: false,
        error: DEMO_UPLOAD_MESSAGE,
        errorCode: "UPLOAD_FAILED",
      };
    }

    if (!isDemoMode()) {
      const proof = formData.get("proof");
      if (!(proof instanceof File) || proof.size === 0) {
        return {
          success: false,
          error: "A proof of payment document is required.",
          errorCode: "MISSING_PROOF",
        };
      }

      if (proof.size > MAX_FILE_SIZE_BYTES) {
        return {
          success: false,
          error: "The proof file exceeds the 5 MB size limit.",
          errorCode: "FILE_TOO_LARGE",
        };
      }

      const detectedMime = await detectMimeType(proof);
      if (detectedMime === null || detectedMime !== proof.type) {
        return {
          success: false,
          error: "The proof file type is unsupported. Allowed: JPEG, PNG, PDF.",
          errorCode: "INVALID_FILE_TYPE",
        };
      }

      const recordedAt = new Date();
      const filename = sanitizeProofFilename(proof.name);
      const path = `payment-proofs/${orderId}/${recordedAt.getTime()}/${filename}`;

      try {
        const uploaded = await uploadFile({
          bucket: PAYMENT_PROOFS_BUCKET,
          path,
          file: proof,
          contentType: detectedMime,
        });
        uploadedKey = uploaded.storageKey;
      } catch (err) {
        console.error("[markOrderPaidAction] upload failed", err);
        return {
          success: false,
          error: "Failed to upload the proof document. Please try again.",
          errorCode: "UPLOAD_FAILED",
        };
      }
      proofFilename = proof.name;
      proofMimeType = detectedMime;
      storageKey = uploadedKey;
    }

    const fullySettled = await db.$transaction(
      async (tx) => {
        const current = await tx.order.findUnique({
          where: { id: orderId },
          select: {
            status: true,
            total: true,
            orderNumber: true,
            customer: { select: { email: true, name: true } },
          },
        });

        if (!current) throw new Error("NOT_FOUND");

        if (current.status !== "AWAITING_MANUAL_PAYMENT") {
          throw new Error("INVALID_STATUS");
        }

        const existing = await tx.orderPayment.findMany({
          where: { orderId },
          select: { amount: true, externalReference: true },
        });

        if (
          existing.some(
            (p) =>
              p.externalReference.toLowerCase() ===
              externalReference.toLowerCase(),
          )
        ) {
          throw new Error("DUPLICATE_REFERENCE");
        }

        const settledSoFar = sumMoney(existing.map((p) => Number(p.amount)));
        const orderTotal = roundMoney(Number(current.total));
        const outstanding = roundMoney(orderTotal - settledSoFar);

        if (outstanding !== roundMoney(expectedOutstanding)) {
          throw new Error("BALANCE_CHANGED");
        }

        if (roundMoney(amount) > outstanding) {
          throw new Error("OVERPAYMENT");
        }

        await tx.orderPayment.create({
          data: {
            orderId,
            method,
            methodOtherLabel: methodOtherLabel ?? null,
            externalReference,
            amount: new Prisma.Decimal(roundMoney(amount).toFixed(2)),
            paidAt,
            recordedById: staff.id,
            notes: notes?.trim() || null,
            filename: proofFilename,
            storageKey,
            mimeType: proofMimeType,
          },
        });

        const remaining = roundMoney(outstanding - roundMoney(amount));
        const settledInFull = remaining === 0;

        if (settledInFull) {
          await tx.order.update({
            where: { id: orderId },
            data: { status: "PAID", paidAt },
          });
        }

        await tx.orderEvent.create({
          data: {
            orderId,
            actor: "STAFF",
            staffId: staff.id,
            fromStatus: settledInFull ? current.status : null,
            toStatus: settledInFull ? "PAID" : current.status,
            note: null,
            trackingNumber: null,
            trackingUrl: null,
            rawPayload: {
              source: "mark_paid",
              method,
              methodOtherLabel: methodOtherLabel ?? null,
              externalReference,
              amount: roundMoney(amount),
              remaining,
            } as unknown as Prisma.InputJsonValue,
          },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staff.id,
            action: "order.marked_paid",
            entityType: "Order",
            entityId: orderId,
            metadata: {
              method,
              methodOtherLabel: methodOtherLabel ?? null,
              externalReference,
              amount: roundMoney(amount),
              paidAt: dubaiDay(paidAt),
              orderTotal,
              settledAfter: roundMoney(settledSoFar + roundMoney(amount)),
              remaining,
              fullySettled: settledInFull,
              storageKey,
            } as unknown as Prisma.InputJsonValue,
          },
        });

        return {
          settledInFull,
          orderNumber: current.orderNumber,
          customerEmail: current.customer.email,
          customerName: current.customer.name,
          recordedAmount: roundMoney(amount),
          remaining,
        };
      },
      { isolationLevel: "Serializable" },
    );

    const methodLabel =
      method === "OTHER" && methodOtherLabel
        ? methodOtherLabel
        : paymentMethodLabel(method);

    after(async () => {
      const data = await loadOrderEmailData(orderId);
      if (!data) return;
      await logAndSendEmail({
        templateKey: "order_payment_recorded",
        toEmail: data.customerEmail,
        orderId,
        payload: { orderNumber: data.orderNumber },
        chromeOptions: customerOrderChrome(data, {
          badge: fullySettled.settledInFull
            ? { text: ORDER_STATUS_LABELS.PAID, tone: "success" }
            : { text: "Partially Paid", tone: "warning" },
          infoRows: [
            { label: "Order", value: data.orderNumber },
            { label: "Amount received", value: formatAED(fullySettled.recordedAmount) },
            { label: "Method", value: methodLabel },
            { label: "Reference", value: externalReference },
            { label: "Paid on", value: emailDate(paidAt) },
            { label: "Order total", value: formatAED(data.total) },
            { label: "Paid to date", value: formatAED(data.paidToDate) },
            ...(fullySettled.settledInFull
              ? []
              : [{ label: "Balance due", value: formatAED(fullySettled.remaining) }]),
          ],
        }),
      });
    });

    return { success: true, data: { fullySettled: fullySettled.settledInFull } };
  } catch (err) {
    if (uploadedKey !== null) {
      try {
        await deleteFile(PAYMENT_PROOFS_BUCKET, uploadedKey);
      } catch (cleanupErr) {
        console.error(
          "[markOrderPaidAction] rollback cleanup failed",
          cleanupErr,
        );
      }
    }

    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return {
        success: false,
        error:
          "A payment with this reference is already recorded on this order.",
        errorCode: "DUPLICATE_REFERENCE",
      };
    }

    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2034"
    ) {
      return {
        success: false,
        error:
          "Another payment is being recorded against this order. Reload and check the settlement history before recording again.",
        errorCode: "RECORDING_IN_PROGRESS",
      };
    }

    if (err instanceof Error) {
      switch (err.message) {
        case "NOT_FOUND":
          return {
            success: false,
            error: "Order not found.",
            errorCode: "NOT_FOUND",
          };
        case "INVALID_STATUS":
          return {
            success: false,
            error: "This order is not awaiting an offline payment.",
            errorCode: "INVALID_STATUS",
          };
        case "DUPLICATE_REFERENCE":
          return {
            success: false,
            error:
              "A payment with this reference is already recorded on this order.",
            errorCode: "DUPLICATE_REFERENCE",
          };
        case "BALANCE_CHANGED":
          return {
            success: false,
            error: "The outstanding balance changed. Reload and try again.",
            errorCode: "BALANCE_CHANGED",
          };
        case "OVERPAYMENT":
          return {
            success: false,
            error: "The amount exceeds the outstanding balance.",
            errorCode: "OVERPAYMENT",
          };
      }
    }

    console.error("[markOrderPaidAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

// ─── requestOrderContactAction ────────────────────────────────────────────────

export type RequestOrderContactErrorCode =
  | "UNAUTHENTICATED"
  | "VALIDATION_ERROR"
  | "NOT_OWNER"
  | "NOT_ELIGIBLE"
  | "ALREADY_OPEN"
  | "INTERNAL_ERROR";

export type RequestOrderContactResult =
  | { success: true; data: { ticketNumber: string } }
  | {
      success: false;
      error: string;
      errorCode: RequestOrderContactErrorCode;
      existingTicketNumber?: string;
    };

class OrderContactAlreadyOpenError extends Error {
  readonly existingTicketNumber: string;
  constructor(existingTicketNumber: string) {
    super("ALREADY_OPEN");
    this.name = "OrderContactAlreadyOpenError";
    this.existingTicketNumber = existingTicketNumber;
  }
}

export async function requestOrderContactAction(
  input: unknown,
): Promise<RequestOrderContactResult> {
  try {
    const customerId = await getSessionCustomerId();
    if (!customerId) {
      return {
        success: false,
        error: "You must be signed in to request contact about an order.",
        errorCode: "UNAUTHENTICATED",
      };
    }

    const parsed = requestOrderContactSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        errorCode: "VALIDATION_ERROR",
      };
    }

    const { orderId, message } = parsed.data;

    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        customerId: true,
        status: true,
        orderNumber: true,
        customer: { select: { email: true } },
      },
    });

    if (!order || order.customerId !== customerId) {
      return {
        success: false,
        error: "Order not found.",
        errorCode: "NOT_OWNER",
      };
    }

    const isQuoteQuestion = order.status === "AWAITING_QUOTE_APPROVAL";

    if (order.status !== "AWAITING_MANUAL_PAYMENT" && !isQuoteQuestion) {
      return {
        success: false,
        error: "Contact requests aren't available for this order anymore.",
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
              orderId,
              createdByCustomerId: customerId,
              status: { in: ["OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER"] },
            },
            select: { ticketNumber: true },
          });
          if (openRequest) {
            throw new OrderContactAlreadyOpenError(openRequest.ticketNumber);
          }

          const ticketNumber = await nextTicketNumber(tx, now);
          const created = await tx.ticket.create({
            data: {
              ticketNumber,
              subject: isQuoteQuestion
                ? `Order ${order.orderNumber} — shipping quote question`
                : `Order ${order.orderNumber} — contact request`,
              description: message.trim(),
              category: isQuoteQuestion ? "SHIPPING" : "PAYMENT",
              priority: "NORMAL",
              status: "OPEN",
              orderId,
              customerId,
              contactEmail: order.customer.email,
              createdByCustomerId: customerId,
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
      if (err instanceof OrderContactAlreadyOpenError) {
        return {
          success: false,
          error: "You already have an open request about this order.",
          errorCode: "ALREADY_OPEN",
          existingTicketNumber: err.existingTicketNumber,
        };
      }
      throw err;
    }

    revalidatePath("/admin/tickets");
    revalidatePath("/[locale]/account/orders/[id]", "page");

    after(async () => {
      const { support: supportRecipients } = await getSetting("email_recipients");
      const data = await loadTicketEmailData(ticketId);
      if (!data) return;
      await logAndSendEmail({
        templateKey: "ticket.created_customer",
        toEmail: order.customer.email,
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
            subject: isQuoteQuestion
              ? `shipping quote question for order ${order.orderNumber}`
              : `contact request for order ${order.orderNumber}`,
            detail: isQuoteQuestion
              ? "Customer has a question about the shipping quote."
              : "Customer requested contact about this order.",
          },
          chromeOptions: staffTicketChrome(data, {
            excerpt: { label: "Message", text: excerpt(data.description) },
          }),
        });
      }
    });

    return { success: true, data: { ticketNumber } };
  } catch (err) {
    console.error("[requestOrderContactAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export type ConfirmOrderDeliveryErrorCode =
  | "UNAUTHENTICATED"
  | "VALIDATION_ERROR"
  | "NOT_OWNER"
  | "INVALID_STATUS"
  | "INTERNAL_ERROR";

export type ConfirmOrderDeliveryResult =
  | { success: true }
  | {
      success: false;
      error: string;
      errorCode: ConfirmOrderDeliveryErrorCode;
    };

export async function confirmOrderDeliveryAction(
  input: unknown,
): Promise<ConfirmOrderDeliveryResult> {
  try {
    const session = await auth();
    const customerId = await getSessionCustomerId();
    if (!customerId || session?.user?.principal !== "customer") {
      return {
        success: false,
        error: "You must be signed in to confirm delivery.",
        errorCode: "UNAUTHENTICATED",
      };
    }

    const parsed = confirmOrderDeliverySchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        errorCode: "VALIDATION_ERROR",
      };
    }

    const { orderId } = parsed.data;

    await db.$transaction(
      async (tx) => {
        const current = await tx.order.findFirst({
          where: { id: orderId, customerId },
          select: { status: true },
        });
        if (!current) throw new Error("NOT_OWNER");
        if (current.status !== "SHIPPED") throw new Error("INVALID_STATUS");

        await tx.order.update({
          where: { id: orderId },
          data: { status: "DELIVERED", deliveredAt: new Date() },
        });

        await tx.orderEvent.create({
          data: {
            orderId,
            actor: "CUSTOMER",
            staffId: null,
            fromStatus: "SHIPPED",
            toStatus: "DELIVERED",
            note: null,
            trackingNumber: null,
            trackingUrl: null,
          },
        });

        await tx.auditLog.create({
          data: {
            actorType: "CUSTOMER",
            actorId: customerId,
            action: "order.status_changed",
            entityType: "Order",
            entityId: orderId,
            metadata: {
              fromStatus: "SHIPPED",
              toStatus: "DELIVERED",
              path: ["DELIVERED"],
              note: null,
              trackingNumber: null,
              trackingUrl: null,
            } as unknown as Prisma.InputJsonValue,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    await runOrderDeliveredEffects(orderId);

    revalidatePath("/[locale]/account/orders/[id]", "page");
    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orderId}`);

    return { success: true };
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_OWNER") {
        return {
          success: false,
          error: "Order not found.",
          errorCode: "NOT_OWNER",
        };
      }
      if (err.message === "INVALID_STATUS") {
        return {
          success: false,
          error: "This order is no longer awaiting delivery confirmation.",
          errorCode: "INVALID_STATUS",
        };
      }
    }
    console.error("[confirmOrderDeliveryAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}
