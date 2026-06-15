"use client";

import { useAdminAuth } from "../../../lib/auth-context";

export default function AdminDashboardPage() {
  const { user } = useAdminAuth();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold" style={{ color: "var(--ocl-text)" }}>Dashboard</h1>
      <p className="text-sm" style={{ color: "var(--ocl-muted)" }}>
        Welcome back, {user?.name ?? "Admin"}.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Organization" value={user?.email ?? "—"} subtitle="Signed in account" />
        <StatCard title="Admin Access" value="Full" subtitle="Owner / Admin role" />
        <StatCard title="Control API" value="Connected" subtitle="API reachable" />
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "var(--ocl-panel)", border: "1px solid var(--ocl-line)" }}
    >
      <p className="text-xs font-medium" style={{ color: "var(--ocl-muted)" }}>{title}</p>
      <p className="text-lg font-semibold mt-1" style={{ color: "var(--ocl-text)" }}>{value}</p>
      <p className="text-xs mt-1" style={{ color: "var(--ocl-muted-2)" }}>{subtitle}</p>
    </div>
  );
}
