import type { FinOpsAlert } from "../../agents/finops.service";

export type FinOpsState = {
  alerts: FinOpsAlert[];
};

export class FinOpsRenderer {
  public render(container: HTMLElement, state: FinOpsState): void {
    if (state.alerts.length === 0) {
      container.innerHTML = '';
      return;
    }

    const existingStyle = document.getElementById("ocl-finops-style");
    if (!existingStyle) {
      const style = document.createElement("style");
      style.id = "ocl-finops-style";
      style.textContent = `
        .ocl-finops-container {
          position: fixed;
          bottom: 40px;
          left: 80px; 
          display: flex;
          flex-direction: column;
          gap: 12px;
          z-index: 1000;
          pointer-events: none;
        }

        .ocl-finops-card {
          background: rgba(12, 26, 16, 0.95);
          backdrop-filter: blur(8px);
          border: 1px solid #16a34a;
          border-left: 4px solid #22c55e;
          border-radius: 6px;
          padding: 14px 18px;
          width: 340px;
          box-shadow: 0 8px 32px rgba(22, 163, 74, 0.15);
          pointer-events: auto;
          animation: slideInLeft 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        @keyframes slideInLeft {
          from { transform: translateX(-120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }

        .ocl-finops-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .ocl-finops-title {
          font-size: 12px;
          font-weight: 700;
          color: #22c55e;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .ocl-finops-close {
          cursor: pointer;
          color: #858585;
          font-size: 14px;
        }
        
        .ocl-finops-close:hover {
          color: #fff;
        }

        .ocl-finops-metrics {
          display: flex;
          gap: 12px;
          margin-bottom: 10px;
          padding-bottom: 10px;
          border-bottom: 1px solid rgba(34, 197, 94, 0.2);
        }

        .ocl-finops-metric {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .ocl-finops-metric-label {
          font-size: 9px;
          text-transform: uppercase;
          color: #a1a1aa;
        }

        .ocl-finops-metric-val {
          font-size: 13px;
          font-weight: 700;
          font-family: monospace;
        }

        .ocl-finops-metric-val.bad {
          color: #ef4444;
          text-decoration: line-through;
        }

        .ocl-finops-metric-val.good {
          color: #22c55e;
        }

        .ocl-finops-body {
          font-size: 12px;
          line-height: 1.4;
          color: #e4e4e7;
          margin-bottom: 12px;
        }

        .ocl-finops-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }

        .ocl-finops-btn {
          background: #333;
          border: 1px solid #454545;
          color: #fff;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .ocl-finops-btn.primary {
          background: #16a34a;
          border-color: #15803d;
          color: white;
        }

        .ocl-finops-btn:hover {
          background: #444;
        }
        .ocl-finops-btn.primary:hover {
          background: #15803d;
        }
      `;
      document.head.appendChild(style);
    }

    const cardsHtml = state.alerts.map(alert => `
      <div class="ocl-finops-card" data-id="${alert.id}">
        <div class="ocl-finops-header">
          <div class="ocl-finops-title">
            <span>💰</span> FinOps Alert: ${alert.title}
          </div>
          <div class="ocl-finops-close" data-action="dismiss">✕</div>
        </div>
        
        <div class="ocl-finops-metrics">
          <div class="ocl-finops-metric">
            <span class="ocl-finops-metric-label">Projected Cost</span>
            <span class="ocl-finops-metric-val bad">${alert.projectedCost}</span>
          </div>
          <div class="ocl-finops-metric">
            <span class="ocl-finops-metric-label">Optimized</span>
            <span class="ocl-finops-metric-val good">${alert.optimizedCost}</span>
          </div>
          <div class="ocl-finops-metric">
            <span class="ocl-finops-metric-label">Savings ROI</span>
            <span class="ocl-finops-metric-val good">${alert.savings}</span>
          </div>
        </div>

        <div class="ocl-finops-body">
          <strong>Trigger:</strong> <code>${alert.triggerFile}</code><br/>
          ${alert.description}<br/><br/>
          <span style="color: #a1a1aa;">${alert.proposal}</span>
        </div>
        <div class="ocl-finops-actions">
          <button class="ocl-finops-btn" data-action="dismiss">Ignore</button>
          <button class="ocl-finops-btn primary" data-action="fix">Generate SafeDiff</button>
        </div>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="ocl-finops-container">
        ${cardsHtml}
      </div>
    `;
  }
}
