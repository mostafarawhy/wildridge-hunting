"use client";

import { useTranslations } from "next-intl";
import { useQuoteStore } from "@/lib/stores/quote-store";
import Button from "@/components/ui/Button";

interface QuoteSummaryProps {
  onOpenSubmit: () => void;
}

export default function QuoteSummary({ onOpenSubmit }: QuoteSummaryProps) {
  const t = useTranslations("quote");
  const lines = useQuoteStore((s) => s.lines);
  const isEmpty = lines.length === 0;

  return (
    <div
      className="shrink-0 flex flex-col gap-4 px-6 py-5"
      style={{
        borderTop: "1px solid var(--color-auth-divider)",
        backgroundColor: "var(--color-auth-form-bg)",
      }}
    >
      <Button
        variant="primary"
        size="lg"
        fullWidth
        disabled={isEmpty}
        onClick={onOpenSubmit}
      >
        {t("submit")}
      </Button>
    </div>
  );
}
