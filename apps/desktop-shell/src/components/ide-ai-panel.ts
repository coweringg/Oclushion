import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { getModel } from "../app/model-provider";
import { t } from "../i18n/translate";
import { escapeHtml } from "../ui/utils/format";
import type { AppModel } from "../app/state-manager";
import type { AgentTask } from "../agents/types";
import type { AuditEvent } from "../audit.service";

@customElement("ide-ai-panel")
export class IdeAiPanel extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }
  `;

  @property({ type: Number })
  tokensSent = 0;

  @property({ type: Number })
  creditsUsed = 0;

  private _model = getModel();
  private _unsubs: Array<() => void> = [];

  private get _agentSnapshot() {
    return this._model.get("agentSnapshot");
  }

  private get _auditSnapshot() {
    return this._model.get("auditSnapshot");
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this._unsubs = [
      this._model.subscribe("agentSnapshot", () => this.requestUpdate()),
      this._model.subscribe("auditSnapshot", () => this.requestUpdate()),
    ];
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._unsubs.forEach((fn) => fn());
    this._unsubs = [];
  }

  protected override createRenderRoot() {
    return this;
  }

  override render() {
    const agents = this._agentSnapshot;
    const audit = this._auditSnapshot;
    const tasks = agents.tasks ?? [];
    const runningCount = tasks.filter((a: AgentTask) => a.status === "running").length;
    const totalCount = tasks.length || 5;

    return html`
      <aside class="ai-panel scroll-area with-chat-history" aria-label="${t("chat.panel")}">
        <div id="chat-sidebar-root" data-testid="chat-sidebar-root" hidden></div>
        <div class="chat-main-column best-right-rail">
          <header class="right-tabs">
            <button class="active" type="button">${t("rightPanel.aiWorkspace")}</button>
            <button type="button">${t("rightPanel.context")}</button>
          </header>

          <section class="right-section active-agents" data-testid="active-agents">
            <header><h3>${t("rightPanel.activeAgents")}</h3><span>${runningCount}/${totalCount}</span></header>
            ${tasks.length
              ? tasks.map((task: AgentTask) => html`
                <article class="${task.status}"><i>${task.agentRole.slice(0, 3).toUpperCase()}</i><div><strong>${escapeHtml(task.agentRole)}</strong><small>${escapeHtml(task.title)}</small></div><span>${task.status === "running" ? t("rightPanel.agentRunning") : task.status === "completed" ? t("rightPanel.agentScanning") : t("rightPanel.agentIdle")}</span></article>
              `)
              : html`<article><i>OPS</i><div><strong>DevOps Agent</strong><small>CI/CD, Infra</small></div><span>${t("rightPanel.agentIdle")}</span></article>`
            }
            <button id="add-agent-button" type="button">${t("common.addAgent")}</button>
          </section>

          <section class="right-section usage-card">
            <header><h3>${t("rightPanel.usageCost")}</h3><button id="titlebar-settings-button-secondary" type="button">${t("common.thisSession")}</button></header>
            <div class="usage-row"><span>${t("common.tokens")}</span><strong>${this.tokensSent > 0 ? (this.tokensSent / 1000).toFixed(0) + "K" : "0"} / 2.0M</strong></div>
            <div class="usage-meter"><span style="width: ${Math.min(100, (this.tokensSent / 2000000) * 100)}%"></span></div>
            <div class="usage-row"><span>${t("common.credits")}</span><strong>${agents.totalCreditsUsed}</strong></div>
            <div class="usage-row"><span>${t("common.spend")}</span><strong>$${(this.creditsUsed * 0.001).toFixed(2)}</strong></div>
            <button id="right-settings-button" type="button">${t("common.manageLimitsAlerts")}</button>
          </section>

          <section class="right-section fast-apply-card">
            <h3>${t("rightPanel.fastApply")}</h3>
            <p>${t("rightPanel.fastApplyDescription")}</p>
            <button type="button">${t("common.reviewApply")}</button>
          </section>

          <section class="right-section activity-card">
            <header><h3>${t("rightPanel.activity")}</h3><button id="right-audit-button" type="button">${t("common.viewAll")}</button></header>
            ${(audit.events ?? []).slice(-3).reverse().map((event: AuditEvent) => html`
              <article><span class="${event.type === "CODE_APPROVED" ? "ok" : ""}"></span><strong>${escapeHtml(event.summary)}</strong><small>${new Date(event.timestamp).toLocaleTimeString()}</small></article>
            `) || html`<article><span class="ok"></span><strong>System ready</strong><small>${t("common.now")}</small></article>`}
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
          <ide-chat-box></ide-chat-box>
        </div>
      </aside>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ide-ai-panel": IdeAiPanel;
  }
}
