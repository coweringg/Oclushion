"use client";

import { useCallback, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAdminAuth } from "../../lib/auth-context";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: "◆" },
  { href: "/admin/members", label: "Members", icon: "◎" },
  { href: "/admin/sso", label: "SSO", icon: "◈" },
  { href: "/admin/audit", label: "Audit Log", icon: "◉" },
  { href: "/admin/scim", label: "SCIM", icon: "↗" },
  { href: "/admin/policies", label: "Policies", icon: "⚙" },
];

export function AdminShell({ children, locale }: { children: ReactNode; locale: string }) {
  const { user, logout } = useAdminAuth();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = useCallback(
    (href: string) => pathname === `/${locale}${href}`,
    [pathname, locale],
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--ocl-bg-deep)" }}>
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: "var(--ocl-panel)", borderRight: "1px solid var(--ocl-line)" }}
      >
        <div className="flex h-16 items-center gap-2 px-6" style={{ borderBottom: "1px solid var(--ocl-line)" }}>
          <span className="text-xl" style={{ color: "var(--ocl-purple)" }}>◈</span>
          <span className="font-semibold text-sm" style={{ color: "var(--ocl-text)" }}>Oclushion Admin</span>
        </div>
        <nav className="p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={`/${locale}${item.href}`}
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
              style={{
                background: isActive(item.href) ? "var(--ocl-purple)" : "transparent",
                color: isActive(item.href) ? "#fff" : "var(--ocl-soft)",
              }}
              onMouseEnter={(e) => {
                if (!isActive(item.href)) (e.currentTarget as HTMLElement).style.background = "var(--ocl-panel-2)";
              }}
              onMouseLeave={(e) => {
                if (!isActive(item.href)) (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <header
          className="flex h-16 items-center justify-between px-4 lg:px-6"
          style={{ background: "var(--ocl-panel)", borderBottom: "1px solid var(--ocl-line)" }}
        >
          <button
            className="lg:hidden p-2 rounded-md"
            style={{ color: "var(--ocl-soft)" }}
            onClick={() => setSidebarOpen(true)}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><rect x="3" y="4" width="14" height="1.5" rx="1"/><rect x="3" y="9" width="14" height="1.5" rx="1"/><rect x="3" y="14" width="14" height="1.5" rx="1"/></svg>
          </button>
          <div />
          {user && (
            <div className="flex items-center gap-3">
              <span className="text-sm hidden sm:inline" style={{ color: "var(--ocl-soft)" }}>{user.email}</span>
              <button
                onClick={logout}
                className="text-xs px-3 py-1.5 rounded-md transition-colors"
                style={{ background: "var(--ocl-panel-2)", color: "var(--ocl-muted)" }}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = "var(--ocl-red)"}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = "var(--ocl-muted)"}
              >
                Logout
              </button>
            </div>
          )}
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
