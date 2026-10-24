import { redirect } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { getWishlist } from "@/lib/db/queries/wishlist";
import { WishlistManager } from "@/components/account/index";
import AccountHeaderRow from "@/components/account/AccountHeaderRow";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function WishlistPage({ params }: PageProps) {
  const { locale } = await params;

  const session = await auth();
if (session?.user?.principal !== "customer") {
    return redirect({ href: "/auth/login", locale });
  }
  const safeLocale = (["en", "ar", "ru"].includes(locale) ? locale : "en") as
    | "en"
    | "ar"
    | "ru";

  const t = await getTranslations("account.wishlist");

  const items = await getWishlist(session.user.id, safeLocale);

  return (
    <div className="flex flex-col gap-6">
      <AccountHeaderRow helpHref="/account/support?topic=PRODUCT">
        <h1
          style={{
            fontSize: "var(--text-heading)",
            fontWeight: "var(--font-bold)",
            color: "var(--color-action-primary)",
            letterSpacing: "var(--tracking-tight)",
            lineHeight: "var(--leading-tight)",
            margin: 0,
          }}
        >
          {t("title")}
        </h1>
        <p
          style={{
            fontSize: "var(--text-body)",
            color: "var(--color-content-tertiary)",
            marginTop: "0.25rem",
            marginBottom: 0,
          }}
        >
          {t("subtitle")}
        </p>
      </AccountHeaderRow>

      <WishlistManager items={items} locale={safeLocale} />
    </div>
  );
}
