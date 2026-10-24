import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { getTranslations } from "next-intl/server";
import { getCustomerVerificationStatus } from "@/lib/db/queries/verification";
import { getSetting } from "@/lib/db/queries/settings";
import UpdateVerificationDetailsForm from "@/components/verification/UpdateVerificationDetailsForm";
import AccountHeaderRow from "@/components/account/AccountHeaderRow";

interface Props {
  params: Promise<{ locale: "en" | "ar" | "ru" }>;
}

export default async function VerificationUpdateDetailsPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations("account.verification.details");
  const session = await auth();

  if (session?.user?.principal !== "customer") {
    return redirect({ href: "/auth/login", locale });
  }

  const status = await getCustomerVerificationStatus(session.user.id);

  if (
    !status ||
    status.openRequest === null ||
    status.openRequest.scope !== "DETAILS"
  ) {
    return redirect({ href: "/account/verification", locale });
  }

  const verificationContent = await getSetting("verification_content");

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <AccountHeaderRow helpHref="/account/support?topic=ACCOUNT">
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

      <UpdateVerificationDetailsForm
        message={status.openRequest.message}
        locale={locale}
        verificationContent={verificationContent[locale]}
        initial={{
          declaredIdNumber: status.latestEvent?.declaredIdNumber ?? null,
          declaredAddress: status.latestEvent?.declaredAddress ?? null,
        }}
      />
    </div>
  );
}
