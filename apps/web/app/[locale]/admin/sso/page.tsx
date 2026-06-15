"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import { useAdminAuth } from "../../../../lib/auth-context";
import { apiGet, apiPost, apiDelete } from "../../../../lib/api-client";

type SSOConnection = {
  id: string;
  provider: string;
  domain: string;
  idpLabel?: string;
  issuer?: string;
  roleMappings?: Record<string, string>;
  createdAt: string;
};

export default function AdminSSOPage() {
  const { token, organizationId } = useAdminAuth();
  const [connections, setConnections] = useState<SSOConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [domain, setDomain] = useState("");
  const [provider, setProvider] = useState("saml");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token || !organizationId) return;
    try {
      const data = await apiGet<{ connections: SSOConnection[] }>(
        `/v1/orgs/${organizationId}/sso`, token,
      );
      setConnections(data.connections);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [token, organizationId]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!token || !organizationId) return;
    setSaving(true);
    setError("");
    try {
      await apiPost(`/v1/orgs/${organizationId}/sso`, token, { domain, provider });
      setDomain("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create SSO connection");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!token || !organizationId) return;
    if (!confirm("Delete this SSO connection?")) return;
    try {
      await apiDelete(`/v1/orgs/${organizationId}/sso/${id}`, token);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete SSO connection");
    }
  }

  if (loading) {
    return <p className="text-sm" style={{ color: "var(--ocl-muted)" }}>Loading SSO configuration...</p>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-xl font-semibold" style={{ color: "var(--ocl-text)" }}>SSO / SAML / OIDC</h1>

      <form onSubmit={handleCreate} className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium block mb-1" style={{ color: "var(--ocl-soft)" }}>Domain</label>
          <input
            type="text" value={domain} onChange={(e) => setDomain(e.target.value)} required
            placeholder="example.com"
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: "var(--ocl-bg-deep)", color: "var(--ocl-text)", border: "1px solid var(--ocl-line)" }}
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: "var(--ocl-soft)" }}>Provider</label>
          <select
            value={provider} onChange={(e) => setProvider(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: "var(--ocl-bg-deep)", color: "var(--ocl-text)", border: "1px solid var(--ocl-line)" }}
          >
            <option value="saml">SAML</option>
            <option value="oidc">OIDC</option>
          </select>
        </div>
        <button
          type="submit" disabled={saving}
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: "var(--ocl-purple)", color: "#fff" }}
        >
          {saving ? "Creating..." : "Add Connection"}
        </button>
      </form>

      {error && <p className="text-xs" style={{ color: "var(--ocl-red)" }}>{error}</p>}

      {connections.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--ocl-muted)" }}>
          No SSO connections configured. Add one above.
        </p>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--ocl-line)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--ocl-panel-2)" }}>
                <th className="text-left px-4 py-2 font-medium" style={{ color: "var(--ocl-muted)" }}>Provider</th>
                <th className="text-left px-4 py-2 font-medium" style={{ color: "var(--ocl-muted)" }}>Domain</th>
                <th className="text-left px-4 py-2 font-medium" style={{ color: "var(--ocl-muted)" }}>Issuer</th>
                <th className="text-right px-4 py-2 font-medium" style={{ color: "var(--ocl-muted)" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {connections.map((c) => (
                <tr key={c.id} style={{ borderTop: "1px solid var(--ocl-line)" }}>
                  <td className="px-4 py-2">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--ocl-panel-2)", color: "var(--ocl-cyan)" }}>
                      {c.provider.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-2" style={{ color: "var(--ocl-text)" }}>{c.domain}</td>
                  <td className="px-4 py-2 text-xs" style={{ color: "var(--ocl-muted)" }}>{c.issuer ?? "—"}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-xs hover:underline"
                      style={{ color: "var(--ocl-red)" }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
