import type { EventHandlerContext } from "./event-handlers";
import { logger } from "../utils/logger";
import { t } from "../i18n/translate";
import { escapeHtml } from "../ui/utils/format";
import {
  renderAuthOverlay,
  renderAppTitlebar,
  renderMarketplaceOverlay,
  renderAuditOverlay,
  renderSettingsOverlay,
  renderUpgradeModal,
  renderSidebarSanoShield,
  renderRepoCard,
  renderCentralShell,
} from "./ui-renderers";
import type { AgentTask } from "../agents/types";
import type { AuditEvent } from "../audit.service";

export function renderMainLayout(ctx: EventHandlerContext): void {
  const { model } = ctx;
  const appEl = document.querySelector<HTMLDivElement>("#app");
  if (!appEl) {
    logger.error('AppLifecycle', '#app element not found in DOM');
    return;
  }

  appEl.innerHTML = `
    <main class="ide-container" aria-label="${t("appShell.sidebarAria")}">
      <div class="background-glow background-glow--violet"></div>
      <div class="background-glow background-glow--blue"></div>
      <div id="auth-root">${renderAuthOverlay(model.get("authMode"), model.get("authError"), model.get("authSubmitting"))}</div>
      <div id="onboarding-root"></div>
      ${renderAppTitlebar(model.get("activeRepoScan"), ctx.sessionUsageService.getSnapshot(), model.get("currentSession"))}

      <aside class="global-sidebar" aria-label="${t("navigation.global")}">
        <a class="brand-mark" href="#" aria-label="${t("appShell.brandName")}">
          <svg class="brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>
        </a>
        <nav class="nav-stack">
          <button data-tooltip="Home | Return to the main dashboard" title="${t("appShell.homeTitle")}" data-short="${t("common.home")}" type="button">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            <span>${t("common.home")}</span>
          </button>
          <button class="active" data-tooltip="Workspace | Your active project and editor" title="${t("appShell.workspaceTitle")}" data-short="${t("common.wrk")}" type="button">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
            <span>${t("common.workspace")}</span>
          </button>
          <button data-tooltip="Repository | Browse and manage your files" title="${t("appShell.repoTitle")}" data-short="${t("common.repo")}" type="button">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            <span>${t("common.repo")}</span>
          </button>
          <button id="kanban-nav-button" data-tooltip="Tasks | Kanban board for task management" title="${t("appShell.kanbanTitle")}" data-short="${t("common.tasks")}" type="button">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            <span>${t("common.tasks")}</span>
          </button>
          <button id="audit-nav-button" data-tooltip="Activity | Audit log of all actions" title="${t("appShell.activityTitle")}" data-short="${t("common.act")}" type="button">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
            <span>${t("common.activity")}</span>
          </button>
          <button data-tooltip="Models | Configure AI model providers" title="${t("appShell.modelsTitle")}" data-short="${t("common.mod")}" type="button">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path></svg>
            <span>${t("navigation.models")}</span>
          </button>
          <button id="marketplace-nav-button" data-tooltip="Skills | Install AI skill packs from the marketplace" data-testid="marketplace-button" class="with-badge" title="${t("appShell.skillsTitle")}" data-short="${t("common.skl")}" type="button">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
            <span>${t("common.skills")}</span><small>${t("navigation.new")}</small>
          </button>
        </nav>
        <button class="settings-button" data-tooltip="Settings | Configure shortcuts, keys, and preferences" data-testid="settings-button" title="${t("appShell.settingsTitle")}" data-short="${t("common.cfg")}" type="button">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          <span>${t("common.settings")}</span>
        </button>
      </aside>
      <div id="marketplace-root">${renderMarketplaceOverlay(model.get("marketplaceOpen"), model.get("onboardingOpen"), model.get("suggestedSkill"), model.get("marketplaceTab"), model.get("marketplaceSnapshot"), model.get("marketplaceDownloads"), model.get("marketplaceSearchQuery"), model.get("enterpriseSkills"))}</div>
      <div id="installation-progress-root"></div>
      <div id="audit-root">${renderAuditOverlay(model.get("auditOpen"), model.get("currentSession"), model.get("auditSnapshot"))}</div>
      <div id="settings-root">${renderSettingsOverlay(model.get("settingsOpen"), model.get("currentSession"), ctx.sessionUsageService.getSnapshot(), model.get("updateStatus"), model.get("byokKeys"), "", "")}</div>
      <div id="upgrade-root">${renderUpgradeModal(model.get("upgradeModalFeature"))}</div>
      <section class="workspace-panel scroll-area" aria-label="${t("workspace.workspacesAndProfiles")}">
        <div class="workspace-panel-inner">
          <article class="premium-status-card">
            <div class="status-indicator"></div>
            <div>
              <strong>Workspace ready</strong>
              <span>System fully initialized</span>
            </div>
            <button class="icon-btn" type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 16 16 12 12 8"></polyline><line x1="8" y1="12" x2="16" y2="12"></line></svg>
            </button>
          </article>

          ${renderSidebarSanoShield()}

          <article class="premium-skillpack-card">
            <header>
              <span>Active Skillpack</span>
              <div class="skillpack-badge">Backend</div>
            </header>
            <p>Oclushion is currently optimized for Node.js, Express, and Database development.</p>
          </article>

          <section id="repo-card" class="repo-card" data-testid="repo-card">
            ${renderRepoCard(model.get("activeRepoScan"), model.get("collapsedDirectories"))}
          </section>
        </div>
      </section>

      <section id="central-shell" class="editor-shell" data-testid="central-shell" aria-label="${t("workspace.centralEditor")}">
        ${renderCentralShell(model.get("kanbanOpen"), model.get("activeRepoScan"), model.get("collapsedDirectories"), model.get("kanbanTasks"), model.get("safeDiffProposals"), ctx.editorController.getOpenFiles(), ctx.editorController.getActiveFile()?.path ?? null)}
      </section>

      <aside class="ai-panel scroll-area with-chat-history" aria-label="${t("chat.panel")}">
        <div id="chat-sidebar-root" data-testid="chat-sidebar-root" hidden></div>
        <div class="chat-main-column best-right-rail">
          <header class="right-tabs">
            <button class="active" type="button">${t("rightPanel.aiWorkspace")}</button>
            <button type="button">${t("rightPanel.context")}</button>
          </header>

          <section class="right-section active-agents" data-testid="active-agents">
            <header><h3>${t("rightPanel.activeAgents")}</h3><span>${model.get("agentSnapshot").tasks.filter((a: AgentTask) => a.status === "running").length}/${model.get("agentSnapshot").tasks.length || 5}</span></header>
            ${model.get("agentSnapshot").tasks.length
              ? model.get("agentSnapshot").tasks.map((task: AgentTask) => `
                <article class="${task.status}"><i>${task.agentRole.slice(0, 3).toUpperCase()}</i><div><strong>${escapeHtml(task.agentRole)}</strong><small>${escapeHtml(task.title)}</small></div><span>${task.status === "running" ? t("rightPanel.agentRunning") : task.status === "completed" ? t("rightPanel.agentScanning") : t("rightPanel.agentIdle")}</span></article>
              `).join("")
              : `<article><i>OPS</i><div><strong>DevOps Agent</strong><small>CI/CD, Infra</small></div><span>${t("rightPanel.agentIdle")}</span></article>`
            }
            <button id="add-agent-button" type="button">${t("common.addAgent")}</button>
          </section>

          <section class="right-section usage-card">
            <header><h3>${t("rightPanel.usageCost")}</h3><button id="titlebar-settings-button-secondary" type="button">${t("common.thisSession")}</button></header>
            <div class="usage-row"><span>${t("common.tokens")}</span><strong>${ctx.sessionUsageService.getSnapshot().tokensSent > 0 ? (ctx.sessionUsageService.getSnapshot().tokensSent / 1000).toFixed(0) + "K" : "0"} / 2.0M</strong></div>
            <div class="usage-meter"><span style="width: ${Math.min(100, (ctx.sessionUsageService.getSnapshot().tokensSent / 2000000) * 100)}%"></span></div>
            <div class="usage-row"><span>${t("common.credits")}</span><strong>${model.get("agentSnapshot").totalCreditsUsed}</strong></div>
            <div class="usage-row"><span>${t("common.spend")}</span><strong>$${(ctx.sessionUsageService.getSnapshot().creditsUsed * 0.001).toFixed(2)}</strong></div>
            <button id="right-settings-button" type="button">${t("common.manageLimitsAlerts")}</button>
          </section>

          <section class="right-section fast-apply-card">
            <h3>${t("rightPanel.fastApply")}</h3>
            <p>${t("rightPanel.fastApplyDescription")}</p>
            <button type="button">${t("common.reviewApply")}</button>
          </section>

          <section class="right-section activity-card">
            <header><h3>${t("rightPanel.activity")}</h3><button id="right-audit-button" type="button">${t("common.viewAll")}</button></header>
            ${model.get("auditSnapshot").events.slice(-3).reverse().map((event: AuditEvent) => `
              <article><span class="${event.type === "CODE_APPROVED" ? "ok" : ""}"></span><strong>${escapeHtml(event.summary)}</strong><small>${new Date(event.timestamp).toLocaleTimeString()}</small></article>
            `).join("") || `<article><span class="ok"></span><strong>System ready</strong><small>${t("common.now")}</small></article>`}
          </section>

          <section class="right-section git-section" id="git-section">
            <header><h3>${t("git.section")}</h3><span id="git-branch-name">${t("git.branch")}</span></header>
            <div class="git-actions">
              <button id="git-refresh-btn" type="button" title="${t("git.refresh")}">↻</button>
              <button id="git-commit-btn" type="button" title="${t("git.commit")}">${t("git.commit")}</button>
              <button id="git-log-btn" type="button" title="${t("git.log")}">${t("git.log")}</button>
            </div>
            <div id="git-status-list" class="git-status-list"><small>${t("git.noRepoOpen")}</small></div>
          </section>

          <section class="right-section test-section" id="test-section">
            <header><h3>${t("test.section")}</h3><span id="test-framework-name">-</span></header>
            <div class="test-actions">
              <button id="test-run-btn" type="button" title="${t("test.run")}">▶ ${t("test.run")}</button>
              <button id="test-detect-btn" type="button" title="${t("test.detect")}">🔍 ${t("test.detect")}</button>
            </div>
            <div id="test-results" class="test-results"><small>${t("test.resultsPlaceholder")}</small></div>
          </section>

          <label class="field hidden-control">
            <span>${t("chat.model")}</span>
            <select id="model-selector" aria-label="${t("chat.modelSelector")}">
              <option value="gpt-5.5">GPT-5.5</option>
              <option value="gpt-5.4-mini">GPT-5.4 mini</option>
              <option value="claude-opus-4-8">Claude Opus 4.8</option>
              <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
              <option value="ollama/llama3">Ollama (Local)</option>
              <option value="lmstudio/local">LM Studio (Local)</option>
              <option value="custom">${t("chat.customModel")}</option>
            </select>
            <input id="custom-model-input" type="text" placeholder="${t("chat.customModelPlaceholder")}" />
          </label>
          <footer class="chat-box hidden-control">
            <label for="chat-input">${t("chat.label")}</label>
            <div id="chat-thread" class="chat-thread" aria-live="polite"></div>
            <div>
              <input id="chat-input" type="text" data-tooltip="Chat Input | Type a message for the AI assistant" placeholder="${t("chat.placeholder")}" />
              <button id="chat-send-button" data-tooltip="Send | Submit your message to the AI" type="button">${t("common.send")}</button>
            </div>
          </footer>
        </div>
      </aside>
      <div id="terminal-panel-root" data-testid="terminal-panel-root"></div>
      <div class="terminal-bottom-bar">
        <button id="terminal-toggle-button" class="terminal-toggle" type="button" title="${t("workspace.toggleTerminal")}" data-shortcut="Ctrl+\`">>_</button>
      </div>
    </main>
  `;
}