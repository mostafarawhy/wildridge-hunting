import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth-staff";
import { getStaffById } from "@/lib/db/queries/staff";
import { AdminSidebar } from "@/components/admin";
import { ToastProvider } from "@/components/ui/Toast";
import { can } from "@/lib/utils/staff-permissions";
import { getPendingB2BReviewCount } from "@/lib/db/queries/b2b";
import { getPendingVerificationReviewCount } from "@/lib/db/queries/verification";

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { id, staffRole } = await requireStaff();
  const staff = await getStaffById(id);

  if (!staff) redirect("/admin/login");
  if (staff.mustChangePassword) redirect("/admin/set-password");

  const [b2bPending, verificationPending] = await Promise.all([
    can(staffRole, "b2b:read") ? getPendingB2BReviewCount() : Promise.resolve(0),
    can(staffRole, "verification:review")
      ? getPendingVerificationReviewCount()
      : Promise.resolve(0),
  ]);

  return (
    <div
      className="flex flex-col lg:flex-row"
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--color-shop-bg)",
      }}
    >
      <p
        role="note"
        className="lg:hidden"
        style={{
          margin: 0,
          padding: "0.5rem 1rem",
          fontSize: "var(--text-body-sm)",
          color: "#374151",
          backgroundColor: "#f3f4f6",
          borderBottom: "1px solid var(--color-shop-divider)",
        }}
      >
        The admin is designed for desktop. Everything works here, but a larger
        screen shows more at once.
      </p>
      <AdminSidebar
        staffRole={staffRole}
        name={staff.name}
        email={staff.email}
        navBadges={{
          "/admin/b2b": b2bPending,
          "/admin/verification": verificationPending,
        }}
      />
      <main
        className="p-4 sm:p-6 lg:p-8"
        style={{
          flex: 1,
          minWidth: 0,
        }}
      >
        <ToastProvider>{children}</ToastProvider>
      </main>
    </div>
  );
}
