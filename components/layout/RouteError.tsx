"use client";

import { startTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import Button from "@/components/ui/Button";
import PageStatus, { statusLinkStyle } from "@/components/layout/PageStatus";

interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  standalone?: boolean;
}

export default function RouteError({
  error,
  reset,
  standalone = false,
}: RouteErrorProps) {
  const t = useTranslations("errorPage.error");
  const router = useRouter();

  const retry = () => {
    startTransition(() => {
      router.refresh();
      reset();
    });
  };

  return (
    <PageStatus
      standalone={standalone}
      eyebrow={t("eyebrow")}
      title={t("title")}
      body={t("body")}
      action={
        <Button type="button" variant="primary" size="lg" fullWidth onClick={retry}>
          {t("retry")}
        </Button>
      }
      secondary={
        <Link href="/" style={statusLinkStyle}>
          {t("home")}
        </Link>
      }
      footnote={
        error.digest
          ? t.rich("reference", {
              digest: error.digest,
              ref: (chunks) => (
                <bdi
                  dir="ltr"
                  style={{
                    fontFamily: "var(--font-geist-mono)",
                    color: "var(--color-auth-label-text)",
                  }}
                >
                  {chunks}
                </bdi>
              ),
            })
          : undefined
      }
    />
  );
}
