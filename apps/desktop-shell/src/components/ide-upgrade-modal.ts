import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { getModel } from "../app/model-provider";
import { t } from "../i18n/translate";
import type { AppModel } from "../app/state-manager";

function getUpgradeCopy(feature: string): { title: string; description: string } {
  if (feature === "hasGodMode") {
    return { title: t("upgrade.godTitle"), description: t("upgrade.godCopy") };
  }
  if (feature === "hasAutoPromptEnhancer") {
    return { title: t("upgrade.promptTitle"), description: t("upgrade.promptCopy") };
  }
  return { title: t("upgrade.voiceTitle"), description: t("upgrade.voiceCopy") };
}

@customElement("ide-upgrade-modal")
export class IdeUpgradeModal extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }
  `;

  private _model: AppModel = getModel();
  private _unsubs: Array<() => void> = [];

  override connectedCallback(): void {
    super.connectedCallback();
    this._unsubs = [
      this._model.subscribe("upgradeModalFeature", () => this.requestUpdate()),
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
    const feature = this._model.get("upgradeModalFeature");
    if (!feature) {
      return html``;
    }

    const copy = getUpgradeCopy(feature);

    return html`
      <section class="upgrade-overlay" aria-modal="true" role="dialog" aria-label="${t("upgrade.aria")}">
        <article class="upgrade-modal">
          <button id="upgrade-modal-close" class="upgrade-close" type="button" aria-label="${t("upgrade.close")}">x</button>
          <span class="upgrade-kicker">${t("upgrade.kicker")}</span>
          <h2>${copy.title}</h2>
          <p>${copy.description}</p>
          <div class="upgrade-actions">
            <button id="upgrade-account-button" class="upgrade-primary" type="button">${t("upgrade.primary")}</button>
            <button id="upgrade-modal-later" type="button">${t("upgrade.later")}</button>
          </div>
        </article>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ide-upgrade-modal": IdeUpgradeModal;
  }
}
