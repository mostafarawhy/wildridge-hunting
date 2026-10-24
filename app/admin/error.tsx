"use client";

import AdminErrorState from "@/components/admin/AdminErrorState";

export default function AdminRootError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "2rem",
        backgroundColor: "var(--color-shop-bg)",
      }}
    >
      <AdminErrorState {...props} />
    </div>
  );
}
