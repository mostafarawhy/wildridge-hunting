import { BRAND } from "@/lib/config/brand";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth-staff";
import { getStaffById } from "@/lib/db/queries/staff";
import SetPasswordForm from "./SetPasswordForm";

export default async function SetPasswordPage() {
  const { id } = await requireStaff();
  const staff = await getStaffById(id);
  if (!staff) redirect("/admin/login");
  if (!staff.mustChangePassword) redirect("/admin/account");

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
          Set Your Password
        </h1>
        <p
          style={{
            fontSize: "var(--text-body-sm)",
            color: "var(--color-auth-input-placeholder)",
            marginBottom: "2rem",
          }}
        >
          Choose a new password to finish setting up your account.
        </p>

        <SetPasswordForm />
      </div>
    </div>
  );
}
