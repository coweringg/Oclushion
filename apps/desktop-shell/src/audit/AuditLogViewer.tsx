import { useState, useEffect } from "react";

interface AuditEvent {
  id: string;
  type: string;
  summary: string;
  timestamp: string;
  actor: string;
  metadata: Record<string, string | number | boolean | null>;
}

interface AuditLogViewerProps {
  organizationId: string;
  events: AuditEvent[];
  onExport?: (format: "json" | "csv") => void;
  onRefresh?: () => void;
}

export function AuditLogViewer({ organizationId, events, onExport, onRefresh }: AuditLogViewerProps) {
  const [filter, setFilter] = useState({ type: "", actor: "", startDate: "", endDate: "" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const filteredEvents = events.filter((event) => {
    const matchesType = !filter.type || event.type.toLowerCase().includes(filter.type.toLowerCase());
    const matchesActor = !filter.actor || event.actor.toLowerCase().includes(filter.actor.toLowerCase());
    const matchesDate =
      (!filter.startDate || new Date(event.timestamp) >= new Date(filter.startDate)) &&
      (!filter.endDate || new Date(event.timestamp) <= new Date(filter.endDate));
    return matchesType && matchesActor && matchesDate;
  });

  const totalPages = Math.ceil(filteredEvents.length / pageSize);
  const startIndex = (page - 1) * pageSize;
  const paginatedEvents = filteredEvents.slice(startIndex, startIndex + pageSize);

  const eventTypes = [...new Set(events.map((e) => e.type))];

  return (
    <div className="audit-log-viewer">
      <div className="audit-header">
        <h3>Audit Log</h3>
        <div className="audit-actions">
          <button onClick={() => onExport?.("json")}>Export JSON</button>
          <button onClick={() => onExport?.("csv")}>Export CSV</button>
          <button onClick={onRefresh}>Refresh</button>
        </div>
      </div>

      <div className="audit-filters">
        <select
          value={filter.type}
          onChange={(e) => setFilter({ ...filter, type: e.target.value })}
        >
          <option value="">All Types</option>
          {eventTypes.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Filter by actor..."
          value={filter.actor}
          onChange={(e) => setFilter({ ...filter, actor: e.target.value })}
        />

        <input
          type="date"
          value={filter.startDate}
          onChange={(e) => setFilter({ ...filter, startDate: e.target.value })}
        />

        <input
          type="date"
          value={filter.endDate}
          onChange={(e) => setFilter({ ...filter, endDate: e.target.value })}
        />
      </div>

      <table className="audit-table">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Type</th>
            <th>Actor</th>
            <th>Summary</th>
          </tr>
        </thead>
        <tbody>
          {paginatedEvents.map((event) => (
            <tr key={event.id}>
              <td>{new Date(event.timestamp).toLocaleString()}</td>
              <td>
                <span className={`event-type ${event.type.toLowerCase().replace("_", "-")}`}>
                  {event.type}
                </span>
              </td>
              <td>{event.actor}</td>
              <td>{event.summary}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="audit-pagination">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <span>
          Page {page} of {totalPages} ({filteredEvents.length} events)
        </span>
        <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
          Next
        </button>
        <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
          <option value={10}>10/page</option>
          <option value={25}>25/page</option>
          <option value={50}>50/page</option>
          <option value={100}>100/page</option>
        </select>
      </div>
    </div>
  );
}
