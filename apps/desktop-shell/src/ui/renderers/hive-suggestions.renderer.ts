import type { HiveInsight } from "../../memory/hive-memory.service";

export type HiveSuggestionsState = {
  insights: HiveInsight[];
};

export class HiveSuggestionsRenderer {
  public render(container: HTMLElement, state: HiveSuggestionsState): void {
    if (state.insights.length === 0) {
      container.innerHTML = '';
      return;
    }

    const existingStyle = document.getElementById("ocl-hive-style");
    if (!existingStyle) {
      const style = document.createElement("style");
      style.id = "ocl-hive-style";
      style.textContent = `
        .ocl-hive-container {
          position: fixed;
          bottom: 40px;
          right: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          z-index: 1000;
          pointer-events: none;
        }

        .ocl-hive-card {
          background: rgba(24, 24, 24, 0.95);
          backdrop-filter: blur(8px);
          border: 1px solid #c28800; 
          border-left: 4px solid #c28800;
          border-radius: 6px;
          padding: 12px 16px;
          width: 320px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
          pointer-events: auto;
          animation: slideInRight 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        @keyframes slideInRight {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }

        .ocl-hive-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .ocl-hive-title {
          font-size: 11px;
          font-weight: 700;
          color: #c28800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .ocl-hive-close {
          cursor: pointer;
          color: #858585;
          font-size: 14px;
        }
        
        .ocl-hive-close:hover {
          color: #fff;
        }

        .ocl-hive-meta {
          font-size: 10px;
          color: #858585;
          margin-bottom: 8px;
        }

        .ocl-hive-project-badge {
          background: rgba(194, 136, 0, 0.15);
          color: #cca700;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 500;
        }

        .ocl-hive-body {
          font-size: 12px;
          line-height: 1.4;
          color: #cccccc;
          margin-bottom: 12px;
        }

        .ocl-hive-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }

        .ocl-hive-btn {
          background: #333;
          border: 1px solid #454545;
          color: #fff;
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .ocl-hive-btn.primary {
          background: #c28800;
          border-color: #c28800;
        }

        .ocl-hive-btn:hover {
          background: #444;
        }
        .ocl-hive-btn.primary:hover {
          background: #9e6f00;
        }
      `;
      document.head.appendChild(style);
    }

    const cardsHtml = state.insights.map(insight => `
      <div class="ocl-hive-card" data-id="${insight.id}">
        <div class="ocl-hive-header">
          <div class="ocl-hive-title">
            <span>🧠</span> Hive Insight
          </div>
          <div class="ocl-hive-close" data-action="dismiss">✕</div>
        </div>
        <div class="ocl-hive-meta">
          From <span class="ocl-hive-project-badge">${insight.sourceProject}</span> by ${insight.author}
        </div>
        <div class="ocl-hive-body">
          ${insight.lesson}
        </div>
        <div class="ocl-hive-actions">
          <button class="ocl-hive-btn primary" data-action="apply">Inject to Context</button>
        </div>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="ocl-hive-container">
        ${cardsHtml}
      </div>
    `;
  }
}
