import { renderEmptyState } from "../empty-state";
import type { ChatMessage } from "../../chat/chat-session.types";

export type MentionedFile = {
  path: string;
  name: string;
};

export type ThinkingState = {
  isThinking: boolean;
  filesAnalyzed: number;
  tokensUsed: number;
  chainOfThought: string;
  showChainOfThought: boolean;
};

export type ChatViewState = {
  messages: ChatMessage[];
  inputValue: string;
  mentionedFiles: MentionedFile[];
  showMentionPopup: boolean;
  mentionQuery: string;
  mentionResults: MentionedFile[];
  thinking: ThinkingState;
};

export class ChatRenderer {
  public render(container: HTMLElement, state: ChatViewState): void {
    const existingStyle = document.getElementById("ocl-chat-enhanced-style");
    if (!existingStyle) {
      const style = document.createElement("style");
      style.id = "ocl-chat-enhanced-style";
      style.textContent = `
        .ocl-chat-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #0a0a0c;
          font-family: 'Inter', system-ui, sans-serif;
          color: #e2e8f0;
          position: relative;
        }

        .ocl-chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .ocl-msg {
          max-width: 85%;
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 14px;
          line-height: 1.6;
          position: relative;
        }

        .ocl-msg-user {
          align-self: flex-end;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white;
          border-bottom-right-radius: 4px;
        }

        .ocl-msg-assistant {
          align-self: flex-start;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-bottom-left-radius: 4px;
        }

        .ocl-msg-code-block {
          background: #1a1a2e;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          margin: 8px 0;
          overflow: hidden;
        }

        .ocl-msg-code-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.03);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          font-size: 11px;
          color: #94a3b8;
        }

        .ocl-msg-code-content {
          padding: 12px;
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          font-size: 13px;
          line-height: 1.5;
          overflow-x: auto;
          white-space: pre;
          color: #e2e8f0;
        }

        .ocl-msg-code-actions {
          display: flex;
          gap: 8px;
          padding: 8px 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          background: rgba(255, 255, 255, 0.02);
        }

        .ocl-code-action-btn {
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: transparent;
          color: #94a3b8;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .ocl-code-action-btn:hover {
          background: rgba(139, 92, 246, 0.15);
          border-color: #8b5cf6;
          color: #c4b5fd;
        }

        .ocl-chat-input-area {
          padding: 12px 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          background: rgba(255, 255, 255, 0.02);
          position: relative;
        }

        .ocl-chat-pills {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin-bottom: 8px;
        }

        .ocl-chat-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          background: rgba(99, 102, 241, 0.2);
          border: 1px solid rgba(99, 102, 241, 0.3);
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          color: #a5b4fc;
        }

        .ocl-pill-remove {
          cursor: pointer;
          opacity: 0.6;
          transition: opacity 0.2s;
        }

        .ocl-pill-remove:hover {
          opacity: 1;
        }

        .ocl-chat-input-row {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .ocl-chat-input {
          flex: 1;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #f8fafc;
          padding: 12px 16px;
          border-radius: 10px;
          font-size: 14px;
          outline: none;
          font-family: 'Inter', system-ui, sans-serif;
          transition: border-color 0.2s;
        }

        .ocl-chat-input:focus {
          border-color: #8b5cf6;
        }

        .ocl-chat-send {
          width: 42px;
          height: 42px;
          border-radius: 10px;
          background: linear-gradient(135deg, #a855f7, #6366f1);
          border: none;
          color: white;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: filter 0.2s;
          flex-shrink: 0;
        }

        .ocl-chat-send:hover {
          filter: brightness(1.15);
        }

        .ocl-mention-popup {
          position: absolute;
          bottom: 100%;
          left: 16px;
          right: 16px;
          background: #16161e;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          max-height: 200px;
          overflow-y: auto;
          box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.5);
          z-index: 100;
        }

        .ocl-mention-item {
          padding: 10px 14px;
          font-size: 13px;
          color: #cbd5e1;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: background 0.15s;
        }

        .ocl-mention-item:hover {
          background: rgba(139, 92, 246, 0.15);
          color: #f8fafc;
        }

        .ocl-mention-item-icon {
          font-size: 14px;
          opacity: 0.7;
        }

        .ocl-thinking-bar {
          padding: 10px 16px;
          background: rgba(139, 92, 246, 0.08);
          border-top: 1px solid rgba(139, 92, 246, 0.15);
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          color: #c4b5fd;
        }

        .ocl-thinking-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .ocl-thinking-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(139, 92, 246, 0.3);
          border-top-color: #a855f7;
          border-radius: 50%;
          animation: ocl-spin 0.8s linear infinite;
        }

        @keyframes ocl-spin {
          to { transform: rotate(360deg); }
        }

        .ocl-cot-toggle {
          cursor: pointer;
          padding: 4px 10px;
          border-radius: 6px;
          background: rgba(139, 92, 246, 0.15);
          border: none;
          color: #c4b5fd;
          font-size: 11px;
          font-weight: 600;
          transition: background 0.2s;
        }

        .ocl-cot-toggle:hover {
          background: rgba(139, 92, 246, 0.3);
        }

        .ocl-cot-panel {
          padding: 12px 16px;
          background: rgba(139, 92, 246, 0.05);
          border-top: 1px solid rgba(139, 92, 246, 0.1);
          font-size: 12px;
          color: #94a3b8;
          line-height: 1.6;
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          white-space: pre-wrap;
          max-height: 200px;
          overflow-y: auto;
        }
      `;
      document.head.appendChild(style);
    }

    const pillsHtml = state.mentionedFiles.length > 0
      ? `<div class="ocl-chat-pills">
           ${state.mentionedFiles.map(f => `
             <span class="ocl-chat-pill">
               📄 @${f.name}
               <span class="ocl-pill-remove" data-remove-file="${f.path}">&times;</span>
             </span>
           `).join("")}
         </div>`
      : "";

    const mentionPopupHtml = state.showMentionPopup
      ? `<div class="ocl-mention-popup">
           ${state.mentionResults.map(f => `
             <div class="ocl-mention-item" data-mention-path="${f.path}">
               <span class="ocl-mention-item-icon">📄</span>
               ${f.name}
             </div>
           `).join("")}
           ${state.mentionResults.length === 0 ? '<div class="ocl-mention-item" style="opacity:0.5;">No se encontraron archivos</div>' : ""}
         </div>`
      : "";

    const thinkingHtml = state.thinking.isThinking
      ? `<div class="ocl-thinking-bar">
           <div class="ocl-thinking-left">
             <div class="ocl-thinking-spinner"></div>
             <span>Analizando ${state.thinking.filesAnalyzed} archivos (${state.thinking.tokensUsed.toLocaleString()} tokens)...</span>
           </div>
           <button class="ocl-cot-toggle" id="btn-toggle-cot">
             ${state.thinking.showChainOfThought ? "Ocultar razonamiento" : "Ver razonamiento"}
           </button>
         </div>
         ${state.thinking.showChainOfThought && state.thinking.chainOfThought
           ? `<div class="ocl-cot-panel">${state.thinking.chainOfThought}</div>`
           : ""}`
      : "";

    const messagesHtml = state.messages.map(msg => {
      if (msg.role === "user") {
        return `<div class="ocl-msg ocl-msg-user">${this.escapeHtml(msg.content)}</div>`;
      }

      const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
      let processed = msg.content;
      const codeBlocks: string[] = [];

      processed = processed.replace(codeBlockRegex, (_, lang, code) => {
        const idx = codeBlocks.length;
        codeBlocks.push(`
          <div class="ocl-msg-code-block">
            <div class="ocl-msg-code-header">
              <span>${lang || "code"}</span>
            </div>
            <div class="ocl-msg-code-content">${this.escapeHtml(code.trim())}</div>
            <div class="ocl-msg-code-actions">
              <button class="ocl-code-action-btn" data-action="insert-at-cursor" data-code-index="${idx}">
                ⎆ Insertar en el cursor
              </button>
              <button class="ocl-code-action-btn" data-action="replace-file" data-code-index="${idx}">
                🔄 Reemplazar archivo entero
              </button>
            </div>
          </div>
        `);
        return `__CODE_BLOCK_${idx}__`;
      });

      let finalHtml = this.escapeHtml(processed);
      codeBlocks.forEach((block, i) => {
        finalHtml = finalHtml.replace(`__CODE_BLOCK_${i}__`, block);
      });

      return `<div class="ocl-msg ocl-msg-assistant">${finalHtml}</div>`;
    }).join("");

    const messageCount = state.messages.filter(m => m.role !== "system").length;

    container.innerHTML = `
      <div class="ocl-chat-panel">
        <div class="ocl-chat-messages" id="ocl-chat-messages-scroll">
          ${messageCount === 0 ? renderEmptyState({
            icon: "💬",
            title: "Start a conversation with AI",
            description: "Ask a question, request code review, or discuss your project.",
            compact: true,
            iconVariant: "default",
          }) : messagesHtml}
        </div>
        ${thinkingHtml}
        <div class="ocl-chat-input-area">
          ${mentionPopupHtml}
          ${pillsHtml}
          <div class="ocl-chat-input-row">
            <input
              type="text"
              class="ocl-chat-input"
              id="ocl-chat-input"
              placeholder="Escribe un mensaje... (usa @ para mencionar archivos)"
              value="${this.escapeAttr(state.inputValue)}"
              autocomplete="off"
            />
            <button class="ocl-chat-send" id="ocl-chat-send">➤</button>
          </div>
        </div>
      </div>
    `;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  private escapeAttr(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}
