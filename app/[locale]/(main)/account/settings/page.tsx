import { redirect } from "@/i18n/navigation";
import { isUaePassEnabled } from "@/lib/env.client";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import { getTranslations } from "next-intl/server";
import SettingsForm from "@/components/account/SettingsForm";
import UaePassLinkSection from "@/components/account/UaePassLinkSection";
import AccountHeaderRow from "@/components/account/AccountHeaderRow";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}

export default async function AccountSettingsPage({
  params,
  searchParams,
}: Props) {
  const { locale } = await params;
  const safeLocale = locale as "en" | "ar" | "ru";
  const { error, notice } = await searchParams;

  const session = await auth();
  if (!session?.user?.id || session.user.principal !== "customer") {
    return redirect({ href: "/auth/login", locale: safeLocale });
  }

  const [customer, t] = await Promise.all([
    db.customer.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        phone: true,
        email: true,
        locale: true,
        uaePassUuid: true,
      },
    }),
    getTranslations("account.settings"),
  ]);

  if (!customer) {
    return redirect({ href: "/auth/login", locale: safeLocale });
  }

  const tUae = await getTranslations("account.settings.uaePass");

  const uaePassEnabled = isUaePassEnabled();

  let errorMessage: string | null = null;
  if (uaePassEnabled && error) {
    if (error === "uae_pass_denied") errorMessage = tUae("errors.denied");
    else if (error === "uae_pass_uuid_taken")
      errorMessage = tUae("errors.uuidTaken");
    else if (error === "session_expired")
      errorMessage = tUae("errors.sessionExpired");
    else errorMessage = tUae("errors.generic");
  }

  let noticeMessage: string | null = null;
  if (uaePassEnabled && !error && notice === "uae_pass_linked") {
    noticeMessage = tUae("notices.linked");
  } else if (uaePassEnabled && !error && notice === "uae_pass_linked_verified") {
    noticeMessage = tUae("notices.linkedVerified");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
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
          {t("title")}
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

      {errorMessage && (
        <div
          role="alert"
          style={{
            backgroundColor: "var(--color-auth-error-bg)",
            border: "1px solid var(--color-auth-error-border)",
            color: "var(--color-auth-error-text)",
            padding: "0.75rem 1rem",
            fontSize: "var(--text-body-sm)",
          }}
        >
          {errorMessage}
        </div>
      )}

      {noticeMessage && (
        <div
          role="status"
          style={{
            backgroundColor: "var(--color-status-success-bg)",
            border: "1px solid var(--color-status-success-border)",
            color: "var(--color-status-success-text)",
            padding: "0.75rem 1rem",
            fontSize: "var(--text-body-sm)",
          }}
        >
          {noticeMessage}
        </div>
      )}

      <SettingsForm
        initialName={customer.name}
        initialPhone={customer.phone ?? ""}
        initialLocale={customer.locale as "en" | "ar" | "ru"}
        email={customer.email}
      />

      <UaePassLinkSection
        isLinked={customer.uaePassUuid !== null}
        locale={safeLocale}
      />
    </div>
  );
}
