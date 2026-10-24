import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getOrderForConfirmation,
  type OrderStatus,
} from "@/lib/db/queries/order";
import { getStoreIdentity } from "@/lib/utils/store-identity";
import { verifyPaymentAction } from "@/lib/actions/orders";
import OrderConfirmation from "@/components/checkout/OrderConfirmation";

interface Props {
  params: Promise<{ locale: "en" | "ar" | "ru" }>;
  searchParams: Promise<{ orderId?: string }>;
}

export default async function CheckoutSuccessPage({
  params,
  searchParams,
}: Props) {
  const { locale } = await params;
  const { orderId } = await searchParams;

  const session = await auth();
if (session?.user?.principal !== "customer") {
    redirect(`/${locale}/auth/login`);
  }

  if (!orderId) {
    redirect(`/${locale}/shop`);
  }

  let order = await getOrderForConfirmation(orderId, session.user.id, locale);
  if (!order) {
    notFound();
  }

  if (order.status === "PAYMENT_PENDING" && order.paymentRef) {
    await verifyPaymentAction(orderId);
    order = await getOrderForConfirmation(orderId, session.user.id, locale);
    if (!order) {
      notFound();
    }
    if (order.status === "PAYMENT_PENDING") {
      redirect(`/${locale}/account/orders/${order.id}`);
    }
  }

  const confirmedStatuses: OrderStatus[] = [
    "PAID",
    "CONFIRMED",
    "PROCESSING",
    "READY_TO_SHIP",
    "SHIPPED",
    "DELIVERED",
  ];
  const variant =
    order.status === "PAYMENT_FAILED"
      ? "failed"
      : confirmedStatuses.includes(order.status)
        ? "confirmed"
        : null;
  if (variant === null) {
    redirect(`/${locale}/account/orders/${order.id}`);
  }

  return (
    <OrderConfirmation
      projection={order}
      locale={locale}
      variant={variant}
      store={await getStoreIdentity()}
    />
  );
}
