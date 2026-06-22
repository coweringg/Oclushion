import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { getModel } from "../app/model-provider";
import { t } from "../i18n/translate";
import { renderRepoCard } from "../app/ui-renderers";
import type { AppModel } from "../app/state-manager";

@customElement("ide-workspace-panel")
export class IdeWorkspacePanel extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }
  `;

  private _model = getModel();
  private _unsubs: Array<() => void> = [];

  override connectedCallback(): void {
    super.connectedCallback();
    this._unsubs = [
      this._model.subscribe("activeRepoScan", () => this.requestUpdate()),
      this._model.subscribe("collapsedDirectories", () => this.requestUpdate()),
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
    return html`
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

          <article class="premium-shield-card">
            <div class="shield-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            </div>
            <div>
              <strong>SECURITY</strong>
              <p>Sano Shield <span>Enabled</span></p>
            </div>
            <button class="icon-btn" type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"></path></svg>
            </button>
          </article>

          <article class="premium-skillpack-card">
            <header>
              <span>Active Skillpack</span>
              <div class="skillpack-badge">Backend</div>
            </header>
            <p>Oclushion is currently optimized for Node.js, Express, and Database development.</p>
          </article>

          <section id="repo-card" class="repo-card" data-testid="repo-card">
            ${unsafeHTML(renderRepoCard(this._model.get("activeRepoScan"), this._model.get("collapsedDirectories")))}
          </section>
        </div>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ide-workspace-panel": IdeWorkspacePanel;
  }
}
