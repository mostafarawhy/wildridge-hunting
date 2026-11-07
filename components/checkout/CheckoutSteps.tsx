import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

interface Props {
  current: "details" | "payment";
}

const EYEBROW =
  "text-[0.6875rem] font-bold tracking-[0.16em] uppercase rtl:tracking-normal rtl:normal-case rtl:text-[0.8125rem]";

const STEPS = ["cart", "details", "payment"] as const;

export default function CheckoutSteps({ current }: Props) {
  const t = useTranslations("checkout");
  const currentIndex = STEPS.indexOf(current);

  return (
    <nav aria-label={t("steps.label")} className="mb-6">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {STEPS.map((step, index) => {
          const tone =
            index < currentIndex
              ? " text-[var(--color-action-primary)]"
              : index === currentIndex
                ? " text-neutral-900"
                : " text-neutral-400";
          const linked = step === "cart" && current === "details";
          return (
            <li key={step} className="flex items-center gap-2">
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className="h-1 w-1 rounded-full bg-neutral-300"
                />
              )}
              {linked ? (
                <Link
                  href={{ pathname: "/shop", query: { cart: "open" } }}
                  className={
                    EYEBROW + tone + " underline-offset-[3px] hover:underline"
                  }
                >
                  {t(`steps.${step}`)}
                </Link>
              ) : (
                <span
                  aria-current={index === currentIndex ? "step" : undefined}
                  className={EYEBROW + tone}
                >
                  {t(`steps.${step}`)}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
