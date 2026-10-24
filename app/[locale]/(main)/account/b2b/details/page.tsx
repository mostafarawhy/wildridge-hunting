import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { getTranslations } from "next-intl/server";
import { getCustomerB2BStatus } from "@/lib/db/queries/customer";
import { getSetting } from "@/lib/db/queries/settings";
import { B2BUpdateDetailsForm } from "@/components/account";
import AccountHeaderRow from "@/components/account/AccountHeaderRow";

interface Props {
  params: Promise<{ locale: "en" | "ar" | "ru" }>;
}

export default async function B2BUpdateDetailsPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations("account.b2b.details");
  const session = await auth();

  if (session?.user?.principal !== "customer") {
    return redirect({ href: "/auth/login", locale });
  }

  const status = await getCustomerB2BStatus(session.user.id);

  if (!status) {
    return redirect({ href: "/b2b", locale });
  }

  if (status.openRequest === null || status.openRequest.scope !== "DETAILS") {
    return redirect({ href: "/account/b2b", locale });
  }

  const b2bContent = await getSetting("b2b_content");

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <AccountHeaderRow helpHref="/account/support?topic=BUSINESS">
        <h1
          style={{
            fontSize: "var(--text-heading)",
            fontWeight: "var(--font-bold)",
            color: "var(--color-action-primary)",
            letterSpacing: "var(--tracking-tight)",
            lineHeight: "var(--leading-tight)",
            margin: 0,
          }}
        >
          {t("pageTitle")}
        </h1>
        <p
          style={{
            fontSize: "var(--text-body)",
            color: "var(--color-content-tertiary)",
            marginTop: "0.25rem",
            marginBottom: 0,
          }}
        >
          {t("subtitle")}
        </p>
      </AccountHeaderRow>

      <B2BUpdateDetailsForm
        accountId={status.id}
        message={status.openRequest.message}
        locale={locale}
        b2bContent={b2bContent[locale]}
        initial={{
          companyNameEn: status.companyNameEn,
          companyNameAr: status.companyNameAr,
          tradeLicenseNo: status.tradeLicenseNo,
          vatNumber: status.vatNumber,
          contactName: status.contactName,
          contactPhone: status.contactPhone,
        }}
      />
    </div>
  );
}
