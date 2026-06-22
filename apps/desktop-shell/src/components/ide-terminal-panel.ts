import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import type { TerminalSession } from "../terminal/terminal.types";

@customElement("ide-terminal-panel")
export class IdeTerminalPanel extends LitElement {
  @property({ type: Boolean, reflect: true })
  isOpen = false;

  @property({ type: String })
  splitContent = "";

  @property({ type: Object })
  agentSession: TerminalSession | null = null;

  protected override createRenderRoot() {
    return this;
  }

  override render() {
    if (!this.isOpen) {
      return;
    }

    return html`
      <section class="terminal-panel" aria-label="Integrated terminal">
        <section class="terminal-pane user">
          <header class="terminal-split-header">
            <div class="terminal-split-toolbar">
              <button data-terminal-split-h type="button" title="Split horizontal">⬌</button>
              <button data-terminal-split-v type="button" title="Split vertical">⬍</button>
              <button id="terminal-new-user-button" type="button" title="New terminal">+</button>
            </div>
          </header>
          <div id="terminal-user-mount" class="terminal-split-container">
            ${unsafeHTML(this.splitContent)}
          </div>
        </section>
        <aside id="terminal-agent-pane" class="terminal-pane agent" tabindex="0">
          <header class="terminal-pane-header">
            <div>
              <strong>AGENT TERMINAL</strong>
              <span id="terminal-agent-status" class="${this.agentSession?.isAlive ? "running" : ""}">
                ${this.agentSession?.isAlive ? "Running" : "Idle"}
              </span>
            </div>
            <button id="terminal-agent-interrupt" type="button" title="Ctrl+C cancela el proceso actual del agente">Ctrl+C</button>
          </header>
          <div id="terminal-agent-mount" class="terminal-mount readonly" data-terminal-session="${this.agentSession?.id ?? ""}"></div>
        </aside>
        <footer class="terminal-suggestions" id="terminal-suggestions">
          <span class="suggestions-label">AI:</span>
          <div class="suggestions-list" id="suggestions-list"></div>
          <button id="suggestions-refresh-btn" type="button" title="Get AI suggestions">✨</button>
        </footer>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ide-terminal-panel": IdeTerminalPanel;
  }
}
