"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import { useAdminAuth } from "../../../../lib/auth-context";
import { apiGet, apiPost, apiDelete } from "../../../../lib/api-client";

type SCIMToken = {
  id: string;
  description: string;
  createdAt: string;
  expiresAt?: string;
  lastUsedAt?: string;
};

export default function AdminSCIMMPage() {
  const { token, organizationId } = useAdminAuth();
  const [tokens, setTokens] = useState<SCIMToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [description, setDescription] = useState("");
  const [newToken, setNewToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [scimUrl, setScimUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setScimUrl(`${window.location.origin}/scim/v2`);
    }
  }, []);

  const load = useCallback(async () => {
    if (!token || !organizationId) return;
    try {
      const data = await apiGet<{ tokens: SCIMToken[] }>(
        `/v1/orgs/${organizationId}/scim/tokens`, token,
      );
      setTokens(data.tokens);
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
      const result = await apiPost<{ token: string; id: string }>(
        `/v1/orgs/${organizationId}/scim/tokens`, token, { description },
      );
      setNewToken(result.token);
      setDescription("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create SCIM token");
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!token || !organizationId) return;
    if (!confirm("Revoke this SCIM token?")) return;
    try {
      await apiDelete(`/v1/orgs/${organizationId}/scim/tokens/${id}`, token);
      setTokens((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke token");
    }
  }

  if (loading) {
    return <p className="text-sm" style={{ color: "var(--ocl-muted)" }}>Loading SCIM configuration...</p>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-xl font-semibold" style={{ color: "var(--ocl-text)" }}>SCIM Provisioning</h1>

      <div className="rounded-xl p-4" style={{ background: "var(--ocl-panel)", border: "1px solid var(--ocl-line)" }}>
        <p className="text-xs font-medium mb-1" style={{ color: "var(--ocl-muted)" }}>SCIM Endpoint URL</p>
        <p className="text-sm font-mono" style={{ color: "var(--ocl-cyan)" }}>{scimUrl || "Loading..."}</p>
        <p className="text-xs mt-2" style={{ color: "var(--ocl-muted)" }}>
          Configure this URL in your identity provider (Okta, Azure AD, Google Workspace).
        </p>
      </div>

      <form onSubmit={handleCreate} className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="text-xs font-medium block mb-1" style={{ color: "var(--ocl-soft)" }}>New Token</label>
          <input
            type="text" value={description} onChange={(e) => setDescription(e.target.value)} required
            placeholder="e.g. Okta production"
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: "var(--ocl-bg-deep)", color: "var(--ocl-text)", border: "1px solid var(--ocl-line)" }}
          />
        </div>
        <button
          type="submit" disabled={saving}
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: "var(--ocl-purple)", color: "#fff" }}
        >
          {saving ? "Creating..." : "Generate Token"}
        </button>
      </form>

      {newToken && (
        <div className="rounded-xl p-4" style={{ background: "var(--ocl-panel)", border: "1px solid var(--ocl-gold)" }}>
          <p className="text-xs font-medium mb-1" style={{ color: "var(--ocl-gold)" }}>Token generated — copy it now</p>
          <p className="text-sm font-mono break-all" style={{ color: "var(--ocl-text)" }}>{newToken}</p>
          <p className="text-xs mt-1" style={{ color: "var(--ocl-red)" }}>This token will not be shown again.</p>
        </div>
      )}

      {error && <p className="text-xs" style={{ color: "var(--ocl-red)" }}>{error}</p>}

      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--ocl-line)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--ocl-panel-2)" }}>
              <th className="text-left px-4 py-2 font-medium" style={{ color: "var(--ocl-muted)" }}>Description</th>
              <th className="text-left px-4 py-2 font-medium" style={{ color: "var(--ocl-muted)" }}>Created</th>
              <th className="text-left px-4 py-2 font-medium" style={{ color: "var(--ocl-muted)" }}>Last Used</th>
              <th className="text-right px-4 py-2 font-medium" style={{ color: "var(--ocl-muted)" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tokens.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-sm" style={{ color: "var(--ocl-muted)" }}>No SCIM tokens created yet.</td></tr>
            )}
            {tokens.map((t) => (
              <tr key={t.id} style={{ borderTop: "1px solid var(--ocl-line)" }}>
                <td className="px-4 py-2" style={{ color: "var(--ocl-text)" }}>{t.description}</td>
                <td className="px-4 py-2 text-xs" style={{ color: "var(--ocl-muted)" }}>{new Date(t.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-xs" style={{ color: "var(--ocl-muted)" }}>{t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleDateString() : "—"}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => handleRevoke(t.id)} className="text-xs hover:underline" style={{ color: "var(--ocl-red)" }}>Revoke</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
