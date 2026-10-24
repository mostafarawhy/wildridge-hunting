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
      style={{
        display: "flex",
        flexDirection: "row",
        minHeight: "100vh",
        backgroundColor: "var(--color-shop-bg)",
      }}
    >
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
        style={{
          flex: 1,
          minWidth: 0,
          padding: "2rem",
        }}
      >
        <ToastProvider>{children}</ToastProvider>
      </main>
    </div>
  );
}
