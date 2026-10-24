"use client";

import AdminErrorState from "@/components/admin/AdminErrorState";

export default function AdminProtectedError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <AdminErrorState {...props} />;
}
