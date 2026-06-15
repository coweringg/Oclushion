export type StatusBarState = {
  branchName: string;
  sanoShieldActive: boolean;
  ollamaReady: boolean;
  tsErrors: number;
  tsWarnings: number;
  cursorLine: number;
  cursorCol: number;
  encoding: string;
  language: string;
};

export class StatusBarRenderer {
  public render(container: HTMLElement, state: StatusBarState): void {
    const existingStyle = document.getElementById("ocl-status-bar-style");
    if (!existingStyle) {
      const style = document.createElement("style");
      style.id = "ocl-status-bar-style";
      style.textContent = `
        .ocl-sb-section {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .ocl-sb-item {
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          padding: 0 4px;
          height: 24px;
          transition: background-color 0.1s;
        }

        .ocl-sb-item:hover {
          background-color: rgba(255, 255, 255, 0.1);
        }

        .ocl-sb-icon {
          font-size: 14px;
          line-height: 1;
        }

        .ocl-sb-error {
          color: #f14c4c;
        }

        .ocl-sb-warning {
          color: #cca700;
        }
      `;
      document.head.appendChild(style);
    }

    container.innerHTML = `
      <div class="ocl-sb-section">
        <div class="ocl-sb-item" title="Git Branch">
          <span class="ocl-sb-icon">🌿</span>
          <span>${state.branchName}</span>
        </div>
        <div class="ocl-sb-item" title="TypeScript Diagnostics">
          <span class="ocl-sb-icon ocl-sb-error">❌</span>
          <span>${state.tsErrors}</span>
          <span class="ocl-sb-icon ocl-sb-warning" style="margin-left: 4px;">⚠️</span>
          <span>${state.tsWarnings}</span>
        </div>
        <div class="ocl-sb-item" title="SanoShield Privacy Engine">
          <span class="ocl-sb-icon">🛡️</span>
          <span>SanoShield: ${state.sanoShieldActive ? 'Active' : 'Disabled'}</span>
        </div>
        <div class="ocl-sb-item" title="Local Model Status">
          <span class="ocl-sb-icon">🦙</span>
          <span>Ollama: ${state.ollamaReady ? 'Ready' : 'Offline'}</span>
        </div>
      </div>
      
      <div class="ocl-sb-section">
        <div class="ocl-sb-item" title="Cursor Position">
          <span>Ln ${state.cursorLine}, Col ${state.cursorCol}</span>
        </div>
        <div class="ocl-sb-item" title="Indentation">
          <span>Spaces: 2</span>
        </div>
        <div class="ocl-sb-item" title="File Encoding">
          <span>${state.encoding}</span>
        </div>
        <div class="ocl-sb-item" title="Line Sequence">
          <span>LF</span>
        </div>
        <div class="ocl-sb-item" title="Language Mode">
          <span class="ocl-sb-icon">{" "}</span>
          <span>${state.language}</span>
        </div>
        <div class="ocl-sb-item" title="Feedback">
          <span class="ocl-sb-icon">💬</span>
        </div>
      </div>
    `;
  }
}
