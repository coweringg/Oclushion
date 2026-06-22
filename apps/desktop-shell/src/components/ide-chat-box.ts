import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { t } from "../i18n/translate";

@customElement("ide-chat-box")
export class IdeChatBox extends LitElement {
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
      <footer class="chat-box hidden-control">
        <label for="chat-input">${t("chat.label")}</label>
        <div id="chat-thread" class="chat-thread" aria-live="polite"></div>
        <ide-auto-approve></ide-auto-approve>
        <div>
          <input id="chat-input" type="text" data-tooltip="Chat Input | Type a message for the AI assistant" placeholder="${t("chat.placeholder")}" />
          <button id="chat-send-button" data-tooltip="Send | Submit your message to the AI" type="button">${t("common.send")}</button>
        </div>
      </footer>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ide-chat-box": IdeChatBox;
  }
}
