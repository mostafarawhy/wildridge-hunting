import { redirect } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getOrderForConfirmation } from "@/lib/db/queries/order";
import { OrderDetail } from "@/components/account";

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export default async function AccountOrderDetailPage({ params }: Props) {
  const { locale, id } = await params;
  const safeLocale = locale as "en" | "ar" | "ru";

  const session = await auth();
 if (!session?.user?.id || session.user.principal !== "customer") {
    return redirect({ href: "/auth/login", locale: safeLocale });
  }

  const order = await getOrderForConfirmation(id, session.user.id, safeLocale);
  if (!order) notFound();

  return (
    <OrderDetail projection={order} locale={safeLocale} />
  );
}
