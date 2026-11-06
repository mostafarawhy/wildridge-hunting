import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { getOrderForConfirmation } from "@/lib/db/queries/order";
import { getPaymentProvider } from "@/lib/services/payment";
import MockPaymentForm from "@/components/checkout/MockPaymentForm";

interface Props {
  params: Promise<{ locale: "en" | "ar" | "ru" }>;
  searchParams: Promise<{ orderId?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "checkout.pay" });
  return { title: t("secureHeading") };
}

export default async function MockPaymentPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { orderId } = await searchParams;

  const session = await auth();
  if (session?.user?.principal !== "customer" || !session.user.id) {
    redirect(`/${locale}/auth/login`);
  }

  if (!orderId) {
    redirect(`/${locale}/shop`);
  }

  if (getPaymentProvider().name !== "mock") {
    notFound();
  }

  const order = await getOrderForConfirmation(orderId, session.user.id, locale);
  if (!order) {
    notFound();
  }

  if (!order.paymentRef || !order.paymentRef.startsWith("mock_")) {
    notFound();
  }

  if (order.status !== "PAYMENT_PENDING") {
    redirect(`/${locale}/account/orders/${order.id}`);
  }

  return <MockPaymentForm projection={order} locale={locale} />;
}
