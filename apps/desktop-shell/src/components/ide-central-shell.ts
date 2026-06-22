import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { getModel } from "../app/model-provider";
import { t } from "../i18n/translate";
import { renderKanbanView, renderSafeDiffPanel, getRepoName } from "../app/ui-renderers";
import { BreadcrumbsService } from "../editor/breadcrumbs.service";
import type { AppModel } from "../app/state-manager";
import type { EditorFile } from "../editor/editor.types";

@customElement("ide-central-shell")
export class IdeCentralShell extends LitElement {
  private _model: AppModel = getModel();
  private _unsubs: Array<() => void> = [];

  override connectedCallback(): void {
    super.connectedCallback();
    this._unsubs = [
      this._model.subscribe("kanbanOpen", () => this.requestUpdate()),
      this._model.subscribe("kanbanTasks", () => this.requestUpdate()),
      this._model.subscribe("activeRepoScan", () => this.requestUpdate()),
      this._model.subscribe("collapsedDirectories", () => this.requestUpdate()),
      this._model.subscribe("safeDiffProposals", () => this.requestUpdate()),
      this._model.subscribe("editorState", () => this.requestUpdate()),
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
    const kanbanOpen = this._model.get("kanbanOpen");
    const activeRepoScan = this._model.get("activeRepoScan");
    const kanbanTasks = this._model.get("kanbanTasks");
    const safeDiffProposals = this._model.get("safeDiffProposals");
    const editorState = this._model.get("editorState");

    const editorOpenFiles = editorState.openFiles;
    const activeFilePath = editorState.activeFilePath;

    if (kanbanOpen) {
      return html`${unsafeHTML(renderKanbanView(kanbanTasks))}`;
    }

    const bcItems = new BreadcrumbsService().parse(activeFilePath);

    return html`
      <header class="topbar">
        <button id="sidebar-toggle-button" class="topbar-icon-button" type="button" title="${t("workspace.toggleSidebar")}">☰</button>
        <div class="workspace-title">
          <span class="repo-cube"></span>
          <strong>${getRepoName(activeRepoScan)}</strong>
          <span>${t("common.main")}</span>
        </div>
        <div class="workspace-ready"><span></span> ${t("workspace.ready")}</div>
        <div class="topbar-actions">
          <button id="undo-button" class="topbar-icon-button" type="button" title="${t("common.undo")}">↶</button>
          <button id="redo-button" class="topbar-icon-button" type="button" title="${t("common.redo")}">↷</button>
        </div>
        <div class="window-actions" aria-hidden="true"><span></span><span></span><span></span></div>
      </header>

      ${editorOpenFiles.length === 0
        ? html`<nav class="tabs" aria-label="${t("workspace.openFiles")}"><span class="tab-empty">${t("editor.noFilesOpen")}</span></nav>`
        : html`<nav class="tabs" aria-label="${t("workspace.openFiles")}">
            ${editorOpenFiles.map((file: EditorFile) => {
              const isActive = file.path === activeFilePath;
              const fileName = file.path.split("/").pop() ?? file.path;
              return html`
                <button class="tab ${isActive ? "active" : ""}" data-tab-path="${file.path}" type="button" draggable="true">
                  <span class="tab-icon">${(fileName.split(".").pop()?.toUpperCase() ?? "")}</span>
                  <span class="tab-name">${fileName}${file.modified ? " ●" : ""}</span>
                </button>
              `;
            })}
          </nav>`
      }

      <div class="breadcrumb" id="editor-breadcrumbs">
        ${bcItems.map((item, idx) => html`
          ${idx > 0 ? html`<span class="breadcrumb-separator">›</span>` : ""}
          ${item.isLast
            ? html`<span class="breadcrumb-current">${item.label}</span>`
            : html`<button class="breadcrumb-segment" data-breadcrumb-path="${item.path}" type="button">${item.label}</button>`
          }
        `)}
      </div>
      <div id="editor" class="code-editor" aria-label="CodeMirror editor"></div>

      <section class="bottom-panel">
        <nav class="bottom-tabs">
          <button data-bottom-tab="problems" type="button">${t("safeDiff.problems")} <span>3</span></button>
          <button data-bottom-tab="output" type="button">${t("safeDiff.output")}</button>
          <button data-bottom-tab="terminal" type="button">${t("safeDiff.terminal")}</button>
          <button data-bottom-tab="debug" type="button">${t("safeDiff.debugConsole")}</button>
          <button data-bottom-tab="safe-diff" class="active" type="button">${t("safeDiff.title")} <span></span></button>
        </nav>

        <div id="safe-diff-root" class="safe-diff">${unsafeHTML(renderSafeDiffPanel(safeDiffProposals))}</div>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ide-central-shell": IdeCentralShell;
  }
}
