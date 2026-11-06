import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { getCheckoutProjection } from "@/lib/db/queries/checkout";
import { getBestAvailableReward } from "@/lib/db/queries/coupon";
import { getEffectiveCouponRole } from "@/lib/utils/shop-mode";
import CheckoutLayout from "./CheckoutLayout";
import CheckoutSkeleton from "@/components/loading/CheckoutSkeleton";

interface Props {
  params: Promise<{ locale: "en" | "ar" | "ru" }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "checkout" });
  return { title: t("title") };
}

export default function CheckoutPage({ params }: Props) {
  return (
    <Suspense fallback={<CheckoutSkeleton />}>
      <CheckoutContent params={params} />
    </Suspense>
  );
}

async function CheckoutContent({ params }: Props) {
  const { locale } = await params;

  const session = await auth();
if (session?.user?.principal !== "customer") {
    redirect(`/${locale}/auth/login?callbackUrl=/${locale}/checkout`);
  }

  const result = await getCheckoutProjection(session.user.id, locale);

  if (!result.ok) {
    if (result.reason === "EMPTY_CART") redirect(`/${locale}/shop`);
    if (result.reason === "NO_CUSTOMER")
      redirect(`/${locale}/auth/login?callbackUrl=/${locale}/checkout`);
    redirect(`/${locale}/shop`);
  }

  const goodsTotal = result.data.cart.totals.subtotalAed;
  const effectiveRole = await getEffectiveCouponRole(session.user.id);
  const availableReward = await getBestAvailableReward(
    session.user.id,
    effectiveRole,
    goodsTotal,
  );

  return (
    <CheckoutLayout
      projection={result.data}
      locale={locale}
      availableReward={availableReward}
    />
  );
}
