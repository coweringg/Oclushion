import type { SafeDiffProposal } from "../../safe-diff.service";

export type ChatDiffState = {
  proposals: SafeDiffProposal[];
  globalStatus: "pending" | "approved" | "rejected";
};

export class ChatDiffRenderer {
  public render(container: HTMLElement, state: ChatDiffState): void {
    container.innerHTML = `
      <style>
        .ocl-chat-diff {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          padding: 12px;
          margin-top: 12px;
          font-family: 'Inter', system-ui, sans-serif;
        }

        .ocl-chat-diff-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          font-size: 13px;
          font-weight: 500;
        }

        .ocl-chat-diff-actions {
          display: flex;
          gap: 8px;
        }

        .ocl-btn {
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: all 0.2s ease;
        }

        .ocl-btn-accept-all {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .ocl-btn-accept-all:hover:not(:disabled) {
          background: rgba(16, 185, 129, 0.25);
        }

        .ocl-btn-reject-all {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .ocl-btn-reject-all:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.25);
        }

        .ocl-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .ocl-file-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .ocl-file-item {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.03);
          border-radius: 6px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          cursor: pointer;
          transition: background 0.15s;
        }

        .ocl-file-item:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        .ocl-file-icon {
          margin-right: 8px;
          font-size: 14px;
        }

        .ocl-file-status {
          margin-left: auto;
          font-size: 11px;
          text-transform: uppercase;
          font-weight: 700;
        }

        .ocl-status-approved { color: #10b981; }
        .ocl-status-rejected { color: #ef4444; }
        .ocl-status-pending { color: #f59e0b; }
      </style>

      <div class="ocl-chat-diff">
        <div class="ocl-chat-diff-header">
          <span>📝 Modificando ${state.proposals.length} archivo(s)</span>
          <div class="ocl-chat-diff-actions">
            <button class="ocl-btn ocl-btn-accept-all" id="btn-accept-all" ${state.globalStatus !== 'pending' ? 'disabled' : ''}>
              ✅ Aceptar Todos
            </button>
            <button class="ocl-btn ocl-btn-reject-all" id="btn-reject-all" ${state.globalStatus !== 'pending' ? 'disabled' : ''}>
              ❌ Revertir Todos
            </button>
          </div>
        </div>
        
        <div class="ocl-file-list">
          ${state.proposals.map(p => `
            <div class="ocl-file-item" data-proposal-id="${p.id}">
              <span class="ocl-file-icon">📄</span>
              <span class="ocl-file-name">${p.targetFile || "Archivo sin nombre"}</span>
              <span class="ocl-file-status ocl-status-${p.status}">
                ${p.status === 'approved' ? 'Aplicado' : p.status === 'rejected' ? 'Revertido' : 'Pendiente'}
              </span>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }
}
