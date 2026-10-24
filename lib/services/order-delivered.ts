import "server-only";

import { after } from "next/server";
import { awardLoyaltyForOrder } from "@/lib/services/loyalty";
import { issueRewardCouponForOrder } from "@/lib/services/reward-coupon";
import { logAndSendEmail } from "@/lib/services/resend";
import { loadOrderEmailData, customerOrderChrome } from "@/lib/email/order-email";
import { ORDER_STATUS_LABELS } from "@/lib/utils/order-status";

export async function runOrderDeliveredEffects(orderId: string): Promise<void> {
  let pointsAwarded: number | null = null;

  const loyaltyResult = await awardLoyaltyForOrder(orderId);
  if (!loyaltyResult.success) {
    console.error(
      "[runOrderDeliveredEffects] loyalty award failed",
      orderId,
      loyaltyResult.error,
    );
  } else {
    pointsAwarded = loyaltyResult.data.pointsAwarded;
  }

  const rewardResult = await issueRewardCouponForOrder(orderId);
  if (!rewardResult.success) {
    console.error(
      "[runOrderDeliveredEffects] reward coupon issue failed",
      orderId,
      rewardResult.error,
    );
  }

  after(async () => {
    const data = await loadOrderEmailData(orderId);
    if (!data) return;
    await logAndSendEmail({
      templateKey: "order_delivered",
      toEmail: data.customerEmail,
      locale: "en",
      orderId,
      payload: { orderNumber: data.orderNumber, pointsAwarded },
      chromeOptions: customerOrderChrome(data, {
        badge: { text: ORDER_STATUS_LABELS.DELIVERED, tone: "success" },
        infoRows: [
          { label: "Order", value: data.orderNumber },
          ...(data.deliveredDate
            ? [{ label: "Delivered on", value: data.deliveredDate }]
            : []),
          ...(data.deliveryReceivedBy
            ? [{ label: "Received by", value: data.deliveryReceivedBy }]
            : []),
          ...(pointsAwarded && pointsAwarded > 0
            ? [{ label: "Loyalty points earned", value: `${pointsAwarded} points` }]
            : []),
        ],
        withSummary: true,
      }),
    });
  });
}
