"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LocaleButtonLink } from "@/components/ui/ButtonLink";
import PageStatus, { statusLinkStyle } from "@/components/layout/PageStatus";

export default function NotFound() {
  const t = useTranslations("errorPage.notFound");

  return (
    <PageStatus
      eyebrow={t("eyebrow")}
      title={t("title")}
      body={t("body")}
      action={
        <LocaleButtonLink href="/" variant="primary" size="lg">
          {t("home")}
        </LocaleButtonLink>
      }
      secondary={
        <Link href="/shop" style={statusLinkStyle}>
          {t("shop")}
        </Link>
      }
    />
  );
}
