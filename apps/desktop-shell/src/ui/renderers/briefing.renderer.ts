import type { PhantomSession, PhantomTask, AttackResult } from "../../phantom/phantom.types";

export type BriefingViewState = {
  isVisible: boolean;
  session: PhantomSession | null;
  expandedTaskId: string | null;
};

export class BriefingRenderer {
  public render(container: HTMLElement, state: BriefingViewState): void {
    if (!state.isVisible || !state.session) {
      container.innerHTML = "";
      return;
    }

    const existingStyle = document.getElementById("ocl-briefing-style");
    if (!existingStyle) {
      const style = document.createElement("style");
      style.id = "ocl-briefing-style";
      style.textContent = `
        .ocl-briefing-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          font-family: 'Inter', system-ui, sans-serif;
          color: #e2e8f0;
        }

        .ocl-briefing-modal {
          background: #0f111a;
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-radius: 16px;
          width: 800px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.05);
          overflow: hidden;
          animation: ocl-slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes ocl-slide-up {
          from { opacity: 0; transform: translateY(40px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .ocl-briefing-header {
          padding: 32px;
          background: linear-gradient(180deg, rgba(139, 92, 246, 0.1) 0%, rgba(15, 17, 26, 0) 100%);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .ocl-briefing-greeting {
          font-size: 28px;
          font-weight: 700;
          color: #f8fafc;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .ocl-briefing-subtitle {
          font-size: 15px;
          color: #94a3b8;
          line-height: 1.5;
        }

        .ocl-briefing-stats-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-top: 24px;
        }

        .ocl-briefing-stat-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 16px;
          text-align: center;
        }

        .ocl-briefing-stat-value {
          font-size: 24px;
          font-weight: 700;
          color: #f8fafc;
          margin-bottom: 4px;
        }

        .ocl-briefing-stat-value.success { color: #34d399; }
        .ocl-briefing-stat-value.warning { color: #fbbf24; }

        .ocl-briefing-stat-label {
          font-size: 12px;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .ocl-briefing-body {
          padding: 24px 32px;
          overflow-y: auto;
          flex: 1;
        }

        .ocl-task-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          margin-bottom: 16px;
          overflow: hidden;
          transition: border-color 0.2s;
        }

        .ocl-task-card:hover {
          border-color: rgba(139, 92, 246, 0.3);
        }

        .ocl-task-header {
          padding: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
        }

        .ocl-task-title {
          font-size: 15px;
          font-weight: 600;
          color: #f8fafc;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .ocl-task-badge {
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .ocl-task-badge.survived { background: rgba(52, 211, 153, 0.15); color: #6ee7b7; }
        .ocl-task-badge.needs-review { background: rgba(251, 191, 36, 0.15); color: #fcd34d; }
        .ocl-task-badge.failed { background: rgba(239, 68, 68, 0.15); color: #fca5a5; }

        .ocl-task-details {
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          background: rgba(0, 0, 0, 0.2);
          padding: 16px;
        }

        .ocl-attack-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 12px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 8px;
          margin-bottom: 8px;
          border-left: 3px solid transparent;
        }

        .ocl-attack-row.survived { border-left-color: #34d399; }
        .ocl-attack-row.failed { border-left-color: #ef4444; }

        .ocl-attack-info {
          flex: 1;
        }

        .ocl-attack-vector {
          font-size: 13px;
          font-weight: 600;
          color: #e2e8f0;
          margin-bottom: 4px;
        }

        .ocl-attack-desc {
          font-size: 12px;
          color: #94a3b8;
          line-height: 1.5;
        }

        .ocl-attack-evidence {
          margin-top: 6px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: #cbd5e1;
          background: rgba(0,0,0,0.3);
          padding: 6px 10px;
          border-radius: 4px;
        }

        .ocl-briefing-footer {
          padding: 24px 32px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          background: #0f111a;
        }

        .ocl-btn {
          padding: 10px 20px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: all 0.2s;
        }

        .ocl-btn-primary {
          background: linear-gradient(135deg, #a855f7, #6366f1);
          color: white;
        }

        .ocl-btn-primary:hover {
          filter: brightness(1.15);
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
        }

        .ocl-btn-secondary {
          background: rgba(255, 255, 255, 0.05);
          color: #e2e8f0;
        }

        .ocl-btn-secondary:hover {
          background: rgba(255, 255, 255, 0.1);
        }
      `;
      document.head.appendChild(style);
    }

    const { session } = state;
    const hoursAway = Math.max(1, Math.round((Date.now() - new Date(session.userAbsentSince).getTime()) / 3600000));

    const tasksHtml = session.tasks.map(task => {
      const isExpanded = state.expandedTaskId === task.id;
      const report = task.breakerReport;
      
      const detailsHtml = isExpanded && report ? `
        <div class="ocl-task-details">
          <div style="margin-bottom: 12px; font-size: 12px; color: #94a3b8;">
            El agente Breaker ejecutó ${report.totalAttacks} ataques adversariales:
          </div>
          ${report.attacks.map(atk => `
            <div class="ocl-attack-row ${atk.survived ? 'survived' : 'failed'}">
              <div class="ocl-attack-info">
                <div class="ocl-attack-vector">${atk.vector} <span style="color: #64748b; font-weight: normal; font-size: 11px;">en ${atk.targetFile}</span></div>
                <div class="ocl-attack-desc">${atk.description}</div>
                <div class="ocl-attack-evidence">${atk.evidence}</div>
              </div>
              <div style="font-size: 16px; margin-left: 16px;">
                ${atk.survived ? '🛡️' : '💀'}
              </div>
            </div>
          `).join('')}
          <div style="margin-top: 16px; display: flex; gap: 8px;">
            <button class="ocl-btn ocl-btn-secondary" style="font-size: 12px; padding: 6px 12px;">Ver Diff</button>
            ${task.status === 'needs-review' ? `<button class="ocl-btn ocl-btn-primary" style="font-size: 12px; padding: 6px 12px;">Aceptar Parcialmente</button>` : ''}
          </div>
        </div>
      ` : '';

      return `
        <div class="ocl-task-card">
          <div class="ocl-task-header" data-toggle-task="${task.id}">
            <div class="ocl-task-title">
              ${task.source === 'sentry-issue' ? '🐛' : '📝'} 
              ${task.title}
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
              ${report ? `<span style="font-size: 12px; color: #94a3b8;">${report.survived}/${report.totalAttacks} bloqueados</span>` : ''}
              <span class="ocl-task-badge ${task.status}">${this.formatStatus(task.status)}</span>
              <span style="color: #64748b; font-size: 12px;">${isExpanded ? '▲' : '▼'}</span>
            </div>
          </div>
          ${detailsHtml}
        </div>
      `;
    }).join("");

    container.innerHTML = `
      <div class="ocl-briefing-overlay">
        <div class="ocl-briefing-modal">
          <div class="ocl-briefing-header">
            <div class="ocl-briefing-greeting">
              👻 Phantom Briefing
            </div>
            <div class="ocl-briefing-subtitle">
              Buenos días. Mientras estuviste fuera las últimas ${hoursAway} horas, el modo Phantom estuvo ejecutando el loop adversarial. Aquí tienes el reporte.
            </div>
            <div class="ocl-briefing-stats-row">
              <div class="ocl-briefing-stat-card">
                <div class="ocl-briefing-stat-value">${session.tasks.length}</div>
                <div class="ocl-briefing-stat-label">Tareas Completadas</div>
              </div>
              <div class="ocl-briefing-stat-card">
                <div class="ocl-briefing-stat-value warning">${session.totalAttacks}</div>
                <div class="ocl-briefing-stat-label">Ataques Adversariales</div>
              </div>
              <div class="ocl-briefing-stat-card">
                <div class="ocl-briefing-stat-value ${session.overallSurvivalRate > 90 ? 'success' : 'warning'}">${session.overallSurvivalRate}%</div>
                <div class="ocl-briefing-stat-label">Tasa de Supervivencia</div>
              </div>
            </div>
          </div>

          <div class="ocl-briefing-body">
            ${tasksHtml}
            ${session.tasks.length === 0 ? '<div style="text-align: center; padding: 40px; color: #64748b;">No hubo tareas programadas anoche.</div>' : ''}
          </div>

          <div class="ocl-briefing-footer">
            <button class="ocl-btn ocl-btn-secondary" id="btn-briefing-dismiss">Cerrar</button>
            <button class="ocl-btn ocl-btn-primary" id="btn-briefing-accept">Aceptar Cambios Seguros</button>
          </div>
        </div>
      </div>
    `;
  }

  private formatStatus(status: string): string {
    const labels: Record<string, string> = {
      survived: "Sobrevivió",
      "needs-review": "Revisión Requerida",
      failed: "Falló Build",
    };
    return labels[status] ?? status.toUpperCase();
  }
}
