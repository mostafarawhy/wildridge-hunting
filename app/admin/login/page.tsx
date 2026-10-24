import { BRAND } from "@/lib/config/brand";
import StaffLoginForm from "./StaffLoginForm";

function noticeMessage(notice: string | undefined): string | null {
  switch (notice) {
    case "password-changed":
      return "Your password was changed and you've been signed out everywhere. Sign in with your new password.";
    case "password-set":
      return "Your password is set. Sign in with your new password.";
    case "signed-out-everywhere":
      return "You've been signed out on every device.";
    default:
      return null;
  }
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string | string[] }>;
}) {
  const { notice } = await searchParams;
  const message = noticeMessage(typeof notice === "string" ? notice : undefined);

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        backgroundColor: "var(--color-auth-form-bg)",
        padding: "3rem 1.5rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          backgroundColor: "var(--color-auth-input-bg)",
          border: "1px solid var(--color-auth-form-border)",
          padding: "2.5rem",
          boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
        }}
      >
        <p
          style={{
            fontSize: "var(--text-body-sm)",
            fontWeight: "var(--font-black)",
            letterSpacing: "var(--tracking-widest)",
            textTransform: "uppercase",
            color: "var(--color-auth-label-text)",
            marginBottom: "2rem",
            textAlign: "center",
          }}
        >
          {BRAND.name}
        </p>

        <h1
          style={{
            fontSize: "var(--text-heading)",
            fontWeight: "var(--font-bold)",
            letterSpacing: "var(--tracking-tight)",
            color: "var(--color-auth-label-text)",
            marginBottom: "0.25rem",
          }}
        >
          Staff Portal
        </h1>
        <p
          style={{
            fontSize: "var(--text-body-sm)",
            color: "var(--color-auth-input-placeholder)",
            marginBottom: "2rem",
          }}
        >
          Sign in to your account
        </p>

        {message && (
          <p
            role="status"
            style={{
              borderInlineStart: "3px solid var(--color-auth-divider)",
              paddingInlineStart: "0.75rem",
              fontSize: "var(--text-body-sm)",
              color: "var(--color-auth-label-text)",
              marginBottom: "1.5rem",
            }}
          >
            {message}
          </p>
        )}

        <StaffLoginForm />
      </div>
    </div>
  );
}
