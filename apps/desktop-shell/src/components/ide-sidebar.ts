import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { t } from "../i18n/translate";

@customElement("ide-sidebar")
export class IdeSidebar extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }
  `;

  protected override createRenderRoot() {
    return this;
  }

  override render() {
    return html`
      <aside class="global-sidebar" aria-label="${t("navigation.global")}">
        <a class="brand-mark" href="#" aria-label="${t("appShell.brandName")}">
          <svg class="brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>
        </a>
        <nav class="nav-stack">
          <button data-tooltip="${t("appShell.homeTitle")}" title="${t("appShell.homeTitle")}" data-short="${t("common.home")}" type="button">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            <span>${t("common.home")}</span>
          </button>
          <button class="active" data-tooltip="${t("appShell.workspaceTitle")}" title="${t("appShell.workspaceTitle")}" data-short="${t("common.wrk")}" type="button">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
            <span>${t("common.workspace")}</span>
          </button>
          <button data-tooltip="${t("appShell.repoTitle")}" title="${t("appShell.repoTitle")}" data-short="${t("common.repo")}" type="button">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            <span>${t("common.repo")}</span>
          </button>
          <button id="kanban-nav-button" data-tooltip="${t("appShell.kanbanTitle")}" title="${t("appShell.kanbanTitle")}" data-short="${t("common.tasks")}" type="button">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            <span>${t("common.tasks")}</span>
          </button>
          <button id="audit-nav-button" data-tooltip="${t("appShell.activityTitle")}" title="${t("appShell.activityTitle")}" data-short="${t("common.act")}" type="button">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
            <span>${t("common.activity")}</span>
          </button>
          <button data-tooltip="${t("appShell.modelsTitle")}" title="${t("appShell.modelsTitle")}" data-short="${t("common.mod")}" type="button">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path></svg>
            <span>${t("navigation.models")}</span>
          </button>
          <button id="marketplace-nav-button" data-tooltip="${t("appShell.skillsTitle")}" data-testid="marketplace-button" class="with-badge" title="${t("appShell.skillsTitle")}" data-short="${t("common.skl")}" type="button">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
            <span>${t("common.skills")}</span><small>${t("navigation.new")}</small>
          </button>
        </nav>
        <button class="settings-button" data-tooltip="${t("appShell.settingsTitle")}" data-testid="settings-button" title="${t("appShell.settingsTitle")}" data-short="${t("common.cfg")}" type="button">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          <span>${t("common.settings")}</span>
        </button>
      </aside>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ide-sidebar": IdeSidebar;
  }
}
