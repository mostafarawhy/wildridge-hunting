import { BRAND } from "@/lib/config/brand";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

interface ForgotPasswordPageProps {
  params: Promise<{ locale: string }>;
}

export default async function ForgotPasswordPage({
  params,
}: ForgotPasswordPageProps) {
  const { locale } = await params;

  const session = await auth();
  if (session?.user?.principal === "customer") {
    return redirect({
      href: "/account/settings",
      locale: locale as "en" | "ar" | "ru",
    });
  }

  return (
    <main
      style={{
        minHeight: "calc(100dvh - var(--spacing-header))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--color-auth-form-bg)",
        padding: "3rem 1.5rem",
      }}
    >
      <div style={{ width: "100%", maxWidth: "400px" }}>
        {/* Wordmark */}
        <p
          style={{
            fontSize: "var(--text-body-sm)",
            fontWeight: "var(--font-black)",
            letterSpacing: "var(--tracking-widest)",
            textTransform: "uppercase",
            color: "var(--color-auth-label-text)",
            marginBottom: "2.5rem",
            textAlign: "center",
          }}
        >
          {BRAND.name}
        </p>

        <ForgotPasswordForm />
      </div>
    </main>
  );
}
