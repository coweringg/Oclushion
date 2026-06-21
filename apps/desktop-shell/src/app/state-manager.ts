import type { EditorView } from "@codemirror/view";
import type { RepoScanResult } from "../repo-scanner";
import type { PackedRepositoryContext } from "../context.service";
import type { SafeDiffProposal } from "../safe-diff.service";
import type { MarketplaceSnapshot, SuggestedSkill, InstallationProgress, MarketplaceSkillView } from "../marketplace/marketplace.types";
import type { OclushionSession } from "../auth.service";
import type { ChatSession } from "../chat/chat-session.types";
import type { ChatMessage as PersistentChatMessage } from "../chat/chat-session.types";
import type { ChatSidebarController } from "../chat/sidebar.controller";
import type { TerminalController } from "../terminal/terminal.controller";
import type { AuditSnapshot } from "../audit.service";
import type { OrchestratorSnapshot } from "../agents/types";
import type { KanbanTask, KanbanColumn } from "../kanban/kanban.types";
import type { FastApplySession } from "../fast-apply/fast-apply.types";
import type { PreviewConfig } from "../preview/preview.types";
import type { DeployState } from "../shipper/shipper.types";
import type { MultiplayerRoom } from "../multiplayer/multiplayer.types";
import type { EntitlementFeature } from "../billing/entitlements.types";
import type { ApiKeyProvider } from "../llm/secure-keys.service";
import type { EditorState } from "../editor/editor.types";

export type MarketplaceTab = "skills" | "tools" | "enterprise";
export type AuthMode = "login" | "register";

export interface AppState {
  collapsedDirectories: Set<string>;
  byokKeys: Record<ApiKeyProvider, string>;
  activeRepoScan: RepoScanResult;
  activePackedContext: PackedRepositoryContext;
  skillpackInteractionsAttached: boolean;
  safeDiffInteractionsAttached: boolean;
  agentInteractionsAttached: boolean;
  kanbanInteractionsAttached: boolean;
  privacyEnabled: boolean;
  safeDiffProposals: SafeDiffProposal[];
  editorView: EditorView | null;
  marketplaceOpen: boolean;
  marketplaceTab: MarketplaceTab;
  marketplaceSearchQuery: string;
  marketplaceFilterTier: string;
  marketplaceSort: string;
  marketplaceSnapshot: MarketplaceSnapshot;
  enterpriseSkills: MarketplaceSkillView[];
  onboardingOpen: boolean;
  onboardingError: string;
  suggestedSkill: SuggestedSkill | null;
  pendingSuggestedMessage: string;
  auditOpen: boolean;
  settingsOpen: boolean;
  kanbanOpen: boolean;
  auditSnapshot: AuditSnapshot;
  agentSnapshot: OrchestratorSnapshot;
  kanbanTasks: KanbanTask[];
  currentSession: OclushionSession | null;
  activeChatSession: ChatSession | null;
  activeChatMessages: PersistentChatMessage[];
  chatSidebarController: ChatSidebarController | null;
  terminalController: TerminalController | null;
  authMode: AuthMode;
  authError: string;
  authSubmitting: boolean;
  authSSOMode: "hidden" | "domain" | "waiting";
  authSSOError: string;
  authSSODomain: string;
  fastApplySessions: FastApplySession[];
  previewConfig: PreviewConfig | null;
  deployState: DeployState | null;
  multiplayerRoom: MultiplayerRoom | null;
  voiceRecording: boolean;
  promptEnhancing: boolean;
  upgradeModalFeature: EntitlementFeature | null;
  marketplaceDownloads: Set<string>;
  enterpriseManageOpen: boolean;
  enterpriseManageSkills: import("../types/enterprise-registry").EnterpriseSkill[];
  enterpriseManageError: string;
  enterpriseManageSubmitting: boolean;
  enterpriseManageEditingId: string | null;
  installationProgress: InstallationProgress | null;
  updateStatus: string;
  editorState: EditorState;
  autoApprove: boolean;
  layoutMode: "fixed" | "canvas";
}

export type AppStateKey = keyof AppState;
export type StateChangeCallback = (key: AppStateKey, value: unknown) => void;

export class AppModel {
  private state: AppState;
  private listeners: Map<AppStateKey, Set<StateChangeCallback>> = new Map();

  public constructor(initialState: AppState) {
    this.state = { ...initialState };
  }

