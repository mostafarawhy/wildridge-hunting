import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getOrderForConfirmation } from "@/lib/db/queries/order";
import { getStoreIdentity } from "@/lib/utils/store-identity";
import ReceiptDocument from "@/components/checkout/ReceiptDocument";
import ReceiptToolbar from "@/components/checkout/ReceiptToolbar";

interface Props {
  params: Promise<{ locale: "en" | "ar" | "ru"; orderId: string }>;
  searchParams: Promise<{ print?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, orderId } = await params;
  const session = await auth();
  const t = await getTranslations({ locale, namespace: "checkout.receipt" });
  const store = await getStoreIdentity();
  const order =
    session?.user?.principal === "customer"
      ? await getOrderForConfirmation(orderId, session.user.id, locale)
      : null;
  return {
    title: {
      absolute: t("docTitle", {
        title: store.taxInvoice ? t("taxInvoice") : t("title"),
        orderNumber: order?.orderNumber ?? "",
      }),
    },
    robots: { index: false, follow: false },
  };
}

export default async function ReceiptPage({ params, searchParams }: Props) {
  const { locale, orderId } = await params;
  const { print } = await searchParams;

  const session = await auth();
  if (session?.user?.principal !== "customer") {
    redirect(`/${locale}/auth/login`);
  }

  const order = await getOrderForConfirmation(orderId, session.user.id, locale);
  if (!order) {
    notFound();
  }

  const paid = order.paidAt !== null || order.settlements.length > 0;
  if (!paid) {
    redirect(`/${locale}/account/orders/${order.id}`);
  }

  const store = await getStoreIdentity();

  return (
    <>
      <style>{`@page { size: A4; margin: 0 } @media print { html, body { background: #ffffff !important; } }`}</style>
      <div className="min-h-dvh bg-[var(--color-shop-bg)] text-[#0b0b0b] print:bg-white">
        <ReceiptToolbar orderId={order.id} autoPrint={print === "1"} />
        <ReceiptDocument order={order} store={store} locale={locale} />
      </div>
    </>
  );
}
