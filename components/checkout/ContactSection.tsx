"use client";

import { useTranslations } from "next-intl";
import { Checkbox, SectionHeading } from "./FormPrimitives";
import { useCheckoutForm } from "@/app/[locale]/checkout/CheckoutFormContext";

interface ContactSectionProps {
  email: string;
}

export default function ContactSection({ email }: ContactSectionProps) {
  const t = useTranslations("checkout.contact");
  const { marketingOptIn, setMarketingOptIn } = useCheckoutForm();

  return (
    <section className="mb-12">
      <SectionHeading title={t("title")} />

      <div className="flex flex-col gap-4">
        <p className="text-[0.875rem] text-neutral-700">
          {t.rich("signedInAs", {
            email: () => <span dir="ltr">{email}</span>,
          })}
        </p>

        <div className="mt-2">
          <Checkbox
            checked={marketingOptIn}
            onChange={setMarketingOptIn}
            label={t("optInLabel")}
            hint={t("optional")}
          />
        </div>
      </div>
    </section>
  );
}
