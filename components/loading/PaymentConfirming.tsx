import { getTranslations } from "next-intl/server";
import Skeleton from "@/components/ui/Skeleton";

export default async function PaymentConfirming() {
  const t = await getTranslations("checkout.success");

  return (
    <div className="min-h-dvh bg-white">
      <div className="mx-auto max-w-[640px] px-6 sm:px-8 py-16 sm:py-24">
        <div className="mb-10" role="status">
          <span
            className="btn-spinner"
            aria-hidden="true"
            style={{
              display: "block",
              width: "2.5rem",
              height: "2.5rem",
              border: "2px solid var(--color-auth-divider)",
              borderTopColor: "var(--color-action-primary)",
              borderRadius: "50%",
              marginBottom: "1.5rem",
            }}
          />
          <h1 className="text-[1.75rem] sm:text-[2rem] font-bold leading-tight text-[var(--color-action-primary)] mb-3">
            {t("confirmingTitle")}
          </h1>
          <p className="text-[0.9375rem] text-neutral-600 leading-relaxed">
            {t("confirmingBody")}
          </p>
        </div>

        <div aria-hidden="true" aria-busy="true" className="border border-neutral-200 mb-8">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center"
            >
              <Skeleton.Text width="30%" />
              <Skeleton.Text width="25%" />
            </div>
          ))}

          <div className="px-6 py-5 flex flex-col gap-2">
            <Skeleton.Text width="70%" />
            <Skeleton.Text width="30%" />
          </div>
        </div>
      </div>
    </div>
  );
}
