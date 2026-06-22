import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { getModel } from "../app/model-provider";
import { getRepoName } from "../app/ui-renderers";
import type { AppModel } from "../app/state-manager";

@customElement("ide-titlebar")
export class IdeTitlebar extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }
  `;

  @property({ type: Number })
  creditsUsed = 0;

  private _model: AppModel = getModel();
  private _unsubs: Array<() => void> = [];

  private get _displayName(): string {
    const cs = this._model.get("currentSession");
    return cs?.user?.name?.trim() || cs?.user?.email?.split("@")[0] || "Arjun Dev";
  }

  private get _displayEmail(): string {
    return this._model.get("currentSession")?.user?.email ?? "arjun@acme.com";
  }

  private get _repoName(): string {
    return getRepoName(this._model.get("activeRepoScan"));
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this._unsubs = [
      this._model.subscribe("currentSession", () => this.requestUpdate()),
      this._model.subscribe("activeRepoScan", () => this.requestUpdate()),
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
      <header class="app-titlebar" aria-label="Application title bar">
        <a class="app-wordmark" href="#" aria-label="Oclushion">
          <span>Oclushion</span>
        </a>
        <div class="app-titlebar-divider" aria-hidden="true"></div>
        <div class="titlebar-repo">
          <span class="repo-cube"></span>
          <strong id="titlebar-repo-name">${this._repoName}</strong>
        </div>
        <div class="titlebar-branch">
          <span>Branch</span>
          <strong>main</strong>
          <small>v</small>
        </div>
        <div class="titlebar-status"><span></span> Workspace ready <small>i</small></div>
        <div class="titlebar-spacer"></div>
        <button id="spatial-toggle-button" type="button" title="Toggle spatial canvas mode">◇ Layout</button>
        <button id="titlebar-settings-button" class="titlebar-usage" type="button" title="Settings">Credits ${this.creditsUsed}</button>
        <button class="titlebar-pro" type="button">Pro</button>
        <button class="titlebar-icon" title="Notifications" type="button">Bell</button>
        <div class="titlebar-user">
          <span>${this._displayName.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>${this._displayName}</strong>
            <small>${this._displayEmail}</small>
          </div>
        </div>
        <div class="window-actions" aria-hidden="true"><span></span><span></span><span></span></div>
      </header>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ide-titlebar": IdeTitlebar;
  }
}
