import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { t } from "../i18n/translate";
import { escapeHtml, formatTokenCount } from "../ui/utils/format";
import type { SessionUsageSnapshot } from "../billing/session-usage.service";

@customElement("ide-settings-overlay")
export class IdeSettingsOverlay extends LitElement {
  @property({ type: Boolean, reflect: true })
  open = false;

  @property({ type: String })
  plan = "Free";

  @property({ type: String })
  updateStatus = "";

  @property({ type: Object })
  byokKeys: { openai?: string; anthropic?: string } = {};

  @property({ type: Object })
  usage: SessionUsageSnapshot | null = null;

  @property({ type: String })
  currentSessionJson = "";

  @property({ type: String })
  mcpSettingsHtml = "";

  @property({ type: String })
  languageSwitcherHtml = "";

  protected override createRenderRoot() {
    return this;
  }

  private get _hasSession(): boolean {
    return this.currentSessionJson !== "" && this.currentSessionJson !== "null";
  }

  private get _creditsReady(): string {
    return this._hasSession ? t("settings.creditsReady") : t("settings.creditsSignIn");
  }

  override render() {
    if (!this.open) {
      return html``;
    }

    return html`
      <section id="settings-overlay" class="audit-overlay" role="dialog" aria-modal="true" aria-label="${t("settings.aria")}">
        <div class="audit-panel settings-panel">
          <header>
            <div>
              <span>${t("settings.eyebrow")}</span>
              <h2>${t("settings.title")}</h2>
              <p>${t("settings.description")}</p>
            </div>
            <button id="settings-close-button" type="button" aria-label="${t("common.close")}">${t("common.close")}</button>
          </header>
          <div class="settings-grid">
            <article class="settings-card full-span">
              <span>${t("settings.language")}</span>
              <h3>${t("settings.language")}</h3>
              ${unsafeHTML(this.languageSwitcherHtml)}
            </article>
            <article class="settings-card full-span">
              <span>${t("settings.updates")}</span>
              <h3>${t("settings.updater")}</h3>
              <p>${escapeHtml(this.updateStatus)}</p>
              ${this.updateStatus.indexOf(t("common.update") + " ") === 0
                ? html`<button id="install-update-button" class="marketplace-action" type="button">${t("common.updaterInstall")}</button>`
                : ""}
            </article>
            <article class="settings-card">
              <span>${t("settings.optionA")}</span>
              <h3>${t("settings.byok")}</h3>
              <p>${t("settings.byokCopy")}</p>
              <label class="field">
                <span>${t("settings.openaiKey")}</span>
                <input id="openai-key-input" type="password" placeholder="sk-..." .value=${this.byokKeys.openai ?? ""} autocomplete="off" />
              </label>
              <label class="field">
                <span>${t("settings.anthropicKey")}</span>
                <input id="anthropic-key-input" type="password" placeholder="sk-ant-..." .value=${this.byokKeys.anthropic ?? ""} autocomplete="off" />
              </label>
              <label class="field">
                <span>${t("settings.ollamaUrl")}</span>
                <input id="ollama-url-input" type="text" placeholder="http://localhost:11434" .value=${""} />
              </label>
              <button id="save-byok-button" class="marketplace-action" type="button">${t("settings.saveKeys")}</button>
            </article>
            <article class="settings-card">
              <span>${t("settings.optionB")}</span>
              <h3>${t("settings.managed")}</h3>
              <p>${t("settings.managedCopy")}</p>
              <div class="credit-balance">
                <small>${this.plan} plan</small>
                <strong id="credit-balance-value">${this._creditsReady}</strong>
              </div>
              <label class="field">
                <span>${t("settings.dailyLimit")}</span>
                <input id="daily-spend-limit-input" type="number" min="0" step="1" placeholder="5000" />
              </label>
              <button id="save-spend-cap-button" class="marketplace-action secondary" type="button">${t("settings.saveSpendCap")}</button>
              <button id="refresh-credits-button" class="marketplace-action secondary" type="button">${t("settings.refreshBalance")}</button>
              <button id="buy-credits-button" class="marketplace-action" type="button">${t("settings.buyCredits")}</button>
            </article>
            <article class="settings-card full-span">
              <span>${t("settings.usage")}</span>
              <h3>${t("settings.sessionUsage")}</h3>
              <div class="usage-stats-grid">
                <div class="usage-stat">
                  <span>${t("settings.creditsUsedSession")}</span>
                  <strong id="session-credits-used">${this.usage?.creditsUsed ?? 0}</strong>
                </div>
                <div class="usage-stat">
                  <span>${t("settings.totalTokensSent")}</span>
                  <strong id="session-tokens-sent">${this.usage ? formatTokenCount(this.usage.tokensSent) : "0"}</strong>
                </div>
                <div class="usage-stat">
                  <span>${t("settings.promptsSent")}</span>
                  <strong id="session-prompts-count">${this.usage?.promptsCount ?? 0}</strong>
                </div>
                <div class="usage-stat">
                  <span>${t("settings.planRemaining")}</span>
                  <strong id="plan-credits-remaining">${this._hasSession ? t("settings.creditsReady") : "—"}</strong>
                </div>
              </div>
            </article>
            <article class="settings-card full-span">
              <span>${t("settings.integrations")}</span>
              <h3>${t("settings.mcp")}</h3>
              <p>${t("settings.mcpCopy")}</p>
              <div class="integration-settings">
                ${unsafeHTML(this.mcpSettingsHtml)}
              </div>
            </article>
            <article class="settings-card full-span">
              <span data-settings-tab="agents">Agents</span>
              <h3>Agent Configuration</h3>
              <p>Configure custom AI agents with YAML or the form below.</p>
              <div class="agent-config-form">
                <div class="agent-config-actions">
                  <button id="export-agent-yaml-btn" type="button" class="marketplace-action secondary">Export YAML</button>
                  <button id="import-agent-yaml-btn" type="button" class="marketplace-action secondary">Import YAML</button>
                </div>
                <hr />
                <label class="field">
                  <span>Agent ID</span>
                  <input id="agent-form-id" type="text" placeholder="my-custom-agent" />
                </label>
                <label class="field">
                  <span>Name</span>
                  <input id="agent-form-name" type="text" placeholder="My Custom Agent" />
                </label>
                <label class="field">
                  <span>Role</span>
                  <select id="agent-form-role">
                    <option value="architect">Architect</option>
                    <option value="builder" selected>Builder</option>
                    <option value="reviewer">Reviewer</option>
                    <option value="security">Security</option>
                    <option value="qa">QA</option>
                    <option value="docs">Docs</option>
                  </select>
                </label>
                <label class="field">
                  <span>Model</span>
                  <input id="agent-form-model" type="text" placeholder="gpt-5.4-mini" />
                </label>
                <label class="field">
                  <span>System Prompt</span>
                  <textarea id="agent-form-prompt" rows="4" placeholder="You are a senior engineer..."></textarea>
                </label>
                <button id="save-agent-config-btn" class="marketplace-action" type="button">Save Agent</button>
              </div>
            </article>
          </div>
        </div>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ide-settings-overlay": IdeSettingsOverlay;
  }
}
