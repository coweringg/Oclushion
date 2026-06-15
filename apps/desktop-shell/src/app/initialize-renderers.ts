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
  renderBestSkillpackList,
  renderRepoCard,
  renderCentralShell,
} from "./ui-renderers";
import { renderOnboardingProgress } from "../onboarding/onboarding-progress";
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
        <a class="brand-mark" href="#" aria-label="${t("navigation.home")}">
          <span>${t("appShell.brandName")}</span>
        </a>
        <nav class="nav-stack">
          <button data-tooltip="Home | Return to the main dashboard" title="${t("appShell.homeTitle")}" data-short="${t("common.home")}" type="button"><span>${t("common.home")}</span></button>
          <button class="active" data-tooltip="Workspace | Your active project and editor" title="${t("appShell.workspaceTitle")}" data-short="${t("common.wrk")}" type="button"><span>${t("common.workspace")}</span></button>
          <button data-tooltip="Repository | Browse and manage your files" title="${t("appShell.repoTitle")}" data-short="${t("common.repo")}" type="button"><span>${t("common.repo")}</span></button>
          <button id="kanban-nav-button" data-tooltip="Tasks | Kanban board for task management" title="${t("appShell.kanbanTitle")}" data-short="${t("common.tasks")}" type="button"><span>${t("common.tasks")}</span></button>
          <button id="audit-nav-button" data-tooltip="Activity | Audit log of all actions" title="${t("appShell.activityTitle")}" data-short="${t("common.act")}" type="button"><span>${t("common.activity")}</span></button>
          <button data-tooltip="Models | Configure AI model providers" title="${t("appShell.modelsTitle")}" data-short="${t("common.mod")}" type="button"><span>${t("navigation.models")}</span></button>
          <button id="marketplace-nav-button" data-tooltip="Skills | Install AI skill packs from the marketplace" data-testid="marketplace-button" class="with-badge" title="${t("appShell.skillsTitle")}" data-short="${t("common.skl")}" type="button"><span>${t("common.skills")}</span><small>${t("navigation.new")}</small></button>
        </nav>
        <button class="settings-button" data-tooltip="Settings | Configure shortcuts, keys, and preferences" data-testid="settings-button" title="${t("appShell.settingsTitle")}" data-short="${t("common.cfg")}" type="button"><span>${t("common.settings")}</span></button>
      </aside>
      <div id="marketplace-root">${renderMarketplaceOverlay(model.get("marketplaceOpen"), model.get("onboardingOpen"), model.get("suggestedSkill"), model.get("marketplaceTab"), model.get("marketplaceSnapshot"), model.get("marketplaceDownloads"), model.get("marketplaceSearchQuery"), model.get("enterpriseSkills"))}</div>
      <div id="installation-progress-root"></div>
      <div id="audit-root">${renderAuditOverlay(model.get("auditOpen"), model.get("currentSession"), model.get("auditSnapshot"))}</div>
      <div id="settings-root">${renderSettingsOverlay(model.get("settingsOpen"), model.get("currentSession"), ctx.sessionUsageService.getSnapshot(), model.get("updateStatus"), model.get("byokKeys"), "", "")}</div>
      <div id="upgrade-root">${renderUpgradeModal(model.get("upgradeModalFeature"))}</div>
      <section class="workspace-panel scroll-area" aria-label="${t("workspace.workspacesAndProfiles")}">
        <article class="plan-card glass-card">
          <div class="plan-icon">${t("common.pro")}</div>
          <div>
            <strong id="plan-name">${t("session.loadingPlan")}</strong>
            <span id="plan-renewal">${t("session.checkingSession")}</span>
          </div>
          <button id="sign-in-button" data-tooltip="Sign In | Authenticate to unlock premium features" type="button">${t("session.signIn")}</button>
        </article>

        <header class="panel-heading">
          <span>${t("workspace.profiles")}</span>
          <div>
            <span id="active-skillpack-badge" class="active-skillpack-badge">Backend</span>
            <button id="workspace-open-skillpacks-button" title="${t("common.manageSkillpacks")}" type="button">+</button>
          </div>
        </header>
        <div id="profile-list" class="profile-list best-profiles">${renderBestSkillpackList(ctx.skillpackManager.listInstalled())}</div>

        <button id="reset-skillpack-button" class="reset-card" type="button">
          <span>${t("common.sync")}</span>
          <strong>${t("workspace.reset")}</strong>
          <small id="reset-plan-copy">${t("workspace.resetCopy")}</small>
        </button>

        <section id="repo-card" class="repo-card" data-testid="repo-card">${renderRepoCard(model.get("activeRepoScan"), model.get("collapsedDirectories"))}</section>
        ${renderOnboardingProgress(ctx.onboardingService)}
        ${renderSidebarSanoShield()}

        <footer class="workspace-footer">
          <span id="mini-plan" class="mini-plan">${t("workspace.plan")}</span>
          <span>${t("workspace.v123")}</span>
        </footer>
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
            <header><h3>Git</h3><span id="git-branch-name">main</span></header>
            <div class="git-actions">
              <button id="git-refresh-btn" type="button" title="Refresh">↻</button>
              <button id="git-commit-btn" type="button" title="Commit">Commit</button>
              <button id="git-log-btn" type="button" title="Log">Log</button>
            </div>
            <div id="git-status-list" class="git-status-list"><small>No repo open</small></div>
          </section>

          <section class="right-section test-section" id="test-section">
            <header><h3>Tests</h3><span id="test-framework-name">-</span></header>
            <div class="test-actions">
              <button id="test-run-btn" type="button" title="Run tests">▶ Run</button>
              <button id="test-detect-btn" type="button" title="Detect framework">🔍 Detect</button>
            </div>
            <div id="test-results" class="test-results"><small>Run tests to see results</small></div>
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