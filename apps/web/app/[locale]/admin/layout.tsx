"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { AdminAuthProvider, useAdminAuth } from "../../../lib/auth-context";
import { AdminShell } from "../../../components/admin/AdminShell";

function AdminGuard({ children, locale }: { children: ReactNode; locale: string }) {
  const { token, isLoading } = useAdminAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !token) {
      router.replace(`/${locale}/admin/login`);
    }
  }, [token, isLoading, router, locale]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "var(--ocl-bg-deep)", color: "var(--ocl-muted)" }}>
        <div className="text-center">
          <div className="animate-spin h-6 w-6 border-2 rounded-full mx-auto mb-2" style={{ borderColor: "var(--ocl-purple)", borderTopColor: "transparent" }} />
          <p className="text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return null;
  }

  return <AdminShell locale={locale}>{children}</AdminShell>;
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const locale = params.locale as string;

  return (
    <AdminAuthProvider>
      <AdminGuard locale={locale}>{children}</AdminGuard>
    </AdminAuthProvider>
  );
}
