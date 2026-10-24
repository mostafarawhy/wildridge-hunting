import { redirect } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getCustomerQuoteDetail } from "@/lib/db/queries/quote";
import { QuoteDetail } from "@/components/account";

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export default async function AccountQuoteDetailPage({ params }: Props) {
  const { locale, id } = await params;
  const safeLocale = locale as "en" | "ar" | "ru";

  const session = await auth();
 if (!session?.user?.id || session.user.principal !== "customer") {
    return redirect({ href: "/auth/login", locale: safeLocale });
  }

  const quote = await getCustomerQuoteDetail(id, session.user.id, safeLocale);
  if (!quote) notFound();

  return (
    <QuoteDetail projection={quote} locale={safeLocale} />
  );
}
