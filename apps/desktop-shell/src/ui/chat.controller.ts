import { BaseController, type ControllerContext } from "./controller";
import { ChatRenderer, type ChatViewState, type MentionedFile } from "./renderers/chat.renderer";
import type { ChatMessage } from "../chat/chat-session.types";
import { logger } from "../utils/logger";

export type ChatControllerActions = {
  sendMessage(message: string, mentionedFiles: MentionedFile[]): Promise<void>;
  toggleVoice(): Promise<void>;
  listProjectFiles(): MentionedFile[];
};

export class ChatController extends BaseController {
  private renderer = new ChatRenderer();
  private container: HTMLElement | null = null;

  private state: ChatViewState = {
    messages: [],
    inputValue: "",
    mentionedFiles: [],
    showMentionPopup: false,
    mentionQuery: "",
    mentionResults: [],
    thinking: {
      isThinking: false,
      filesAnalyzed: 0,
      tokensUsed: 0,
      chainOfThought: "",
      showChainOfThought: false,
    },
  };

  public constructor(
    context: ControllerContext,
    private readonly actions: ChatControllerActions,
  ) {
    super(context);
  }

  public mount(): void {
    this.container = this.context.root instanceof Document
      ? this.context.root.getElementById("ocl-chat-mount")
      : this.context.root.querySelector("#ocl-chat-mount");

    if (!this.container) {
      return;
    }

    this.render();
    this.attachDelegatedEvents();
  }

  public pushAssistantMessage(content: string, tokensUsed: number, filesAnalyzed: number, chainOfThought: string): void {
    this.state.thinking = {
      isThinking: false,
      filesAnalyzed: 0,
      tokensUsed: 0,
      chainOfThought: "",
      showChainOfThought: false,
    };

    const msg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sessionId: "active",
      role: "assistant",
      content,
      metadata: { tokensUsed, filesAnalyzed, chainOfThought },
      createdAt: new Date().toISOString(),
    };
    this.state.messages.push(msg);
    this.render();
    this.scrollToBottom();
  }

  public setThinking(filesAnalyzed: number, tokensUsed: number, chainOfThought: string): void {
    this.state.thinking = {
      isThinking: true,
      filesAnalyzed,
      tokensUsed,
      chainOfThought,
      showChainOfThought: this.state.thinking.showChainOfThought,
    };
    this.render();
  }

  private attachDelegatedEvents(): void {
    if (!this.container) return;

    this.container.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      if (target.id !== "ocl-chat-input") return;

      this.state.inputValue = target.value;

      const atIndex = target.value.lastIndexOf("@");
      if (atIndex !== -1 && atIndex === target.value.length - 1) {
        this.state.showMentionPopup = true;
        this.state.mentionQuery = "";
        this.state.mentionResults = this.actions.listProjectFiles();
        this.render();
        this.restoreFocus();
        return;
      }

      if (this.state.showMentionPopup) {
        const lastAt = target.value.lastIndexOf("@");
        if (lastAt === -1) {
          this.state.showMentionPopup = false;
          this.render();
          this.restoreFocus();
          return;
        }
        const query = target.value.slice(lastAt + 1).toLowerCase();
        this.state.mentionQuery = query;
        this.state.mentionResults = this.actions.listProjectFiles()
          .filter(f => f.name.toLowerCase().includes(query));
        this.render();
        this.restoreFocus();
      }
    });

    this.container.addEventListener("keydown", (e) => {
      const target = e.target as HTMLInputElement;
      if (target.id !== "ocl-chat-input") return;

      if (e.key === "Escape" && this.state.showMentionPopup) {
        this.state.showMentionPopup = false;
        this.render();
        this.restoreFocus();
        return;
      }

      if (e.key === "Enter" && !this.state.showMentionPopup) {
        e.preventDefault();
        this.sendCurrentMessage();
      }
    });

    this.container.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;

      if (target.id === "ocl-chat-send") {
        this.sendCurrentMessage();
        return;
      }

      if (target.id === "btn-toggle-cot") {
        this.state.thinking.showChainOfThought = !this.state.thinking.showChainOfThought;
        this.render();
        return;
      }

      const mentionItem = target.closest(".ocl-mention-item") as HTMLElement;
      if (mentionItem) {
        const filePath = mentionItem.dataset.mentionPath;
        const fileName = mentionItem.textContent?.trim() ?? "";
        if (filePath) {
          const alreadyMentioned = this.state.mentionedFiles.some(f => f.path === filePath);
          if (!alreadyMentioned) {
            this.state.mentionedFiles.push({ path: filePath, name: fileName });
          }
          const lastAt = this.state.inputValue.lastIndexOf("@");
          this.state.inputValue = this.state.inputValue.slice(0, lastAt);
          this.state.showMentionPopup = false;
          this.render();
          this.restoreFocus();
        }
        return;
      }

      const removeBtn = target.closest(".ocl-pill-remove") as HTMLElement;
      if (removeBtn) {
        const pathToRemove = removeBtn.dataset.removeFile;
        if (pathToRemove) {
          this.state.mentionedFiles = this.state.mentionedFiles.filter(f => f.path !== pathToRemove);
          this.render();
          this.restoreFocus();
        }
        return;
      }

      const codeActionBtn = target.closest(".ocl-code-action-btn") as HTMLElement;
      if (codeActionBtn) {
        const action = codeActionBtn.dataset.action;
        logger.info("ChatController", `Code action triggered: ${action}`);
        return;
      }
    });
  }

  private sendCurrentMessage(): void {
    const message = this.state.inputValue.trim();
    if (!message) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sessionId: "active",
      role: "user",
      content: message,
      createdAt: new Date().toISOString(),
    };
    this.state.messages.push(userMsg);
    this.state.inputValue = "";
    this.state.showMentionPopup = false;

    this.render();
    this.scrollToBottom();

    void this.actions.sendMessage(message, [...this.state.mentionedFiles]);
    this.state.mentionedFiles = [];
  }

  private scrollToBottom(): void {
    if (!this.container) return;
    const scrollArea = this.container.querySelector("#ocl-chat-messages-scroll");
    if (scrollArea) {
      scrollArea.scrollTop = scrollArea.scrollHeight;
    }
  }

  private restoreFocus(): void {
    if (!this.container) return;
    requestAnimationFrame(() => {
      const input = this.container!.querySelector("#ocl-chat-input") as HTMLInputElement;
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    });
  }

  private render(): void {
    if (this.container) {
      this.renderer.render(this.container, this.state);
    }
  }
}
