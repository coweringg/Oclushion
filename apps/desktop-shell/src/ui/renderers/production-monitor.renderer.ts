import type { MonitoredIssue } from "../../monitoring/monitoring.types";

export type ProductionMonitorState = {
  isConnected: boolean;
  issues: MonitoredIssue[];
  autoFixEnabled: boolean;
};

export class ProductionMonitorRenderer {
  public render(container: HTMLElement, state: ProductionMonitorState): void {
    const existingStyle = document.getElementById("ocl-prodmon-style");
    if (!existingStyle) {
      const style = document.createElement("style");
      style.id = "ocl-prodmon-style";
      style.textContent = `
        .ocl-prodmon {
          background: #0a0a0c;
          color: #e2e8f0;
          font-family: 'Inter', system-ui, sans-serif;
          padding: 24px;
          height: 100%;
          overflow-y: auto;
        }

        .ocl-prodmon-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .ocl-prodmon-title {
          font-size: 18px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .ocl-prodmon-status {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 600;
        }

        .ocl-prodmon-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          animation: ocl-pulse-dot 2s infinite;
        }

        .ocl-prodmon-dot.connected { background: #22c55e; }
        .ocl-prodmon-dot.disconnected { background: #ef4444; }

        @keyframes ocl-pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        .ocl-prodmon-toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          margin-bottom: 20px;
        }

        .ocl-prodmon-toggle-label {
          font-size: 14px;
          font-weight: 600;
        }

        .ocl-prodmon-toggle-desc {
          font-size: 12px;
          color: #94a3b8;
          margin-top: 4px;
        }

        .ocl-prodmon-switch {
          width: 44px;
          height: 24px;
          border-radius: 12px;
          background: #333;
          position: relative;
          cursor: pointer;
          transition: background 0.3s;
          border: none;
        }

        .ocl-prodmon-switch.active {
          background: #22c55e;
        }

        .ocl-prodmon-switch-knob {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: white;
          position: absolute;
          top: 3px;
          left: 3px;
          transition: transform 0.3s;
        }

        .ocl-prodmon-switch.active .ocl-prodmon-switch-knob {
          transform: translateX(20px);
        }

        .ocl-prodmon-issues {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .ocl-prodmon-issue {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 16px;
          transition: border-color 0.3s;
        }

        .ocl-prodmon-issue:hover {
          border-color: rgba(255, 255, 255, 0.12);
        }

        .ocl-prodmon-issue-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }

        .ocl-prodmon-issue-title {
          font-size: 14px;
          font-weight: 600;
          color: #f8fafc;
        }

        .ocl-prodmon-issue-meta {
          font-size: 12px;
          color: #64748b;
          margin-top: 4px;
        }

        .ocl-prodmon-badge {
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .ocl-prodmon-badge.fatal { background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.3); }
        .ocl-prodmon-badge.error { background: rgba(249, 115, 22, 0.2); color: #fdba74; border: 1px solid rgba(249, 115, 22, 0.3); }
        .ocl-prodmon-badge.warning { background: rgba(234, 179, 8, 0.2); color: #fde047; border: 1px solid rgba(234, 179, 8, 0.3); }

        .ocl-prodmon-badge.pending { background: rgba(148, 163, 184, 0.15); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.2); }
        .ocl-prodmon-badge.fixing { background: rgba(139, 92, 246, 0.2); color: #c4b5fd; border: 1px solid rgba(139, 92, 246, 0.3); animation: ocl-pulse-dot 1.5s infinite; }
        .ocl-prodmon-badge.fixed { background: rgba(34, 197, 94, 0.2); color: #86efac; border: 1px solid rgba(34, 197, 94, 0.3); }
        .ocl-prodmon-badge.skipped { background: rgba(100, 116, 139, 0.15); color: #64748b; border: 1px solid rgba(100, 116, 139, 0.2); }

        .ocl-prodmon-stack {
          margin-top: 12px;
          padding: 10px;
          background: rgba(0, 0, 0, 0.4);
          border-radius: 8px;
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          font-size: 11px;
          color: #94a3b8;
          line-height: 1.5;
          white-space: pre-wrap;
          max-height: 120px;
          overflow-y: auto;
        }

        .ocl-prodmon-files {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 10px;
        }

        .ocl-prodmon-file-tag {
          padding: 3px 8px;
          background: rgba(99, 102, 241, 0.15);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 4px;
          font-size: 11px;
          color: #a5b4fc;
          font-family: 'JetBrains Mono', monospace;
        }

        .ocl-prodmon-actions {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }

        .ocl-prodmon-btn {
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: all 0.2s;
        }

        .ocl-prodmon-btn-fix {
          background: linear-gradient(135deg, #a855f7, #6366f1);
          color: white;
        }

        .ocl-prodmon-btn-fix:hover {
          filter: brightness(1.15);
        }

        .ocl-prodmon-btn-skip {
          background: transparent;
          color: #64748b;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .ocl-prodmon-btn-skip:hover {
          color: #f8fafc;
          background: rgba(255, 255, 255, 0.05);
        }

        .ocl-prodmon-empty {
          text-align: center;
          padding: 60px 20px;
          color: #64748b;
        }

        .ocl-prodmon-empty-icon {
          font-size: 48px;
          margin-bottom: 12px;
        }

        .ocl-prodmon-empty-text {
          font-size: 14px;
        }
      `;
      document.head.appendChild(style);
    }

    const statusDot = state.isConnected ? "connected" : "disconnected";
    const statusText = state.isConnected ? "Conectado a Sentry" : "Sin conexión";

    const issuesHtml = state.issues.length === 0
      ? `<div class="ocl-prodmon-empty">
           <div class="ocl-prodmon-empty-icon">✅</div>
           <div class="ocl-prodmon-empty-text">Sin errores en producción. Todo limpio.</div>
         </div>`
      : state.issues.map(tracked => `
          <div class="ocl-prodmon-issue">
            <div class="ocl-prodmon-issue-top">
              <div>
                <div class="ocl-prodmon-issue-title">${tracked.issue.title}</div>
                <div class="ocl-prodmon-issue-meta">
                  ${tracked.issue.culprit} · ${tracked.issue.count} ocurrencias · ${this.timeAgo(tracked.detectedAt)}
                </div>
              </div>
              <div style="display: flex; gap: 6px;">
                <span class="ocl-prodmon-badge ${tracked.issue.level}">${tracked.issue.level}</span>
                <span class="ocl-prodmon-badge ${tracked.fixStatus}">${this.fixStatusLabel(tracked.fixStatus)}</span>
              </div>
            </div>
            <div class="ocl-prodmon-stack">${tracked.stackTrace}</div>
            <div class="ocl-prodmon-files">
              ${tracked.affectedFiles.map(f => `<span class="ocl-prodmon-file-tag">${f}</span>`).join("")}
            </div>
            ${tracked.fixStatus === "pending" ? `
              <div class="ocl-prodmon-actions">
                <button class="ocl-prodmon-btn ocl-prodmon-btn-fix" data-fix-issue="${tracked.issue.id}">🤖 Auto-Fix</button>
                <button class="ocl-prodmon-btn ocl-prodmon-btn-skip" data-skip-issue="${tracked.issue.id}">Ignorar</button>
              </div>
            ` : ""}
          </div>
        `).join("");

    container.innerHTML = `
      <div class="ocl-prodmon">
        <div class="ocl-prodmon-header">
          <div class="ocl-prodmon-title">
            <span>🛡️</span> Production Monitor
          </div>
          <div class="ocl-prodmon-status">
            <div class="ocl-prodmon-dot ${statusDot}"></div>
            ${statusText}
          </div>
        </div>

        <div class="ocl-prodmon-toggle-row">
          <div>
            <div class="ocl-prodmon-toggle-label">Auto-Fix Automático</div>
            <div class="ocl-prodmon-toggle-desc">La IA detecta errores en Sentry y genera un PR con el fix automáticamente.</div>
          </div>
          <button class="ocl-prodmon-switch ${state.autoFixEnabled ? 'active' : ''}" id="btn-toggle-autofix">
            <div class="ocl-prodmon-switch-knob"></div>
          </button>
        </div>

        <div class="ocl-prodmon-issues">
          ${issuesHtml}
        </div>
      </div>
    `;
  }

  private fixStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: "Pendiente",
      fixing: "Reparando...",
      fixed: "Reparado",
      skipped: "Ignorado",
    };
    return labels[status] ?? status;
  }

  private timeAgo(isoDate: string): string {
    const diff = Date.now() - new Date(isoDate).getTime();
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return "ahora";
    if (minutes < 60) return `hace ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `hace ${hours}h`;
    return `hace ${Math.floor(hours / 24)}d`;
  }
}
