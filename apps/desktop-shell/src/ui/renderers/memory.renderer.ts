import type { MemoryEntry } from "../../memory/memory.types";

export type MemoryState = {
  entries: MemoryEntry[];
  isScanning: boolean;
};

export class MemoryRenderer {
  public render(container: HTMLElement, state: MemoryState): void {
    container.innerHTML = `
      <style>
        .ocl-memory-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #0d0d12;
          color: #f8fafc;
          font-family: 'Inter', system-ui, sans-serif;
          border-left: 1px solid rgba(255, 255, 255, 0.05);
        }

        .ocl-memory-header {
          padding: 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(20, 20, 25, 0.5);
          backdrop-filter: blur(10px);
        }

        .ocl-memory-title {
          font-size: 18px;
          font-weight: 600;
          letter-spacing: -0.5px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .ocl-memory-title span {
          color: #10b981;
        }

        .ocl-btn-reindex {
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s ease;
        }

        .ocl-btn-reindex:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }

        .ocl-btn-reindex:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .ocl-memory-list {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .ocl-memory-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 16px;
          transition: all 0.2s ease;
          position: relative;
        }

        .ocl-memory-card:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.1);
        }

        .ocl-memory-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .ocl-memory-badges {
          display: flex;
          gap: 8px;
        }

        .ocl-badge {
          font-size: 10px;
          padding: 4px 8px;
          border-radius: 100px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .ocl-badge.fact { background: rgba(56, 189, 248, 0.15); color: #7dd3fc; }
        .ocl-badge.decision { background: rgba(244, 63, 94, 0.15); color: #fb7185; }
        .ocl-badge.convention { background: rgba(168, 85, 247, 0.15); color: #d8b4fe; }
        .ocl-badge.command { background: rgba(250, 204, 21, 0.15); color: #fde047; }
        .ocl-badge.architecture { background: rgba(16, 185, 129, 0.15); color: #6ee7b7; }

        .ocl-memory-confidence {
          font-size: 11px;
          color: #64748b;
          font-weight: 500;
        }

        .ocl-memory-content {
          font-size: 14px;
          color: #cbd5e1;
          line-height: 1.5;
          margin-bottom: 16px;
          font-family: 'JetBrains Mono', monospace;
        }

        .ocl-memory-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          padding-top: 12px;
        }

        .ocl-memory-source {
          font-size: 12px;
          color: #64748b;
        }

        .ocl-btn-forget {
          background: transparent;
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.2);
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .ocl-btn-forget:hover {
          background: rgba(239, 68, 68, 0.1);
        }

        .ocl-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #64748b;
          gap: 16px;
        }

        .ocl-spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
      </style>

      <div class="ocl-memory-panel">
        <div class="ocl-memory-header">
          <div class="ocl-memory-title">
            <span>🧠</span> Vector Memory Bank
          </div>
          <button class="ocl-btn-reindex" id="ocl-btn-reindex" ${state.isScanning ? "disabled" : ""}>
            ${state.isScanning ? '<span class="ocl-spinner">⚙️</span> Scanning...' : '🔄 Incremental Re-Index'}
          </button>
        </div>

        <div class="ocl-memory-list">
          ${state.entries.length === 0 && !state.isScanning ? `
            <div class="ocl-empty-state">
              <div style="font-size: 32px; opacity: 0.5;">📭</div>
              <div>No memories indexed yet.</div>
            </div>
          ` : ""}
          
          ${state.entries.map(entry => `
            <div class="ocl-memory-card">
              <div class="ocl-memory-meta">
                <div class="ocl-memory-badges">
                  <span class="ocl-badge ${entry.type}">${entry.type}</span>
                </div>
                <div class="ocl-memory-confidence">
                  Confidence: ${Math.round((entry.confidence ?? 0) * 100)}%
                </div>
              </div>
              
              <div class="ocl-memory-content">
                ${entry.content}
              </div>
              
              <div class="ocl-memory-footer">
                <div class="ocl-memory-source">
                  ${entry.source === "auto-detected" ? "⚙️ System Extracted" : "💬 Chat Inferred"}
                  • Used ${entry.usageCount} times
                </div>
                <button class="ocl-btn-forget" data-memory-id="${entry.id}">🗑️ Forget</button>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }
}
