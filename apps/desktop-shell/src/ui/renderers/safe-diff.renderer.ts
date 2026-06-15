import type { SafeDiffProposal } from "../../safe-diff.service";

export type SafeDiffEditorState = {
  proposal: SafeDiffProposal | null;
  securityWarnings: string[];
};

export class SafeDiffRenderer {
  public render(container: HTMLElement, state: SafeDiffEditorState): void {
    if (!state.proposal) {
      container.innerHTML = "";
      return;
    }

    const { proposal, securityWarnings } = state;

    container.innerHTML = `
      <style>
        .ocl-editor-diff {
          background: #1e1e1e;
          color: #d4d4d4;
          font-family: 'JetBrains Mono', monospace;
          border-radius: 6px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
          margin: 16px 0;
          border: 1px solid rgba(255,255,255,0.1);
        }

        .ocl-diff-header {
          background: #252526;
          padding: 8px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }

        .ocl-diff-filename {
          font-size: 13px;
          font-weight: 600;
        }

        .ocl-diff-file-actions {
          display: flex;
          gap: 6px;
        }

        .ocl-btn-sm {
          padding: 4px 10px;
          font-size: 11px;
          border-radius: 4px;
          cursor: pointer;
          border: none;
          font-weight: 600;
        }

        .ocl-btn-file-accept { background: #04395e; color: #fff; }
        .ocl-btn-file-reject { background: #5a1d1d; color: #fff; }

        .ocl-security-alert {
          background: rgba(239, 68, 68, 0.1);
          border-left: 3px solid #ef4444;
          padding: 8px 16px;
          font-size: 12px;
          color: #fca5a5;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .ocl-diff-content {
          padding: 16px 0;
          font-size: 13px;
          line-height: 1.5;
        }

        .ocl-diff-chunk {
          position: relative;
          margin-bottom: 24px;
        }

        .ocl-diff-line {
          padding: 0 16px;
          display: flex;
          white-space: pre;
        }

        .ocl-diff-old {
          background: rgba(244, 63, 94, 0.15); 
          text-decoration: line-through;
          color: #fb7185;
        }

        .ocl-diff-new {
          background: rgba(16, 185, 129, 0.15); 
          color: #6ee7b7;
        }

        .ocl-diff-chunk-actions {
          position: absolute;
          top: -12px;
          right: 16px;
          display: flex;
          gap: 4px;
          background: #252526;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 4px;
          padding: 2px;
        }

        .ocl-btn-chunk {
          background: transparent;
          border: none;
          color: #fff;
          cursor: pointer;
          font-size: 11px;
          padding: 4px 8px;
          border-radius: 2px;
        }
        
        .ocl-btn-chunk:hover {
          background: rgba(255,255,255,0.1);
        }
      </style>

      <div class="ocl-editor-diff">
        <div class="ocl-diff-header">
          <div class="ocl-diff-filename">${proposal.targetFile || "Untitled"}</div>
          <div class="ocl-diff-file-actions">
            <button class="ocl-btn-sm ocl-btn-file-accept" data-action="accept-file" data-id="${proposal.id}">Accept All</button>
            <button class="ocl-btn-sm ocl-btn-file-reject" data-action="reject-file" data-id="${proposal.id}">Reject All</button>
          </div>
        </div>

        ${securityWarnings.length > 0 ? `
          <div class="ocl-security-alert">
            <span>🛡️</span>
            <span><strong>Sano Shield Alert:</strong> ${securityWarnings.join(", ")}</span>
          </div>
        ` : ""}

        <div class="ocl-diff-content">
          ${proposal.chunks.map(chunk => `
            <div class="ocl-diff-chunk" data-chunk-id="${chunk.id}">
              <div class="ocl-diff-chunk-actions">
                <button class="ocl-btn-chunk" data-action="accept-chunk" data-id="${chunk.id}">Aceptar</button>
                <button class="ocl-btn-chunk" data-action="reject-chunk" data-id="${chunk.id}">Cancelar</button>
              </div>
              
              ${chunk.oldContent ? `<div class="ocl-diff-line ocl-diff-old">- ${chunk.oldContent}</div>` : ""}
              ${chunk.newContent ? `<div class="ocl-diff-line ocl-diff-new">+ ${chunk.newContent}</div>` : ""}
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }
}
