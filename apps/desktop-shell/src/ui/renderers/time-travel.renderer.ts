import type { AgentTask } from "../../agents/types";

export type TimeTravelState = {
  tasks: AgentTask[];
  selectedTaskId: string | null;
};

export class TimeTravelRenderer {
  public render(container: HTMLElement, state: TimeTravelState): void {
    if (state.tasks.length === 0) {
      container.innerHTML = '';
      return;
    }

    const existingStyle = document.getElementById("ocl-time-travel-style");
    if (!existingStyle) {
      const style = document.createElement("style");
      style.id = "ocl-time-travel-style";
      style.textContent = `
        .ocl-tt-container {
          background-color: var(--color-bg-darker, #181818);
          border-bottom: 1px solid var(--color-border, #333);
          padding: 12px 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .ocl-tt-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .ocl-tt-title {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #858585;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .ocl-tt-timeline {
          display: flex;
          align-items: center;
          gap: 0;
          overflow-x: auto;
          padding: 8px 0;
          scrollbar-width: none; 
        }
        .ocl-tt-timeline::-webkit-scrollbar {
          display: none; 
        }

        .ocl-tt-node-container {
          display: flex;
          align-items: center;
          position: relative;
        }

        .ocl-tt-line {
          width: 32px;
          height: 2px;
          background-color: #333;
        }
        
        .ocl-tt-line.completed {
          background-color: #007acc;
        }

        .ocl-tt-node {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background-color: #1e1e1e;
          border: 2px solid #333;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }

        .ocl-tt-node.completed {
          border-color: #007acc;
          background-color: rgba(0, 122, 204, 0.2);
          color: #007acc;
        }

        .ocl-tt-node.running {
          border-color: #cca700;
          background-color: rgba(204, 167, 0, 0.2);
          color: #cca700;
          box-shadow: 0 0 0 3px rgba(204, 167, 0, 0.1);
        }

        .ocl-tt-node.cancelled {
          border-color: #f14c4c;
          opacity: 0.5;
        }

        .ocl-tt-node:hover {
          transform: scale(1.1);
        }

        .ocl-tt-node.selected {
          box-shadow: 0 0 0 3px rgba(0, 122, 204, 0.3);
        }

        .ocl-tt-tooltip {
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          margin-top: 8px;
          background: #252526;
          border: 1px solid #454545;
          padding: 6px 10px;
          border-radius: 4px;
          font-size: 11px;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.2s;
          z-index: 10;
        }

        .ocl-tt-node:hover .ocl-tt-tooltip {
          opacity: 1;
        }

        .ocl-tt-fork-panel {
          margin-top: 8px;
          background: rgba(0, 122, 204, 0.1);
          border: 1px solid rgba(0, 122, 204, 0.3);
          border-radius: 6px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          animation: slideDown 0.2s ease-out;
        }

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .ocl-tt-fork-input {
          background: #1e1e1e;
          border: 1px solid #333;
          color: #ccc;
          padding: 8px;
          border-radius: 4px;
          font-family: inherit;
          font-size: 12px;
          resize: vertical;
          min-height: 40px;
        }

        .ocl-tt-fork-input:focus {
          outline: none;
          border-color: #007acc;
        }

        .ocl-tt-fork-btn {
          align-self: flex-end;
          background: #007acc;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
        }

        .ocl-tt-fork-btn:hover {
          background: #005999;
        }
      `;
      document.head.appendChild(style);
    }

    const timelineHtml = state.tasks.map((task, index) => {
      const isFirst = index === 0;
      const prevTask = isFirst ? null : state.tasks[index - 1];
      const isLineCompleted = prevTask && (prevTask.status === "completed" || prevTask.status === "running");
      
      const isSelected = state.selectedTaskId === task.id;
      const roleInitial = task.agentRole.charAt(0).toUpperCase();

      return `
        <div class="ocl-tt-node-container">
          ${!isFirst ? `<div class="ocl-tt-line ${isLineCompleted ? 'completed' : ''}"></div>` : ''}
          <div class="ocl-tt-node ${task.status} ${isSelected ? 'selected' : ''}" data-task="${task.id}">
            ${roleInitial}
            <div class="ocl-tt-tooltip">
              <strong>${task.agentRole}</strong><br/>
              ${task.status}<br/>
              <span style="color: #858585">${task.title}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    let forkPanelHtml = '';
    if (state.selectedTaskId) {
      const selectedTask = state.tasks.find(t => t.id === state.selectedTaskId);
      if (selectedTask && (selectedTask.status === "completed" || selectedTask.status === "running")) {
        forkPanelHtml = `
          <div class="ocl-tt-fork-panel">
            <div style="font-size: 12px; color: #ccc;">
              <strong>Rewind & Fork from this step</strong><br/>
              <span style="color: #858585">Future steps will be discarded. The workspace state will be atomically restored.</span>
            </div>
            <textarea class="ocl-tt-fork-input" placeholder="e.g. 'Desde aquí, usa Postgres en vez de MongoDB...'"></textarea>
            <button class="ocl-tt-fork-btn" data-action="rewind" data-task="${selectedTask.id}">Fork Timeline</button>
          </div>
        `;
      }
    }

    container.innerHTML = `
      <div class="ocl-tt-container">
        <div class="ocl-tt-header">
          <div class="ocl-tt-title">
            <span>⏳</span> Time-Travel Debugging
          </div>
        </div>
        <div class="ocl-tt-timeline">
          ${timelineHtml}
        </div>
        ${forkPanelHtml}
      </div>
    `;
  }
}
