import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("ide-auto-approve")
export class IdeAutoApprove extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }

    .auto-approve-bar {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 6px 12px;
      border-top: 1px solid rgba(148, 121, 255, 0.1);
      border-bottom: 1px solid rgba(148, 121, 255, 0.1);
      background: rgba(5, 10, 18, 0.2);
      animation: ocl-fade-in 280ms cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    .auto-approve-label {
      color: #8f9bb1;
      font-size: 11px;
      font-weight: 600;
    }

    .auto-approve-toggle {
      all: unset;
      display: inline-flex;
      align-items: center;
      cursor: pointer;
      padding: 2px;
    }

    .auto-approve-track {
      display: block;
      position: relative;
      width: 32px;
      height: 18px;
      border-radius: 9px;
      transition: background 0.2s;
    }

    .auto-approve-toggle.on .auto-approve-track {
      background: rgba(69, 229, 162, 0.3);
    }

    .auto-approve-toggle.off .auto-approve-track {
      background: rgba(139, 155, 181, 0.15);
    }

    .auto-approve-thumb {
      display: block;
      position: absolute;
      top: 2px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      transition: left 0.2s, background 0.2s, box-shadow 0.2s;
    }

    .auto-approve-toggle.on .auto-approve-thumb {
      left: 16px;
      background: #45e5a2;
      box-shadow: 0 0 8px rgba(69, 229, 162, 0.5);
    }

    .auto-approve-toggle.off .auto-approve-thumb {
      left: 2px;
      background: #4a5568;
    }

    .auto-approve-status {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
    }

    .auto-approve-toggle.on + .auto-approve-status {
      color: #45e5a2;
    }

    .auto-approve-toggle.off + .auto-approve-status {
      color: #6b7a93;
    }
  `;

  @property({ type: Boolean, reflect: true })
  on = false;

  // Render in light DOM so existing event handlers still work
  protected override createRenderRoot() {
    return this;
  }

  override render() {
    const stateClass = this.on ? "on" : "off";
    return html`
      <div class="auto-approve-bar">
        <span class="auto-approve-label">Auto-approve</span>
        <button
          id="auto-approve-toggle"
          class="auto-approve-toggle ${stateClass}"
          type="button"
          title="Toggle whether AI can apply changes without asking"
        >
          <span class="auto-approve-track">
            <span class="auto-approve-thumb"></span>
          </span>
        </button>
        <span class="auto-approve-status">${this.on ? "ON" : "OFF"}</span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ide-auto-approve": IdeAutoApprove;
  }
}
