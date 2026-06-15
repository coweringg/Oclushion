"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import { useAdminAuth } from "../../../../lib/auth-context";
import { apiGet, apiPost, apiDelete, type ApiError } from "../../../../lib/api-client";

type OrgMember = {
  userId: string;
  email: string;
  displayName?: string;
  role: string;
  joinedAt: string;
};

const ROLES = ["owner", "admin", "security_officer", "auditor", "developer", "viewer"];

export default function AdminMembersPage() {
  const { token, organizationId } = useAdminAuth();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("developer");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token || !organizationId) return;
    try {
      const data = await apiGet<{ members: OrgMember[] }>(
        `/v1/orgs/${organizationId}/members`, token,
      );
      setMembers(data.members);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load members");
    } finally {
      setLoading(false);
    }
  }, [token, organizationId]);

  useEffect(() => { load(); }, [load]);

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    if (!token || !organizationId) return;
    setSaving(true);
    setError("");
    try {
      await apiPost(`/v1/orgs/${organizationId}/invitations`, token, {
        email: inviteEmail,
        role: inviteRole,
      });
      setInviteEmail("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invitation failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(userId: string) {
    if (!token || !organizationId) return;
    if (!confirm("Remove this member?")) return;
    try {
      await apiDelete(`/v1/orgs/${organizationId}/members/${userId}`, token);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    }
  }

  if (loading) {
    return <p className="text-sm" style={{ color: "var(--ocl-muted)" }}>Loading members...</p>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-xl font-semibold" style={{ color: "var(--ocl-text)" }}>Members</h1>

      <form onSubmit={handleInvite} className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium block mb-1" style={{ color: "var(--ocl-soft)" }}>Invite by email</label>
          <input
            type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: "var(--ocl-bg-deep)", color: "var(--ocl-text)", border: "1px solid var(--ocl-line)" }}
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: "var(--ocl-soft)" }}>Role</label>
          <select
            value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: "var(--ocl-bg-deep)", color: "var(--ocl-text)", border: "1px solid var(--ocl-line)" }}
          >
            {ROLES.filter((r) => r !== "owner").map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <button
          type="submit" disabled={saving}
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: "var(--ocl-purple)", color: "#fff" }}
        >
          {saving ? "Sending..." : "Invite"}
        </button>
      </form>

      {error && <p className="text-xs" style={{ color: "var(--ocl-red)" }}>{error}</p>}

      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--ocl-line)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--ocl-panel-2)" }}>
              <th className="text-left px-4 py-2 font-medium" style={{ color: "var(--ocl-muted)" }}>Email</th>
              <th className="text-left px-4 py-2 font-medium" style={{ color: "var(--ocl-muted)" }}>Name</th>
              <th className="text-left px-4 py-2 font-medium" style={{ color: "var(--ocl-muted)" }}>Role</th>
              <th className="text-right px-4 py-2 font-medium" style={{ color: "var(--ocl-muted)" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.userId} style={{ borderTop: "1px solid var(--ocl-line)" }}>
                <td className="px-4 py-2" style={{ color: "var(--ocl-text)" }}>{m.email}</td>
                <td className="px-4 py-2" style={{ color: "var(--ocl-soft)" }}>{m.displayName ?? "—"}</td>
                <td className="px-4 py-2">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: "var(--ocl-purple)", color: "#fff" }}
                  >
                    {m.role}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  {m.role !== "owner" && (
                    <button
                      onClick={() => handleRemove(m.userId)}
                      className="text-xs hover:underline"
                      style={{ color: "var(--ocl-red)" }}
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
