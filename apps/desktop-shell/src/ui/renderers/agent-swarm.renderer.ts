import type { AgentDefinition, AgentRole, OrchestratorSnapshot } from "../../agents/types";

const AGENT_VISUALS: Record<AgentRole, { icon: string; color: string; displayName: string }> = {
  architect: { icon: "🧠", color: "#8b5cf6", displayName: "Architect" },
  builder: { icon: "⚛️", color: "#22c55e", displayName: "Frontend" },
  reviewer: { icon: "🔍", color: "#3b82f6", displayName: "Reviewer" },
  security: { icon: "🛡️", color: "#ef4444", displayName: "Security" },
  qa: { icon: "🐛", color: "#f59e0b", displayName: "QA Tester" },
  docs: { icon: "📖", color: "#06b6d4", displayName: "Docs" },
};

export class AgentSwarmRenderer {
  public render(container: HTMLElement, agents: AgentDefinition[], snapshot: OrchestratorSnapshot): void {
    const isRunning = snapshot.tasks.some(t => t.status === "running");
    const activeTasks = snapshot.tasks.filter(t => t.status === "running" || t.status === "failed" || t.status === "cancelled");
    const fileLocks = snapshot.locks;

    container.innerHTML = `
      <style>
        .ocl-swarm-dashboard {
          background: #09090b;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 24px;
          font-family: 'Inter', system-ui, sans-serif;
          color: #f8fafc;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .ocl-swarm-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .ocl-swarm-title {
          font-size: 18px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .ocl-kill-switch {
          background: #ef4444;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          transition: background 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .ocl-kill-switch:hover:not(:disabled) {
          background: #dc2626;
        }

        .ocl-kill-switch:disabled {
          background: #7f1d1d;
          color: #fca5a5;
          cursor: not-allowed;
          opacity: 0.7;
        }

        .ocl-swarm-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }

        .ocl-agent-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          transition: all 0.3s;
        }

        .ocl-agent-card.active {
          border-color: var(--agent-color);
          box-shadow: 0 0 15px rgba(var(--agent-color-rgb), 0.2);
        }

        .ocl-agent-card.error {
          border-color: #ef4444;
        }

        .ocl-agent-header {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .ocl-agent-icon {
          font-size: 24px;
          width: 40px;
          height: 40px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .ocl-agent-card.active .ocl-agent-icon::after {
          content: "";
          position: absolute;
          inset: -2px;
          border-radius: 10px;
          border: 2px solid var(--agent-color);
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.2); opacity: 0; }
        }

        .ocl-agent-info {
          display: flex;
          flex-direction: column;
        }

        .ocl-agent-name {
          font-weight: 600;
          font-size: 14px;
        }

        .ocl-agent-status {
          font-size: 11px;
          text-transform: uppercase;
          font-weight: 700;
          color: #94a3b8;
        }

        .ocl-agent-card.active .ocl-agent-status {
          color: var(--agent-color);
        }

        .ocl-agent-card.error .ocl-agent-status {
          color: #ef4444;
        }

        .ocl-task-log {
          background: #000;
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 6px;
          padding: 12px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          color: #10b981;
          min-height: 100px;
          max-height: 200px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .ocl-task-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding-bottom: 8px;
          border-bottom: 1px dashed rgba(255, 255, 255, 0.1);
        }

        .ocl-task-item:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .ocl-task-title {
          color: #f8fafc;
        }

        .ocl-task-item.status-failed .ocl-task-title {
          color: #ef4444;
        }

        .ocl-task-item.status-cancelled .ocl-task-title {
          color: #f59e0b;
        }

        .ocl-file-locks {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .ocl-file-lock {
          background: rgba(239, 68, 68, 0.1);
          color: #fca5a5;
          border: 1px solid rgba(239, 68, 68, 0.2);
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-family: 'JetBrains Mono', monospace;
          display: flex;
          align-items: center;
          gap: 4px;
        }
      </style>

      <div class="ocl-swarm-dashboard">
        <div class="ocl-swarm-header">
          <div class="ocl-swarm-title">
            <span>🌐</span>
            AGI Swarm 
            <span style="font-size: 12px; font-weight: normal; color: #94a3b8; margin-left: 8px;">
              ${snapshot.activePlan ? "Autopilot Mode" : "Idle"}
            </span>
          </div>
          <button class="ocl-kill-switch" id="ocl-btn-kill-switch" ${!isRunning ? 'disabled' : ''}>
            🛑 KILL SWITCH
          </button>
        </div>

        <div class="ocl-file-locks">
          ${fileLocks.map(l => `
            <div class="ocl-file-lock">
              🔒 ${l.path} (${AGENT_VISUALS[l.agentRole]?.displayName || l.agentRole})
            </div>
          `).join('')}
        </div>

        <div class="ocl-swarm-grid">
          ${agents.map(agent => {
            const visual = AGENT_VISUALS[agent.role] || { icon: "🤖", color: "#71717a", displayName: agent.role };
            const runningTask = snapshot.tasks.find(t => t.agentRole === agent.role && t.status === "running");
            const failedTask = snapshot.tasks.find(t => t.agentRole === agent.role && t.status === "failed");
            const cancelledTask = snapshot.tasks.find(t => t.agentRole === agent.role && t.status === "cancelled");
            
            let status = "idle";
            let statusClass = "";
            let rgb = "113, 113, 122";

            if (runningTask) {
              status = "running";
              statusClass = "active";
            } else if (failedTask) {
              status = "error";
              statusClass = "error";
            } else if (cancelledTask) {
              status = "cancelled";
              statusClass = "error";
            }

            if (visual.color === "#8b5cf6") rgb = "139, 92, 246";
            if (visual.color === "#22c55e") rgb = "34, 197, 94";
            if (visual.color === "#3b82f6") rgb = "59, 130, 246";
            if (visual.color === "#ef4444") rgb = "239, 68, 68";
            if (visual.color === "#f59e0b") rgb = "245, 158, 11";
            if (visual.color === "#06b6d4") rgb = "6, 182, 212";

            return `
              <div class="ocl-agent-card ${statusClass}" style="--agent-color: ${visual.color}; --agent-color-rgb: ${rgb}">
                <div class="ocl-agent-header">
                  <div class="ocl-agent-icon">${visual.icon}</div>
                  <div class="ocl-agent-info">
                    <span class="ocl-agent-name">${visual.displayName}</span>
                    <span class="ocl-agent-status">${status}</span>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        ${activeTasks.length > 0 ? `
          <div class="ocl-task-log">
            ${activeTasks.map(t => `
              <div class="ocl-task-item status-${t.status}">
                <div class="ocl-task-title">> [${AGENT_VISUALS[t.agentRole]?.displayName || t.agentRole}] ${t.title}</div>
                <div style="color: #64748b; margin-left: 12px;">Estado: ${t.status} | Iteraciones: ${t.iterationsUsed || 0}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }
}
