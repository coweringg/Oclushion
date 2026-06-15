import type { OclushionPlan, OclushionSession } from "../auth.service";
import type { ChatSession } from "../chat/chat-session.types";
import type { MarketplaceSnapshot } from "../marketplace/marketplace.types";
import type { KanbanTask } from "../kanban/kanban.types";
import type { TerminalSession } from "../terminal/terminal.types";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "status";
  content: string;
  createdAt: string;
};

export type AppState = {
  currentWorkspace: string | null;
  activeLocale: string;
  isGodModeActive: boolean;
  currentUserTier: Lowercase<OclushionPlan>;
  session: OclushionSession | null;
  chatHistory: ChatMessage[];
  chatSessions: ChatSession[];
  activeChatSessionId: string | null;
  terminalSessions: TerminalSession[];
  isTerminalOpen: boolean;
  marketplace: MarketplaceSnapshot;
  kanbanTasks: KanbanTask[];
};

export type AppStateListener = (state: Readonly<AppState>) => void;

export class AppStateManager {
  private state: AppState;
  private readonly listeners = new Set<AppStateListener>();

  public constructor(initialState: AppState) {
    this.state = cloneState(initialState);
  }

  public getState(): AppState {
    return cloneState(this.state);
  }

  public setState(updates: Partial<AppState>): void {
    this.state = cloneState({ ...this.state, ...updates });
    for (const listener of this.listeners) {
      listener(this.getState());
    }
  }

  public subscribe(listener: AppStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export function createInitialAppState(overrides: Partial<AppState> = {}): AppState {
  return {
    currentWorkspace: null,
    activeLocale: "en",
    isGodModeActive: false,
    currentUserTier: "free",
    session: null,
    chatHistory: [],
    chatSessions: [],
    activeChatSessionId: null,
    terminalSessions: [],
    isTerminalOpen: false,
    marketplace: {
      skills: [],
      tools: [],
      installedSkills: [],
      installedTools: [],
    },
    kanbanTasks: [],
    ...overrides,
  };
}

function cloneState(state: AppState): AppState {
  return {
    ...state,
    chatHistory: state.chatHistory.map((message) => ({ ...message })),
    chatSessions: state.chatSessions.map((session) => ({ ...session })),
    terminalSessions: state.terminalSessions.map((session) => ({
      ...session,
      scrollback: [...session.scrollback],
    })),
    marketplace: {
      skills: state.marketplace.skills.map((skill) => ({ ...skill })),
      tools: state.marketplace.tools.map((tool) => ({ ...tool })),
      installedSkills: state.marketplace.installedSkills.map((skill) => ({ ...skill })),
      installedTools: state.marketplace.installedTools.map((tool) => ({ ...tool })),
    },
    kanbanTasks: state.kanbanTasks.map((task) => ({ ...task })),
  };
}
