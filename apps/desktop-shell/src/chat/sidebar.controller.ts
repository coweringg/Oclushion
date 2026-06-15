import { BaseController, type ControllerContext } from "../ui/controller";
import type { ChatSessionService } from "./chat-session.service";
import type { ChatMessage, ChatSession, GroupedSessions } from "./chat-session.types";
import { t } from "../i18n/translate";

export type ChatSidebarControllerActions = {
  activateSession(session: ChatSession, messages: ChatMessage[]): void;
};

export class ChatSidebarController extends BaseController {
  private activeSessionId: string | null = null;

  public constructor(
    context: ControllerContext,
    private readonly sessions: ChatSessionService,
    private readonly actions: ChatSidebarControllerActions,
  ) {
    super(context);
  }

  public async initialize(): Promise<void> {
    const existing = await this.sessions.listFlatSessions();
    const active = existing[0] ?? (await this.sessions.createSession());
    await this.activate(active.id);
  }

  public mount(): void {
    this.listen("#chat-new-session-button", "click", () => {
      void this.createSession();
    });
    this.listen("button[data-chat-session-id]", "click", (_event, button) => {
      const sessionId = button.dataset.chatSessionId;
      if (sessionId) {
        void this.activate(sessionId);
      }
    });
    this.listen("[data-chat-delete-session]", "click", (event, button) => {
      event.stopPropagation();
      const sessionId = button.dataset.chatDeleteSession;
      if (sessionId) {
        void this.deleteSession(sessionId);
      }
    });
  }

  public async refresh(): Promise<void> {
    const root = this.context.root.querySelector<HTMLElement>("#chat-sidebar-root");
    if (!root) {
      return;
    }
    const grouped = await this.sessions.listSessions();
    root.innerHTML = this.render(grouped);
  }

  public getActiveSessionId(): string | null {
    return this.activeSessionId;
  }

  public async activate(sessionId: string): Promise<void> {
    const session = await this.sessions.loadSession(sessionId);
    this.activeSessionId = session.id;
    this.actions.activateSession(session, session.messages);
    await this.refresh();
  }

  private async createSession(): Promise<void> {
    const session = await this.sessions.createSession();
    await this.activate(session.id);
  }

  private async deleteSession(sessionId: string): Promise<void> {
    const ok = window.confirm(t("sidebar.confirmDelete"));
    if (!ok) {
      return;
    }
    await this.sessions.deleteSession(sessionId);
    const remaining = await this.sessions.listFlatSessions();
    const next = remaining[0] ?? (await this.sessions.createSession());
    await this.activate(next.id);
  }

  private render(grouped: GroupedSessions): string {
    return `
      <aside class="chat-session-sidebar" aria-label="${t("sidebar.chatHistory")}">
        <header>
          <strong>${t("sidebar.chats")}</strong>
          <button id="chat-new-session-button" type="button">${t("common.newChat")}</button>
        </header>
        ${this.renderGroup(t("sidebar.today"), grouped.today)}
        ${this.renderGroup(t("sidebar.yesterday"), grouped.yesterday)}
        ${this.renderGroup(t("sidebar.thisWeek"), grouped.thisWeek)}
        ${this.renderGroup(t("sidebar.older"), grouped.older)}
      </aside>
    `;
  }

  private renderGroup(label: string, sessions: ChatSession[]): string {
    if (!sessions.length) {
      return "";
    }
    return `
      <section class="chat-session-group">
        <span>${label}</span>
        ${sessions.map((session) => this.renderSession(session)).join("")}
      </section>
    `;
  }

  private renderSession(session: ChatSession): string {
    const active = session.id === this.activeSessionId ? "active" : "";
    return `
      <button class="chat-session-item ${active}" type="button" data-chat-session-id="${session.id}">
        <span>${escapeHtml(session.title)}</span>
        <small>${formatDate(session.updatedAt)}</small>
        <i data-chat-delete-session="${session.id}" role="button" aria-label="${t("sidebar.deleteChat")}">${t("common.trash")}</i>
      </button>
    `;
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
