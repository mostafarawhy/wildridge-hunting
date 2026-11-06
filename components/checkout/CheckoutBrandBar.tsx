import { BRAND } from "@/lib/config/brand";
import { useTranslations } from "next-intl";
import BrandMark from "@/components/ui/BrandMark";
import { Link } from "@/i18n/navigation";

export default function CheckoutBrandBar() {
  const tNav = useTranslations("nav");
  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 sm:px-8 pt-6 pb-4 lg:hidden">
      <Link
        href="/"
        className="inline-flex items-center gap-4 group"
        aria-label={tNav("aria_home")}
      >
        <BrandMark size={56} />
        <span
          dir="ltr"
          className="brand-wordmark brand-wordmark--checkout text-[var(--primitive-black)]"
        >
          {BRAND.wordmark}
        </span>
      </Link>
    </div>
  );
}
