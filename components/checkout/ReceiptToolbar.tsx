"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

interface Props {
  orderId: string;
  autoPrint: boolean;
}

export default function ReceiptToolbar({ orderId, autoPrint }: Props) {
  const t = useTranslations("checkout.receipt");
  const printed = useRef(false);

  useEffect(() => {
    if (!autoPrint || printed.current) return;
    printed.current = true;
    const images = Array.from(document.images).map((img) =>
      img.complete
        ? img.decode().catch(() => undefined)
        : new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          }),
    );
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 4000));
    Promise.race([Promise.all([document.fonts.ready, ...images]), timeout]).then(
      () => window.print(),
    );
  }, [autoPrint]);

  return (
    <div className="print:hidden max-w-[210mm] mx-auto px-4 sm:px-0 pt-6 flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <Link
          href={`/account/orders/${orderId}`}
          className="text-[0.8125rem] underline underline-offset-[3px] text-neutral-900"
        >
          {t("back")}
        </Link>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => window.print()}
            className="text-[0.8125rem] underline underline-offset-[3px] text-neutral-900"
          >
            {t("print")}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="hidden sm:inline-block h-11 px-6 bg-[var(--color-action-primary)] hover:bg-[var(--color-action-primary-hover)] text-white text-[0.75rem] font-bold tracking-[0.2em] uppercase rtl:tracking-normal rtl:normal-case rtl:text-[0.875rem] transition-colors"
          >
            {t("save")}
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={() => window.print()}
        className="sm:hidden w-full h-11 bg-[var(--color-action-primary)] hover:bg-[var(--color-action-primary-hover)] text-white text-[0.75rem] font-bold tracking-[0.2em] uppercase rtl:tracking-normal rtl:normal-case rtl:text-[0.875rem] transition-colors"
      >
        {t("save")}
      </button>
      <p className="text-[0.75rem] text-neutral-600 text-center sm:text-end">
        {t("saveHint")}
      </p>
    </div>
  );
}
