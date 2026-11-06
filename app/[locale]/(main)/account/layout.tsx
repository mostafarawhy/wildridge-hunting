import { redirect } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { getAccountNavData } from "@/lib/db/queries/account";
import AccountSidebar from "@/components/account/AccountSidebar";
import ExtraMessages from "@/components/layout/ExtraMessages";
import type { Metadata } from "next";
import { getMessages, getTranslations } from "next-intl/server";
import { ACCOUNT_MESSAGE_PATHS, pickMessages } from "@/lib/client-messages";

export const dynamic = "force-dynamic";

interface Props {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account.nav" });
  return { title: t("title") };
}

export default async function AccountLayout({ children, params }: Props) {
  const { locale } = await params;
  const safeLocale = locale as "en" | "ar" | "ru";
  const session = await auth();

  if (!session?.user?.id || session.user.principal !== "customer") {
    return redirect({ href: "/auth/login", locale: safeLocale });
  }

  const nav = await getAccountNavData(session.user.id);

  if (!nav) {
    return redirect({ href: "/auth/login", locale: safeLocale });
  }

  return (
    <ExtraMessages
      messages={pickMessages(await getMessages(), ACCOUNT_MESSAGE_PATHS)}
    >
      <div
        style={{ backgroundColor: "var(--color-shop-bg)" }}
        className="min-h-full"
      >
        <div className="max-w-6xl mx-auto px-4 lg:px-6 py-8">
          <div className="flex flex-col lg:flex-row lg:gap-6 lg:items-start">
            <AccountSidebar
              hasB2BAccount={nav.hasB2BAccount}
              userName={session.user.name ?? ""}
              userEmail={session.user.email ?? ""}
              badges={{
                "/account/b2b": nav.openB2BRequestCount,
                "/account/verification": nav.verificationActionCount,
                "/account/quotes": nav.quotesAwaitingResponseCount,
                "/account/support": nav.supportWaitingCount,
              }}
            />
            <div className="flex-1 min-w-0">{children}</div>
          </div>
        </div>
      </div>
    </ExtraMessages>
  );
}
