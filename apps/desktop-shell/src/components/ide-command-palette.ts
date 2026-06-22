import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("ide-command-palette")
export class IdeCommandPalette extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }

    .ocl-command-palette-overlay {
      position: fixed;
      inset: 0;
      z-index: 999;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding-top: 80px;
      background: rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(6px);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.18s ease;
    }

    .ocl-command-palette-overlay.open {
      opacity: 1;
      pointer-events: auto;
    }

    .ocl-command-palette {
      width: 520px;
      max-height: 380px;
      display: flex;
      flex-direction: column;
      background: #121926;
      border: 1px solid rgba(148, 121, 255, 0.15);
      border-radius: 12px;
      box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(148, 121, 255, 0.06);
      overflow: hidden;
      transform: translateY(-8px);
      transition: transform 0.18s ease;
    }

    .ocl-command-palette-overlay.open .ocl-command-palette {
      transform: translateY(0);
    }

    .ocl-command-mode-hint {
      padding: 6px 12px;
      font-size: 10px;
      font-weight: 600;
      color: #6b7a93;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .ocl-command-input {
      width: 100%;
      box-sizing: border-box;
      padding: 10px 14px;
      border: none;
      border-bottom: 1px solid rgba(148, 121, 255, 0.1);
      background: transparent;
      color: #e4e9f2;
      font-size: 14px;
      outline: none;
    }

    .ocl-command-input::placeholder {
      color: #4a5568;
    }

    .ocl-command-results {
      flex: 1;
      overflow-y: auto;
      padding: 4px 0;
    }

    .ocl-command-loading {
      padding: 20px;
      text-align: center;
      color: #6b7a93;
      font-size: 13px;
    }

    .ocl-command-group-header {
      padding: 6px 14px;
      font-size: 10px;
      font-weight: 700;
      color: #6b7a93;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .ocl-command-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 14px;
      cursor: pointer;
      font-size: 13px;
      color: #c8d0dc;
      transition: background 0.1s;
    }

    .ocl-command-item:hover,
    .ocl-command-item--selected {
      background: rgba(148, 121, 255, 0.1);
      color: #e4e9f2;
    }

    .ocl-command-item-icon {
      width: 20px;
      text-align: center;
      font-size: 14px;
    }

    .ocl-command-item-label {
      flex: 1;
    }

    .ocl-command-item-label mark {
      background: rgba(148, 121, 255, 0.25);
      color: #c8a8ff;
      border-radius: 2px;
    }

    .ocl-command-item kbd {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.06);
      color: #6b7a93;
    }

    .ocl-command-footer {
      display: flex;
      gap: 12px;
      padding: 6px 14px;
      border-top: 1px solid rgba(148, 121, 255, 0.06);
      font-size: 10px;
      color: #4a5568;
    }

    .ocl-command-empty {
      padding: 20px;
      text-align: center;
      color: #6b7a93;
      font-size: 13px;
    }
  `;

  @property({ type: Boolean, reflect: true })
  open = false;

  protected override createRenderRoot() {
    return this;
  }

  override render() {
    return html`
      <div class="ocl-command-palette-overlay ${this.open ? "open" : ""}" id="command-palette-overlay">
        <div class="ocl-command-palette" role="dialog" aria-label="Command palette">
          <div class="ocl-command-mode-hint">Ctrl+Shift+P</div>
          <input
            class="ocl-command-input"
            id="command-palette-input"
            type="text"
            placeholder="Search commands, files, or actions..."
            autofocus
            spellcheck="false"
            data-palette-mode="commands"
          />
          <div class="ocl-command-results" id="command-palette-results">
            <div class="ocl-command-loading">Type to search...</div>
          </div>
          <div class="ocl-command-footer">
            <span>↑↓ Navigate</span>
            <span>↵ Open</span>
            <span>⎋ Close</span>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ide-command-palette": IdeCommandPalette;
  }
}
