import { redirect } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { getQuoteFinalizeProjection } from "@/lib/db/queries/quote";
import { LocaleButtonLink } from "@/components/ui/ButtonLink";
import QuoteFinalizeClient from "./QuoteFinalizeClient";

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export default async function QuoteFinalizePage({ params }: Props) {
  const { locale, id } = await params;
  const safeLocale = locale as "en" | "ar" | "ru";

  const session = await auth();
  if (!session?.user?.id || session.user.principal !== "customer") {
    return redirect({ href: "/auth/login", locale: safeLocale });
  }

  const projection = await getQuoteFinalizeProjection(
    id,
    session.user.id,
    safeLocale,
  );
  if (!projection) notFound();

  if (projection.quote.status !== "ACCEPTED") {
    return redirect({ href: `/account/quotes/${id}`, locale: safeLocale });
  }

  if (projection.quote.convertedOrderId !== null) {
    return redirect({
      href: `/account/orders/${projection.quote.convertedOrderId}`,
      locale: safeLocale,
    });
  }

  if (projection.b2bStatus !== "APPROVED") {
    const t = await getTranslations("account.quotes.finalize");
    return (
      <div
        style={{
          backgroundColor: "#ffffff",
          border: "1px solid var(--color-auth-form-border)",
          padding: "2rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          alignItems: "flex-start",
        }}
      >
        <h1
          style={{
            fontSize: "var(--text-heading)",
            fontWeight: "var(--font-bold)",
            color: "var(--color-action-primary)",
            margin: 0,
          }}
        >
          {t("expiredTitle")}
        </h1>
        <p
          style={{
            fontSize: "var(--text-body)",
            color: "var(--color-content-tertiary)",
            lineHeight: "var(--leading-relaxed)",
          }}
        >
          {t("expiredBody")}
        </p>
        <LocaleButtonLink href="/account/b2b" variant="primary" size="md">
          {t("expiredCta")}
        </LocaleButtonLink>
      </div>
    );
  }

  const { shippingCostAed } = projection;
  if (shippingCostAed === null || projection.shippingAddress === null) {
    const t = await getTranslations("account.quotes.finalize");
    return (
      <div
        style={{
          backgroundColor: "#ffffff",
          border: "1px solid var(--color-auth-form-border)",
          padding: "2rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          alignItems: "flex-start",
        }}
      >
        <h1
          style={{
            fontSize: "var(--text-heading)",
            fontWeight: "var(--font-bold)",
            color: "var(--color-action-primary)",
            margin: 0,
          }}
        >
          {t("shippingPendingTitle")}
        </h1>
        <p
          style={{
            fontSize: "var(--text-body)",
            color: "var(--color-content-tertiary)",
            lineHeight: "var(--leading-relaxed)",
          }}
        >
          {t("errors.QUOTE_MISSING_SHIPPING")}
        </p>
        <LocaleButtonLink
          href={`/account/quotes/${id}`}
          variant="primary"
          size="md"
        >
          {t("shippingPendingCta")}
        </LocaleButtonLink>
      </div>
    );
  }

  return (
    <QuoteFinalizeClient
      projection={{ ...projection, shippingCostAed }}
      locale={safeLocale}
    />
  );
}
