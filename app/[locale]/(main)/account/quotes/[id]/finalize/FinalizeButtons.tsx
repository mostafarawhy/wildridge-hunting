"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import { finalizeAcceptedQuoteAction } from "@/lib/actions/quote";
import { formatAED } from "@/lib/utils/currency";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";

interface Props {
  quoteId: string;
  totalAed: number;
  locale: "en" | "ar" | "ru";
  restricted: boolean;
  verificationApproved: boolean;
}

export default function FinalizeButtons({
  quoteId,
  totalAed,
  locale,
  restricted,
  verificationApproved,
}: Props) {
  const t = useTranslations("account.quotes.finalize");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [manualConfirmOpen, setManualConfirmOpen] = useState(false);

  const canFinalize = !isPending && (!restricted || verificationApproved);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await finalizeAcceptedQuoteAction({ quoteId }, locale);
      if (result.success) {
        startNavigationProgress();
        router.push(result.data.redirectUrl);
      } else {
        setError(t(`errors.${result.errorCode}`));
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <Button
          type="button"
          variant="primary"
          size="lg"
          fullWidth
          disabled={!canFinalize}
          loading={isPending}
          onClick={() => setManualConfirmOpen(true)}
        >
          {t("arrangePaymentCta")}
        </Button>
        <p
          style={{
            fontSize: "var(--text-body-sm)",
            color: "var(--color-content-tertiary)",
            margin: 0,
          }}
        >
          {t("arrangePaymentNote")}
        </p>
      </div>

      {restricted && !verificationApproved && (
        <p
          style={{
            fontSize: "var(--text-body-sm)",
            color: "var(--color-auth-error-text)",
            margin: 0,
          }}
        >
          {t("verifyFirstNote")}
        </p>
      )}

      {error && (
        <p
          role="alert"
          style={{
            fontSize: "var(--text-body-sm)",
            color: "var(--color-auth-error-text)",
            margin: 0,
          }}
        >
          {error}
        </p>
      )}

      <ConfirmDialog
        open={manualConfirmOpen}
        onClose={() => setManualConfirmOpen(false)}
        onConfirm={() => {
          setManualConfirmOpen(false);
          handleClick();
        }}
        title={t("arrangePaymentConfirmTitle")}
        message={t("arrangePaymentConfirmBody", {
          total: formatAED(totalAed, locale),
        })}
        confirmLabel={t("arrangePaymentCta")}
        cancelLabel={t("cancel")}
        isPending={isPending}
        destructive={false}
      />
    </div>
  );
}
