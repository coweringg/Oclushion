import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { getModel } from "../app/model-provider";
import { t } from "../i18n/translate";
import { formatAuditType } from "../ui/utils/format";
import type { AppModel } from "../app/state-manager";
import type { AuditEvent, AuditSnapshot } from "../audit.service";

function countAuditEvents(type: AuditEvent["type"], auditSnapshot: AuditSnapshot): number {
  return auditSnapshot.events.filter((event) => event.type === type).length;
}

@customElement("ide-audit-overlay")
export class IdeAuditOverlay extends LitElement {
  private _model: AppModel = getModel();
  private _unsubs: Array<() => void> = [];

  override connectedCallback(): void {
    super.connectedCallback();
    this._unsubs = [
      this._model.subscribe("auditOpen", () => this.requestUpdate()),
      this._model.subscribe("auditSnapshot", () => this.requestUpdate()),
      this._model.subscribe("currentSession", () => this.requestUpdate()),
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
    const auditOpen = this._model.get("auditOpen");
    if (!auditOpen) {
      return html``;
    }

    const currentSession = this._model.get("currentSession");
    const auditSnapshot = this._model.get("auditSnapshot");
    const plan = currentSession?.user?.plan ?? "Free";
    const events = auditSnapshot.events;

    return html`
      <section id="audit-overlay" class="audit-overlay" role="dialog" aria-modal="true" aria-label="${t("audit.aria")}">
        <div class="audit-panel">
          <header>
            <div>
              <span>${t("audit.eyebrow")}</span>
              <h2>${t("audit.title")}</h2>
              <p>${events.length} local event${events.length === 1 ? "" : "s"} captured</p>
            </div>
            <div class="audit-header-actions">
              <button id="audit-close-button" type="button" aria-label="${t("common.close")}">${t("common.close")}</button>
            </div>
          </header>
          <div class="audit-summary-grid">
            <article><span>${t("audit.prompts")}</span><strong>${countAuditEvents("PROMPT_SENT", auditSnapshot)}</strong></article>
            <article><span>${t("audit.approvedCode")}</span><strong>${countAuditEvents("CODE_APPROVED", auditSnapshot)}</strong></article>
            <article><span>${t("audit.rejectedCode")}</span><strong>${countAuditEvents("CODE_REJECTED", auditSnapshot)}</strong></article>
            <article><span>${t("audit.commands")}</span><strong>${countAuditEvents("COMMAND_EXECUTED", auditSnapshot)}</strong></article>
          </div>
          <div class="audit-timeline">
            ${events.length ? events.map((event: AuditEvent) => html`
              <article class="audit-event ${event.syncStatus}">
                <div class="audit-event-icon">${event.type.slice(0, 1)}</div>
                <div>
                  <header>
                    <strong>${formatAuditType(event.type)}</strong>
                    <span>${new Date(event.timestamp).toLocaleString()}</span>
                  </header>
                  <p>${event.summary}</p>
                  <footer>
                    <span>${event.plan}</span>
                    <span>${event.syncStatus.replaceAll("_", " ")}</span>
                    <span>${event.workspaceId}</span>
                  </footer>
                </div>
              </article>
            `) : html`
              <div class="empty-state empty-state--compact">
                <div class="empty-state-icon empty-state-icon--muted">📝</div>
                <h3 class="empty-state-title">${t("audit.emptyTitle")}</h3>
                <p class="empty-state-description">${t("audit.emptyCopy")}</p>
              </div>
            `}
          </div>
        </div>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ide-audit-overlay": IdeAuditOverlay;
  }
}
