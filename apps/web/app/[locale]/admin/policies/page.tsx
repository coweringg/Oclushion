"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdminAuth } from "../../../../lib/auth-context";
import { apiGet, apiPost } from "../../../../lib/api-client";

type SecurityPolicy = {
  id: string;
  name: string;
  description?: string;
  version: number;
  published: boolean;
  createdAt: string;
};

export default function AdminPoliciesPage() {
  const { token, organizationId } = useAdminAuth();
  const [policies, setPolicies] = useState<SecurityPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token || !organizationId) return;
    try {
      const data = await apiGet<{ policies: SecurityPolicy[] }>(
        `/v1/orgs/${organizationId}/policies`, token,
      );
      setPolicies(data.policies);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [token, organizationId]);

  useEffect(() => { load(); }, [load]);

  async function handlePublish(id: string) {
    if (!token || !organizationId) return;
    try {
      await apiPost(`/v1/orgs/${organizationId}/policies/${id}/publish`, token);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish policy");
    }
  }

  if (loading) {
    return <p className="text-sm" style={{ color: "var(--ocl-muted)" }}>Loading policies...</p>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-xl font-semibold" style={{ color: "var(--ocl-text)" }}>Security Policies</h1>

      {error && <p className="text-xs" style={{ color: "var(--ocl-red)" }}>{error}</p>}

      {policies.length === 0 ? (
        <div className="rounded-xl p-6 text-center" style={{ background: "var(--ocl-panel)", border: "1px solid var(--ocl-line)" }}>
          <p className="text-sm" style={{ color: "var(--ocl-muted)" }}>No policies configured yet.</p>
          <p className="text-xs mt-1" style={{ color: "var(--ocl-muted-2)" }}>
            Policies control what data can be shared with AI providers — ALLOW, BLOCK, TOKENIZE, or REQUIRE_APPROVAL.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {policies.map((p) => (
            <div
              key={p.id}
              className="rounded-xl p-4 flex items-center justify-between"
              style={{ background: "var(--ocl-panel)", border: "1px solid var(--ocl-line)" }}
            >
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--ocl-text)" }}>{p.name}</p>
                {p.description && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--ocl-muted)" }}>{p.description}</p>
                )}
                <p className="text-xs mt-1" style={{ color: "var(--ocl-muted-2)" }}>
                  v{p.version} &middot; {p.published ? "Published" : "Draft"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!p.published && (
                  <button
                    onClick={() => handlePublish(p.id)}
                    className="text-xs px-3 py-1.5 rounded-md"
                    style={{ background: "var(--ocl-purple)", color: "#fff" }}
                  >
                    Publish
                  </button>
                )}
                {p.published && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--ocl-green)", color: "#000" }}>
                    Active
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