  public get<K extends AppStateKey>(key: K): AppState[K] {
    return this.state[key];
  }

  private devtoolsLogging = typeof window !== "undefined" && import.meta.env?.DEV;

  public set<K extends AppStateKey>(key: K, value: AppState[K]): void {
    const oldValue = this.state[key];
    this.state[key] = value;
    if (oldValue !== value) {
      this.notify(key, value, oldValue);
    }
  }

  public update(partial: Partial<AppState>): void {
    for (const [key, value] of Object.entries(partial)) {
      this.set(key as AppStateKey, value as AppState[AppStateKey]);
    }
  }

  public subscribe(key: AppStateKey, callback: StateChangeCallback): () => void {
    let callbacks = this.listeners.get(key);
    if (!callbacks) {
      callbacks = new Set();
      this.listeners.set(key, callbacks);
    }
    callbacks.add(callback);
    return () => {
      this.listeners.get(key)?.delete(callback);
    };
  }

  public snapshot(): Readonly<AppState> {
    return { ...this.state };
  }

  private notify(key: AppStateKey, value: unknown, oldValue?: unknown): void {
    if (this.devtoolsLogging) {
      try {
        const loggerModule = (window as unknown as Record<string, unknown>).__OCLUSHIOM_DEVTOOLS__;
        if (loggerModule && typeof loggerModule === "function") {
          (loggerModule as (key: string, value: unknown, oldValue: unknown) => void)(key, value, oldValue);
        }
      } catch {
      }
    }
    const callbacks = this.listeners.get(key);
    if (callbacks) {
      for (const callback of callbacks) {
        callback(key, value);
      }
    }
  }
}

export function createInitialAppState(): AppState {
  return {
    collapsedDirectories: new Set<string>(),
    byokKeys: { openai: "", anthropic: "" },
    activeRepoScan: createDefaultRepoScan(),
    activePackedContext: { tokenLimit: 0, usedTokens: 0, droppedFiles: 0, files: [] },
    skillpackInteractionsAttached: false,
    safeDiffInteractionsAttached: false,
    agentInteractionsAttached: false,
    kanbanInteractionsAttached: false,
    autoApprove: false,
    layoutMode: "fixed",
    privacyEnabled: true,
    safeDiffProposals: [],
    editorView: null,
    marketplaceOpen: false,
    marketplaceTab: "skills",
    marketplaceSearchQuery: "",
    marketplaceFilterTier: "",
    marketplaceSort: "relevance",
    marketplaceSnapshot: {
      skills: [],
      tools: [],
      installedSkills: [],
      installedTools: [],
    },
    enterpriseSkills: [],
    onboardingOpen: false,
    onboardingError: "",
    suggestedSkill: null,
    pendingSuggestedMessage: "",
    auditOpen: false,
    settingsOpen: false,
    kanbanOpen: false,
    auditSnapshot: { events: [], lastDispatch: null },
    agentSnapshot: { activePlan: null, tasks: [], locks: [], totalCreditsUsed: 0 },
    kanbanTasks: [],
    currentSession: null,
    activeChatSession: null,
    activeChatMessages: [],
    chatSidebarController: null,
    terminalController: null,
    authMode: "login",
    authError: "",
    authSubmitting: false,
    authSSOMode: "hidden",
    authSSOError: "",
    authSSODomain: "",
    fastApplySessions: [],
    previewConfig: null,
    deployState: null,
    multiplayerRoom: null,
    voiceRecording: false,
    promptEnhancing: false,
    upgradeModalFeature: null,
    marketplaceDownloads: new Set<string>(),
    enterpriseManageOpen: false,
    enterpriseManageSkills: [],
    enterpriseManageError: "",
    enterpriseManageSubmitting: false,
    enterpriseManageEditingId: null,
    installationProgress: null,
    updateStatus: "Checking for desktop updates...",
    editorState: {
      openFiles: [],
      activeFilePath: null,
      recentFiles: [],
      isSaving: false,
      lastSaveError: null,
    },
  };
}

function createDefaultRepoScan(): RepoScanResult {
  return {
    rootPath: "",
    totalFiles: 0,
    filesByType: {},
    detectedFramework: null,
    detectedLanguage: "",
    hasTests: false,
    testRatio: 0,
    hasDocumentation: false,
    isMonorepo: false,
    packages: [],
    repoSummary: "",
    files: [],
  };
}
