"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAdminAuth } from "../../../../lib/auth-context";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAdminAuth();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.replace(`/${locale}/admin`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4" style={{ background: "var(--ocl-bg-deep)" }}>
      <div className="w-full max-w-sm rounded-xl p-6" style={{ background: "var(--ocl-panel)", border: "1px solid var(--ocl-line)" }}>
        <div className="text-center mb-6">
          <div className="text-2xl mb-1" style={{ color: "var(--ocl-purple)" }}>◈</div>
          <h1 className="text-lg font-semibold" style={{ color: "var(--ocl-text)" }}>Admin Login</h1>
          <p className="text-xs mt-1" style={{ color: "var(--ocl-muted)" }}>Oclushion Control Panel</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium" style={{ color: "var(--ocl-soft)" }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none transition-colors"
              style={{ background: "var(--ocl-bg-deep)", color: "var(--ocl-text)", border: "1px solid var(--ocl-line)" }}
              onFocus={(e) => (e.currentTarget as HTMLElement).style.borderColor = "var(--ocl-purple)"}
              onBlur={(e) => (e.currentTarget as HTMLElement).style.borderColor = "var(--ocl-line)"}
            />
          </div>
          <div>
            <label className="text-xs font-medium" style={{ color: "var(--ocl-soft)" }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none transition-colors"
              style={{ background: "var(--ocl-bg-deep)", color: "var(--ocl-text)", border: "1px solid var(--ocl-line)" }}
              onFocus={(e) => (e.currentTarget as HTMLElement).style.borderColor = "var(--ocl-purple)"}
              onBlur={(e) => (e.currentTarget as HTMLElement).style.borderColor = "var(--ocl-line)"}
            />
          </div>
          {error && (
            <p className="text-xs" style={{ color: "var(--ocl-red)" }}>{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
            style={{ background: "var(--ocl-purple)", color: "#fff" }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
