"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdminAuth } from "../../../../lib/auth-context";
import { apiGet } from "../../../../lib/api-client";

type AuditEvent = {
  id: string;
  eventType: string;
  actorEmail: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export default function AdminAuditPage() {
  const { token, organizationId } = useAdminAuth();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(async (pageNum: number) => {
    if (!token || !organizationId) return;
    setLoading(true);
    try {
      const data = await apiGet<{ events: AuditEvent[]; total: number }>(
        `/v1/orgs/${organizationId}/audit-events?page=${pageNum}&limit=25`, token,
      );
      setEvents(data.events);
      setHasMore(data.total > pageNum * 25);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, [token, organizationId]);

  useEffect(() => { load(page); }, [load, page]);

  async function handleExport(format: "csv" | "json") {
    if (!token || !organizationId) return;
    try {
      const data = await apiGet<{ events: AuditEvent[] }>(
        `/v1/orgs/${organizationId}/audit-events/export?format=${format}`, token,
      );
      const blob = new Blob(
        [format === "json" ? JSON.stringify(data.events, null, 2) : csvEncode(data.events)],
        { type: format === "json" ? "application/json" : "text/csv" },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-log.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: "var(--ocl-text)" }}>Audit Log</h1>
        <div className="flex gap-2">
          <button onClick={() => handleExport("json")} className="text-xs px-3 py-1.5 rounded-md" style={{ background: "var(--ocl-panel-2)", color: "var(--ocl-soft)" }}>Export JSON</button>
          <button onClick={() => handleExport("csv")} className="text-xs px-3 py-1.5 rounded-md" style={{ background: "var(--ocl-panel-2)", color: "var(--ocl-soft)" }}>Export CSV</button>
        </div>
      </div>

      {error && <p className="text-xs" style={{ color: "var(--ocl-red)" }}>{error}</p>}

      {loading ? (
        <p className="text-sm" style={{ color: "var(--ocl-muted)" }}>Loading audit log...</p>
      ) : events.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--ocl-muted)" }}>No audit events yet.</p>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--ocl-line)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--ocl-panel-2)" }}>
                <th className="text-left px-4 py-2 font-medium" style={{ color: "var(--ocl-muted)" }}>Event</th>
                <th className="text-left px-4 py-2 font-medium" style={{ color: "var(--ocl-muted)" }}>Actor</th>
                <th className="text-left px-4 py-2 font-medium" style={{ color: "var(--ocl-muted)" }}>Date</th>
                <th className="text-left px-4 py-2 font-medium" style={{ color: "var(--ocl-muted)" }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id} style={{ borderTop: "1px solid var(--ocl-line)" }}>
                  <td className="px-4 py-2">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--ocl-panel-2)", color: "var(--ocl-cyan)" }}>
                      {ev.eventType}
                    </span>
                  </td>
                  <td className="px-4 py-2" style={{ color: "var(--ocl-text)" }}>{ev.actorEmail}</td>
                  <td className="px-4 py-2 text-xs" style={{ color: "var(--ocl-muted)" }}>
                    {new Date(ev.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-xs" style={{ color: "var(--ocl-muted)" }}>
                    {ev.metadata ? JSON.stringify(ev.metadata).slice(0, 60) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="text-xs px-3 py-1.5 rounded-md disabled:opacity-30"
          style={{ background: "var(--ocl-panel-2)", color: "var(--ocl-soft)" }}
        >
          Previous
        </button>
        <span className="text-xs" style={{ color: "var(--ocl-muted)" }}>Page {page}</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={!hasMore}
          className="text-xs px-3 py-1.5 rounded-md disabled:opacity-30"
          style={{ background: "var(--ocl-panel-2)", color: "var(--ocl-soft)" }}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function csvEncode(events: AuditEvent[]): string {
  const header = "id,eventType,actorEmail,createdAt,metadata\n";
  const rows = events.map((e) =>
    `"${e.id}","${e.eventType}","${e.actorEmail}","${e.createdAt}","${JSON.stringify(e.metadata ?? {}).replace(/"/g, '""')}"`,
  ).join("\n");
  return header + rows;
}
