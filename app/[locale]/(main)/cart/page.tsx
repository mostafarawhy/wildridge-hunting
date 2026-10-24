import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { getCart } from "@/lib/actions/cart";
import { CartItemRow, CartSummary } from "@/components/cart";
import { Link } from "@/i18n/navigation";

type Locale = "en" | "ar" | "ru";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "cart" });
  return { title: t("title") };
}

export default async function Page({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "cart" });
  const cart = await getCart(locale as Locale);

  if (!cart || cart.items.length === 0) {
    return (
      <div
        className="w-full min-h-[60vh]"
        style={{
          backgroundColor: "var(--color-auth-input-bg)",
          color: "var(--primitive-black)",
        }}
      >
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 text-center px-4">
          <h1
            className="text-display-sm font-bold"
            style={{ color: "var(--primitive-black)" }}
          >
            {t("empty")}
          </h1>
          <Link
            href="/shop"
            className="inline-flex items-center justify-center h-11 px-8 rounded-sm uppercase tracking-widest text-label font-semibold"
            style={{
              backgroundColor: "var(--color-action-primary)",
              color: "var(--color-action-primary-fg)",
            }}
          >
            {t("emptyCta")}
          </Link>
        </div>
      </div>
    );
  }

  const count = cart.items.length;
  const itemCountLabel = t("itemCount", { count });

  return (
    <div
      className="w-full min-h-[60vh]"
      style={{
        backgroundColor: "var(--color-auth-input-bg)",
        color: "var(--primitive-black)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-16">
          <div
            className="flex flex-col w-full max-w-[580px]"
            style={{ backgroundColor: "var(--color-auth-form-bg)" }}
          >
            <div
              className="flex items-baseline gap-3"
              style={{ padding: "1.25rem 1.5rem" }}
            >
              <h1
                className="text-display-sm font-bold"
                style={{ color: "var(--color-auth-label-text)" }}
              >
                {t("title")}
              </h1>
              <span
                className="text-body-sm"
                style={{ color: "var(--color-content-tertiary)" }}
              >
                {itemCountLabel}
              </span>
            </div>

            <ul className="flex flex-col">
              {cart.items.map((line) => (
                <CartItemRow key={line.id} line={line} locale={locale} />
              ))}
            </ul>
          </div>

          <div className="mt-12 lg:mt-0">
            <div className="lg:sticky lg:top-24">
              <CartSummary cart={cart} locale={locale} surface="page" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
