import type { OrchestratorSnapshot } from "../../agents/types";
import type { WorklogEntry } from "../../agents/worklog.service";
import { escapeHtml, formatAgentTaskStatus, formatElapsed } from "../utils/format";

type Translate = (key: string) => string;

type AgentProgressRenderInput = {
  snapshot: OrchestratorSnapshot;
  worklogEntries: WorklogEntry[];
  translate: Translate;
};

export function renderAgentProgress({ snapshot, worklogEntries, translate }: AgentProgressRenderInput): string {
  const tasks = snapshot.tasks;
  if (!snapshot.activePlan && !tasks.length) {
    return `
      <section class="agent-progress">
        <h2>${translate("agent.title")}</h2>
        <p>${translate("agent.idle")}</p>
        <button id="run-agent-workflow-button" type="button">${translate("agent.run")}</button>
        <div id="worklog-root">${renderWorklogPanel(worklogEntries, translate)}</div>
      </section>
    `;
  }

  return `
    <section class="agent-progress active">
      <h2>${translate("agent.session")}</h2>
      <p>${escapeHtml(snapshot.activePlan?.userRequest ?? translate("agent.lastCompleted"))}</p>
      <ul>
        ${tasks
          .map(
            (task) => `<li class="${task.status}">
              <span>${task.status === "completed" ? translate("agent.statusDone") : task.status === "running" ? translate("agent.statusRun") : translate("agent.statusWait")}</span>
              <strong>${task.agentRole}</strong>
              <small>${formatAgentTaskStatus(task)}${task.creditsUsed ? ` - ${task.creditsUsed} ${translate("kanban.credits")}` : ""}</small>
            </li>`,
          )
          .join("")}
      </ul>
      <footer>
        <span>${snapshot.totalCreditsUsed} ${translate("kanban.credits")}</span>
        <button id="cancel-agent-session-button" type="button">${translate("common.cancel")}</button>
      </footer>
      <div id="worklog-root">${renderWorklogPanel(worklogEntries, translate)}</div>
    </section>
  `;
}

export function renderWorklogPanel(entries: WorklogEntry[], translate: Translate): string {
  return `
    <details class="worklog-panel" open>
      <summary>
        <span>${translate("agent.worklogTitle")}</span>
        <small>${entries.length} ${translate("common.events")}</small>
      </summary>
      <ol class="worklog-list">
        ${entries.length ? entries.slice(-40).map(renderWorklogEntry).join("") : `<li class="worklog-empty">${translate("agent.worklogEmpty")}</li>`}
      </ol>
    </details>
  `;
}

function renderWorklogEntry(entry: WorklogEntry): string {
  return `
    <li class="worklog-entry ${entry.category}">
      <span class="worklog-icon">${entry.icon}</span>
      <div>
        <p>${escapeHtml(entry.message)}</p>
        ${entry.durationMs ? `<small>${formatElapsed(entry.durationMs)}</small>` : ""}
        ${entry.detail ? `<code>${escapeHtml(entry.detail)}</code>` : ""}
      </div>
      <time>${new Date(entry.timestamp).toLocaleTimeString()}</time>
    </li>
  `;
}
