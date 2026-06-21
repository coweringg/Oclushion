import { BaseController, type ControllerContext } from "../ui/controller";
import type { SecureKeysService } from "../llm/secure-keys.service";
import type { ModelRouter } from "../llm/model-router";
import { renderEmptyState } from "../ui/empty-state";
import { t } from "../i18n/translate";

export type AssistantInfo = {
  id: string;
  name: string;
  provider: "openai" | "anthropic" | "ollama" | "lmstudio" | "custom";
  status: "ready" | "not_configured" | "error" | "loading";
  model?: string;
  errorMessage?: string;
};

export class AssistantHubController extends BaseController {
  private assistants: AssistantInfo[] = [];
  private pollingTimer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribers: Array<() => void> = [];

  public constructor(
    context: ControllerContext,
    private readonly secureKeys: SecureKeysService,
    private readonly modelRouter: ModelRouter,
  ) {
    super(context);
  }

  public mount(): void {
    this.listen("[data-assistant-chat]", "click", (_event, button) => {
      const provider = button.dataset.assistantChat;
      if (provider) {
        this.switchToProvider(provider);
      }
    });

    this.listen("[data-assistant-setup]", "click", () => {
      this.openSettings();
    });

    this.listen("[data-assistant-retry]", "click", () => {
      void this.refresh();
    });
  }

  public async initialize(): Promise<void> {
    await this.refresh();
  }

  public async refresh(): Promise<void> {
    this.assistants = await this.collectAssistants();
    this.render();
  }

  public mountTo(rootId: string): void {
    const root = document.getElementById(rootId);
    if (!root) return;
    root.innerHTML = this.renderHub();
    this.mount();
    void this.initialize();
  }

  public override destroy(): void {
    super.destroy();
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
  }

  private async collectAssistants(): Promise<AssistantInfo[]> {
    const list: AssistantInfo[] = [];
    const keys = await this.secureKeys.loadAll();
    const preferredModel = "";

    const providers: Array<{ id: string; name: string; key: string }> = [
      { id: "anthropic", name: "Claude", key: keys.anthropic },
      { id: "openai", name: "GPT", key: keys.openai },
      { id: "ollama", name: "Ollama", key: "" },
      { id: "lmstudio", name: "LM Studio", key: "" },
    ];

    for (const p of providers) {
      const isProvider = p.id as AssistantInfo["provider"];
      if (isProvider === "ollama" || isProvider === "lmstudio") {
        list.push({
          id: p.id,
          name: p.name,
          provider: isProvider,
          status: "not_configured",
          model: undefined,
        });
        continue;
      }
      if (p.key) {
        list.push({
          id: p.id,
          name: p.name,
          provider: isProvider,
          status: "ready",
          model: preferredModel || undefined,
        });
      } else {
        list.push({
          id: p.id,
          name: p.name,
          provider: isProvider,
          status: "not_configured",
          model: undefined,
        });
      }
    }

    return list;
  }

  private switchToProvider(provider: string): void {
    const event = new CustomEvent("assistant:switch-provider", {
      detail: { provider },
      bubbles: true,
    });
    document.dispatchEvent(event);
  }

  private openSettings(): void {
    const event = new CustomEvent("assistant:open-settings", {
      detail: {},
      bubbles: true,
    });
    document.dispatchEvent(event);
  }

  private renderHub(): string {
    return `
      <div class="assistant-hub" id="assistant-hub-root">
        <div class="assistant-hub-header">
          <span class="assistant-hub-title">AI Assistants</span>
        </div>
        <div class="assistant-hub-grid">
          ${this.renderAssistants()}
        </div>
      </div>
    `;
  }

  private renderAssistants(): string {
    if (this.assistants.length === 0) {
      return renderEmptyState({
        icon: "🤖",
        title: "No AI assistants configured",
        description: "Add an API key in Settings to get started.",
        compact: true,
        iconVariant: "muted",
        action: {
          label: "Open Settings",
          id: "assistant-hub-empty-settings",
          variant: "primary",
        },
      });
    }

    return this.assistants
      .map(
        (assistant) => `
        <article class="assistant-card" data-assistant-id="${assistant.id}">
          <div class="assistant-card-top">
            <span class="assistant-badge">${this.getBadge(assistant.provider)}</span>
            <span class="assistant-status assistant-status--${assistant.status}">
              ${this.getStatusDot(assistant.status)}
            </span>
          </div>
          <strong class="assistant-name">${escapeHtml(assistant.name)}</strong>
          ${assistant.model ? `<small class="assistant-model">${escapeHtml(assistant.model)}</small>` : ""}
          ${this.renderAction(assistant)}
        </article>
      `,
      )
      .join("");
  }

  private render(): void {
    const root = this.context.root.querySelector<HTMLElement>("#assistant-hub-root");
    if (!root) return;
    const grid = root.querySelector<HTMLElement>(".assistant-hub-grid");
    if (grid) {
      grid.innerHTML = this.renderAssistants();
    }
  }

  private getBadge(provider: string): string {
    const badges: Record<string, string> = {
      anthropic: "CLAUDE",
      openai: "GPT",
      ollama: "OLLAMA",
      lmstudio: "LM",
      custom: "CUSTOM",
    };
    return badges[provider] ?? provider.toUpperCase();
  }

  private getStatusDot(status: AssistantInfo["status"]): string {
    switch (status) {
      case "ready":
        return `<span class="status-dot status-dot--ready" title="Ready"></span>`;
      case "not_configured":
        return `<span class="status-dot status-dot--off" title="Not configured"></span>`;
      case "error":
        return `<span class="status-dot status-dot--error" title="Error"></span>`;
      case "loading":
        return `<span class="status-dot status-dot--loading" title="Loading"></span>`;
    }
  }

  private renderAction(assistant: AssistantInfo): string {
    if (assistant.status === "ready") {
      return `<button class="assistant-action" type="button" data-assistant-chat="${assistant.id}">Chat</button>`;
    }
    if (assistant.status === "error") {
      return `<button class="assistant-action assistant-action--secondary" type="button" data-assistant-retry="true">Retry</button>`;
    }
    return `<button class="assistant-action assistant-action--secondary" type="button" data-assistant-setup="${assistant.id}">Setup</button>`;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
