import { z } from "zod";
import { open } from "@tauri-apps/plugin-dialog";
import { logger } from "../utils/logger";
import { getControlApiUrl } from "../config/api";

const balanceResponseSchema = z.object({ balance: z.number().optional() });
const checkoutSessionSchema = z.object({ url: z.string().optional() });
const spendCapSchema = z.object({ dailySpendLimit: z.number().optional(), currentDailySpend: z.number().optional() });
const errorMessageSchema = z.object({ message: z.string().optional() });
const ssoErrorSchema = z.object({ error: z.string().optional() });
const ssoAuthorizeSchema = z.object({ redirectUrl: z.string(), flowId: z.string() });
const ssoPollSchema = z.object({ status: z.string(), token: z.string().optional(), user: z.record(z.string(), z.unknown()).optional() });
import type { AppModel } from "./state-manager";
import type { RepoScanResult } from "../repo-scanner";
import type { PackedRepositoryContext } from "../context.service";
import type { SafeDiffProposal } from "../safe-diff.service";
import type { MarketplaceSnapshot } from "../marketplace/marketplace.types";
import type { InstallationStep } from "../marketplace/marketplace.types";
import type { KanbanTask, KanbanColumn } from "../kanban/kanban.types";
import type { ChatMessage as PersistentChatMessage, ChatSession } from "../chat/chat-session.types";
import type { OclushionSession, OclushionPlan } from "../auth.service";
import { getRoleFromToken } from "../auth.service";
import type { EntitlementFeature } from "../billing/entitlements.types";
import type { MCPProviderId } from "../mcp/mcp.types";
import type { SkillpackManager } from "../skillpacks/skillpack.manager";
import type { AuditService } from "../audit.service";
import type { AgentOrchestrator } from "../agents/agent-orchestrator";
import type { KanbanService } from "../kanban/kanban.service";
import type { TaskHandoffService } from "../kanban/task-handoff.service";
import type { MarketplaceService } from "../marketplace/marketplace.service";
import type { MarketplaceSearchService, MarketplaceSearchResult, MarketplaceSortOption } from "../marketplace/marketplace-search.service";
import type { InstallationProgressService } from "../marketplace/installation-progress.service";
import type { ChatSessionService } from "../chat/chat-session.service";
import type { ChatSidebarController } from "../chat/sidebar.controller";
import type { SecureKeysService } from "../llm/secure-keys.service";
import type { EntitlementsService } from "../billing/entitlements.service";
import type { SessionUsageService } from "../billing/session-usage.service";
import type { MCPRegistry } from "../mcp/mcp-registry";
import type { FastApplyService } from "../fast-apply/fast-apply.service";
import type { PromptEnhancerService } from "../prompt-enhancer/prompt-enhancer.service";
import type { VoiceCaptureService } from "../voice/voice-capture.service";
import type { PermissionManager } from "../security/permission.manager";
import type { ShipperService } from "../shipper/shipper.service";
import type { MultiplayerService } from "../multiplayer/multiplayer.service";
import type { PreviewService } from "../preview/preview.service";
import type { PreviewWindow } from "../preview/preview-window";
import type { ModelRouter } from "../llm/model-router";
import type { SanoShield } from "../sano-shield.service";
import type { PromptBuilder } from "../prompt-builder";
import type { ProjectMemoryService } from "../memory/project-memory.service";
import type { MCPContextInjector } from "../mcp/mcp-context-injector";
import type { WorklogService } from "../agents/worklog.service";
import type { ContextService } from "../context.service";
import { buildEnterpriseSkillsContext, buildEnterpriseAgentsContext, buildUnifiedSkillList } from "../enterprise/unified-registry.service";
import { getOrganization } from "../enterprise/organization.service";
import { getCachedSkills, fetchSkills, createSkill, deleteSkill, approveSkill, updateSkill } from "../enterprise/enterprise-skill.service";
import type { EnterpriseSkill, CreateEnterpriseSkillInput } from "../types/enterprise-registry";
import type { TerminalService } from "../terminal/terminal.service";
import type { TerminalController } from "../terminal/terminal.controller";
import type { EditorView } from "@codemirror/view";
import {
  createMockRepoScanResult,
  scanRepository,
  buildFileTree,
} from "../repo-scanner";
import {
  createMockSourceFiles,
  loadRepositorySourceFiles,
  packRepositoryContext,
} from "../context.service";
import { changeLanguage, getCurrentLanguage } from "../i18n/i18n";
import { t } from "../i18n/translate";
import {
  renderRepoCard,
  renderCentralShell,
  renderSafeDiffPanel,
  renderMarketplaceOverlay,
  renderEnterpriseManageOverlay,
  renderAuditOverlay,
  renderSettingsOverlay,
  renderV3Controls,
  renderFastApplyPanel,
  renderPreviewStatus,
  renderShipperStatus,
  renderMultiplayerStatus,
  renderContextMeter,
  renderAuthOverlay,
  renderUpgradeModal,
  renderIdeLanguageSwitcher,
  renderMcpSettingsRows,
  renderBestSkillpackList,
  renderInstallationProgress,
  getRepoName,
} from "./ui-renderers";
import { showToast } from "../ui/toast";
import { escapeHtml, formatTokenCount, formatElapsed, estimateTokensFromText } from "../ui/utils/format";
import { parseAssistantResponseForProposals } from "../safe-diff.service";
import { runOclushionChatTurn } from "../chat-orchestrator";
import { validateGodModeAccess, validateVoiceDictationAccess } from "../commands/agent";
import { PlanRestrictionError } from "../billing/entitlements.types";
import { openUrl } from "@tauri-apps/plugin-opener";
import { check } from "@tauri-apps/plugin-updater";
import type { Update } from "@tauri-apps/plugin-updater";
import { playSuccessSound, playErrorSound } from "../notifications/notification-sound";
import { EditorController } from "../editor/editor.controller";
import type { EditorControllerContext } from "../editor/editor.controller";
import { KeyboardShortcutsService, createDefaultShortcuts } from "../keyboard-shortcuts/keyboard-shortcuts.service";
import { ThemeService } from "../theme/theme.service";
import { showProgress, dismissProgress } from "../ui/progress-indicator";
import { GitStatusService } from "../editor/git-status.service";
import { SearchService } from "../editor/search.service";
import { ErrorHandlerService } from "../error-handler/error-handler.service";
import { OnboardingService } from "../onboarding/onboarding.service";
import { TourService } from "../tour/tour.service";
import { FileSearchService } from "../editor/file-search.service";

let keyboardShortcutCleanup: (() => void) | null = null;
let chatOrchestratorRunning = false;
let themeServiceSingleton: ThemeService | null = null;
const attachedInteractions = new Set<string>();
let currentDesktopUpdate: Update | null = null;

function getThemeService(): ThemeService {
  if (!themeServiceSingleton) {
    themeServiceSingleton = new ThemeService();
  }
  return themeServiceSingleton;
}

getThemeService();

import type { CanvasService } from "../canvas/canvas.service";
import type { IntentRouter } from "../agents/intent-router";

export interface EventHandlerContext {
  model: AppModel;
  skillpackManager: SkillpackManager;
  auditService: AuditService;
  agentOrchestrator: AgentOrchestrator;
  kanbanService: KanbanService;
  taskHandoff: TaskHandoffService;
  marketplaceService: MarketplaceService;
  marketplaceSearchService: MarketplaceSearchService;
  chatSessionService: ChatSessionService;
  secureKeysService: SecureKeysService;
  entitlementsService: EntitlementsService;
  sessionUsageService: SessionUsageService;
  mcpRegistry: MCPRegistry;
  fastApplyService: FastApplyService;
  promptEnhancer: PromptEnhancerService;
  voiceCapture: VoiceCaptureService;
  permissionManager: PermissionManager;
  shipperService: ShipperService;
  multiplayerService: MultiplayerService;
  previewService: PreviewService;
  previewWindow: PreviewWindow;
  modelRouter: ModelRouter;
  sanoShield: SanoShield;
  promptBuilder: PromptBuilder;
  projectMemory: ProjectMemoryService;
  mcpInjector: MCPContextInjector;
  worklogService: WorklogService;
  contextService: ContextService;
  terminalService: TerminalService;
  editorController: EditorController;
  keyboardShortcuts: KeyboardShortcutsService;
  gitStatusService: GitStatusService;
  searchService: SearchService;
  errorHandler: ErrorHandlerService;
  onboardingService: OnboardingService;
  tourService: TourService;
  fileSearchService: FileSearchService;
  installationProgressService: InstallationProgressService;
  canvasService: CanvasService;
  intentRouter: IntentRouter;
}

export function attachRepoInteractions(ctx: EventHandlerContext): void {
  if (attachedInteractions.has("repo")) return;
  attachedInteractions.add("repo");

  document.querySelector<HTMLButtonElement>("#open-repository-button")?.addEventListener("click", () => {
    void openRepository(ctx);
  });

  document.querySelector<HTMLElement>("#repo-tree")?.addEventListener("click", (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest<HTMLButtonElement>(".repo-node") : null;
    if (!target) return;

    const path = target.dataset.nodePath;
    const kind = target.dataset.nodeKind;
    if (!path) return;

    if (kind === "directory") {
      const collapsedDirectories = ctx.model.get("collapsedDirectories");
      if (collapsedDirectories.has(path)) {
        collapsedDirectories.delete(path);
      } else {
        collapsedDirectories.add(path);
      }
      ctx.model.set("collapsedDirectories", collapsedDirectories);
      refreshRepoCard(ctx);
      return;
    }

    if (kind === "file") {
      const repoScan = ctx.model.get("activeRepoScan");
      if (!repoScan) return;
      const file = repoScan.files.find((f) => f.path === path);
      if (file) {
        void ctx.editorController.openFile(file.absolutePath, file.path);
      }
    }
  });
}

export async function openRepository(ctx: EventHandlerContext): Promise<void> {
  let selected: string | null = null;
  try {
    selected = await open({
      title: t("workspace.openRepository"),
      directory: true,
      multiple: false,
      recursive: true,
    });
  } catch (error) {
    logger.warn('EventHandlers', 'Dialog cancelled or failed, loading mock repo', error);
    ctx.model.set("activeRepoScan", createMockRepoScanResult());
    refreshRepoCard(ctx);
    await refreshContextEngine(ctx);
    refreshSkillpacks(ctx);
    return;
  }
  if (!selected) {
    return;
  }

  ctx.model.get("collapsedDirectories").clear();
  const progId = showProgress({ message: "Scanning repository...", type: "spinner" });
  try {
    ctx.model.set("activeRepoScan", await scanRepository(selected));
  } catch (error) {
    logger.warn('EventHandlers', 'Failed to scan repository, using mock', error);
    ctx.model.set("activeRepoScan", createMockRepoScanResult());
  } finally {
    dismissProgress(progId);
  }
  await ctx.gitStatusService.refresh(ctx.model.get("activeRepoScan").rootPath);
  refreshRepoCard(ctx);
  await refreshContextEngine(ctx);
  refreshSkillpacks(ctx);
}

export function refreshRepoCard(ctx: EventHandlerContext): void {
  const repoCard = document.querySelector<HTMLElement>("#repo-card");
  if (repoCard) {
    repoCard.innerHTML = renderRepoCard(
      ctx.model.get("activeRepoScan"),
      ctx.model.get("collapsedDirectories"),
      ctx.gitStatusService.getStatuses(),
    );
  }
  const workspaceTitle = document.querySelector<HTMLElement>(".workspace-title strong");
  if (workspaceTitle) {
    workspaceTitle.textContent = getRepoName(ctx.model.get("activeRepoScan"));
  }
  const titlebarRepoName = document.querySelector<HTMLElement>("#titlebar-repo-name");
  if (titlebarRepoName) {
    titlebarRepoName.textContent = getRepoName(ctx.model.get("activeRepoScan"));
  }
  attachRepoInteractions(ctx);
}

export async function refreshContextEngine(ctx: EventHandlerContext): Promise<void> {
  const sourceFiles = await loadRepositorySourceFiles(ctx.model.get("activeRepoScan")).catch(() => createMockSourceFiles());
  ctx.model.set("activePackedContext", packRepositoryContext(sourceFiles, 128_000));
  refreshContextMeter(ctx);
}

export function refreshContextMeter(ctx: EventHandlerContext): void {
  const meterRoot = document.querySelector<HTMLElement>("#context-meter-root");
  if (meterRoot) {
    meterRoot.innerHTML = renderContextMeter(ctx.model.get("activePackedContext"));
  }
}

export function refreshSkillpacks(
  ctx: EventHandlerContext,
  snapshotOrInstalled?: unknown,
): void {
  const profileList = document.querySelector<HTMLElement>("#profile-list");
  const activeBadge = document.querySelector<HTMLElement>("#active-skillpack-badge");
  const resetCopy = document.querySelector<HTMLElement>("#reset-plan-copy");
  const activeSkillpack = ctx.skillpackManager.getActiveSkillpack();

  if (profileList) {
    profileList.innerHTML = renderBestSkillpackList(ctx.skillpackManager.listInstalled());
  }
  if (activeBadge) {
    activeBadge.textContent = activeSkillpack.name;
  }
  if (resetCopy) {
    resetCopy.textContent = t("workspace.activeSkillpack", { name: activeSkillpack.name, style: activeSkillpack.outputFormat.style });
  }

  const systemPrompt = ctx.promptBuilder.buildSystemPrompt(activeSkillpack, {
    repo: ctx.model.get("activeRepoScan"),
    repositoryContext: ctx.model.get("activePackedContext"),
    userTask: t("workspace.ready"),
  });
  document.querySelector<HTMLElement>("#chat-input")?.setAttribute("data-system-prompt", systemPrompt);
  attachSkillpackInteractions(ctx);
}

export function getSelectedModel(): string {
  const selected = document.querySelector<HTMLSelectElement>("#model-selector")?.value;
  if (selected === "custom") {
    const custom = document.querySelector<HTMLInputElement>("#custom-model-input")?.value.trim();
    return custom || "gpt-5.4-mini";
  }
  return selected ?? "gpt-5.4-mini";
}

export function renderChatThread(
  messages: PersistentChatMessage[],
  appendChatMessageFn: (role: "user" | "assistant" | "status", content: string, options?: { persist?: boolean; model?: string; metadata?: Record<string, unknown> }) => void,
): void {
  const thread = document.querySelector<HTMLElement>("#chat-thread");
  if (!thread) {
    return;
  }
  thread.replaceChildren();
  for (const message of messages) {
    const role = message.role === "system" || message.role === "tool" ? "status" : message.role;
    appendChatMessageFn(role, message.content, { persist: false });
  }
}

export function appendChatMessage(
  role: "user" | "assistant" | "status",
  content: string,
  options: { persist?: boolean; model?: string; metadata?: Record<string, unknown> } = {},
  ctx?: EventHandlerContext,
): void {
  const thread = document.querySelector<HTMLElement>("#chat-thread");
  if (!thread) {
    return;
  }
  const message = document.createElement("article");
  message.className = `chat-message ${role}`;
  message.textContent = content;
  thread.append(message);
  thread.scrollTop = thread.scrollHeight;

  if (ctx && options.persist !== false && ctx.model.get("activeChatSession") && role !== "status") {
    const activeChatSession = ctx.model.get("activeChatSession");
    if (!activeChatSession) {
      logger.warn('EventHandlers', 'No active chat session, skipping message append');
      return;
    }
    const activeChatMessages = ctx.model.get("activeChatMessages");
    void ctx.chatSessionService
      .appendMessage(activeChatSession.id, {
        role,
        content,
        model: options.model,
        metadata: options.metadata,
      })
      .then((stored) => {
        ctx.model.set("activeChatMessages", [...activeChatMessages, stored]);
        if (role === "user" && activeChatMessages.filter((chatMessage) => chatMessage.role === "user").length === 1) {
          const generatedTitle = content.slice(0, 48);
          void ctx.chatSessionService.renameSession(activeChatSession.id, generatedTitle).then(() => {
            ctx.model.set("activeChatSession", ctx.model.get("activeChatSession") ? { ...ctx.model.get("activeChatSession")!, title: generatedTitle } : ctx.model.get("activeChatSession"));
            void ctx.model.get("chatSidebarController")?.refresh();
          });
        } else {
          void ctx.model.get("chatSidebarController")?.refresh();
        }
      });
  }
}

export async function runChatOrchestrator(ctx: EventHandlerContext, skipSkillSuggestion = false): Promise<void> {
  if (chatOrchestratorRunning) return;
  chatOrchestratorRunning = true;

  const input = document.querySelector<HTMLInputElement>("#chat-input");
  const userMessage = input?.value.trim();
  if (!input || !userMessage) {
    chatOrchestratorRunning = false;
    return;
  }

  if (!skipSkillSuggestion) {
    const suggestion = await ctx.marketplaceService.suggestSkill(userMessage, getCurrentPlan(ctx)).catch(() => null);
    if (suggestion) {
      ctx.model.set("suggestedSkill", suggestion);
      ctx.model.set("pendingSuggestedMessage", userMessage);
      refreshMarketplaceOverlay(ctx);
      return;
    }
  }

  input.value = "";
  appendChatMessage("user", userMessage, {}, ctx);
  ctx.worklogService.clear();
  ctx.worklogService.security(t("privacy.title"));
  ctx.worklogService.context(
    `Packed repo context: ${ctx.model.get("activePackedContext").files.length} files - ${formatTokenCount(ctx.model.get("activePackedContext").usedTokens)} tokens`,
    `${ctx.model.get("activePackedContext").droppedFiles} files dropped by token budget`,
  );
  const thread = document.querySelector<HTMLElement>("#chat-thread");
  const loading = document.createElement("article");
  loading.className = "chat-message status";
  loading.innerHTML = renderWorklogPanel(ctx.worklogService.getEntries());
  thread?.append(loading);

  const activeSkillpack = ctx.skillpackManager.getActiveSkillpack();
  refreshContextMeter(ctx);
  recordAudit(ctx, {
    type: "PROMPT_SENT",
    actor: "developer",
    summary: `Prompt sent to ${getSelectedModel()} with ${activeSkillpack.name}`,
    metadata: {
      model: getSelectedModel(),
      skillpack: activeSkillpack.id,
      privacyEnabled: ctx.model.get("privacyEnabled"),
      promptLength: userMessage.length,
      contextTokens: ctx.model.get("activePackedContext").usedTokens,
    },
  });

  try {
    const [memoryContext, mcpContext, marketplaceSkillsContext, enterpriseContext, enterpriseAgentsContext] = await Promise.all([
      ctx.projectMemory.buildPromptContext(userMessage).catch(() => ""),
      ctx.mcpInjector.buildContext(userMessage).catch(() => ""),
      ctx.contextService.buildMarketplaceSkillsContext().catch(() => ""),
      Promise.resolve(buildEnterpriseSkillsContext()),
      Promise.resolve(buildEnterpriseAgentsContext()),
    ]);
    const externalContext = [memoryContext, mcpContext, enterpriseAgentsContext].filter(Boolean).join("\n\n");
    ctx.worklogService.model(`Sending to ${getSelectedModel()}`);
    const result = await runOclushionChatTurn({
      userMessage,
      model: getSelectedModel(),
      skillpack: activeSkillpack,
      repo: ctx.model.get("activeRepoScan"),
      repositoryContext: ctx.model.get("activePackedContext"),
      promptBuilder: ctx.promptBuilder,
      modelRouter: ctx.modelRouter,
      sanoShield: ctx.sanoShield,
      privacyEnabled: ctx.model.get("privacyEnabled"),
      externalContext,
      marketplaceSkillsContext: [marketplaceSkillsContext, enterpriseContext].filter(Boolean).join("\n"),
      historyMessages: ctx.model.get("activeChatMessages").map((message) => ({ role: message.role, content: message.content })),
    });
    ctx.worklogService.model(`Model responded in ${formatElapsed(result.response.latencyMs)}`, result.response.latencyMs);
    ctx.sessionUsageService.recordPrompt(
      estimateTokensFromText(result.outboundSystemPrompt) + estimateTokensFromText(result.outboundUserMessage),
      Math.max(1, Math.ceil((result.outboundSystemPrompt.length + result.response.content.length) / 4 / 1000)),
    );
    await ctx.projectMemory.learnFromText(userMessage, "user");
    await ctx.projectMemory.learnFromText(result.restoredContent, "agent");
    input.setAttribute("data-system-prompt", result.outboundSystemPrompt);
    loading.remove();
    const parsedResponse = parseAssistantResponseForProposals(result.restoredContent);
    ctx.worklogService.proposal(
      `${parsedResponse.proposals.length} proposal${parsedResponse.proposals.length === 1 ? "" : "s"} queued for Safe Diff review`,
    );
    const spawnedChat = await handleSpawnNewChatTool(ctx, result.restoredContent);
    if (parsedResponse.proposals.length) {
      ctx.model.set("safeDiffProposals", [
        ...parsedResponse.proposals.map((proposal) => ({
          ...proposal,
          id: `${Date.now()}-${proposal.id}`,
        })),
        ...ctx.model.get("safeDiffProposals"),
      ]);
      refreshSafeDiffPanel(ctx);
    }
    appendChatMessage(
      "assistant",
      [
        `[${result.response.provider}/${result.response.model} - ${result.response.latencyMs}ms]`,
        parsedResponse.conversationText || t("safeDiff.quarantined", { count: parsedResponse.proposals.length }),
        parsedResponse.proposals.length
          ? `\n${parsedResponse.proposals.length} ${t("safeDiff.pending", { count: parsedResponse.proposals.length })}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
      {
        model: result.response.model,
        metadata: {
          provider: result.response.provider,
          latencyMs: result.response.latencyMs,
          safeDiffProposals: parsedResponse.proposals.length,
          sanoMappings: result.mappings.length,
          spawnedChatId: spawnedChat?.id ?? null,
        },
      },
      ctx,
    );
    chatOrchestratorRunning = false;
    playSuccessSound();
  } catch (error) {
    loading.remove();
    const original = error instanceof Error ? error : new Error(String(error));
    const friendly = ErrorHandlerService.resolve(original);
    const toastConfig = ErrorHandlerService.getToastConfig(friendly);
    appendChatMessage("status", `[${toastConfig.title}] ${original.message}`, {}, ctx);
    chatOrchestratorRunning = false;
    playErrorSound();
  }
}

async function handleSpawnNewChatTool(ctx: EventHandlerContext, content: string): Promise<ChatSession | null> {
  const match = content.match(
    /<tool_call\s+name=["']spawn_new_chat["']>\s*<title>([\s\S]*?)<\/title>\s*<context>([\s\S]*?)<\/context>\s*<\/tool_call>/iu,
  );
  if (!match) {
    return null;
  }
  const title = decodeToolText(match[1] ?? "Agent sub-task").slice(0, 72);
  const context = decodeToolText(match[2] ?? "");
  const session = await ctx.chatSessionService.spawnAgentChat(title, context);
  await ctx.model.get("chatSidebarController")?.refresh();
  appendChatMessage("status", `${t("agent.started")} ${session.title}`, { persist: false }, ctx);
  return session;
}

function decodeToolText(value: string): string {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .trim();
}

export function refreshSafeDiffPanel(ctx: EventHandlerContext): void {
  const root = document.querySelector<HTMLElement>("#safe-diff-root");
  if (root) {
    root.innerHTML = renderSafeDiffPanel(ctx.model.get("safeDiffProposals"));
  }
}

export function refreshAgentProgress(ctx: EventHandlerContext): void {
  const root = document.querySelector<HTMLElement>("#agent-progress-root");
  if (root) {
    root.innerHTML = renderAgentProgress(
      ctx.model.get("agentSnapshot"),
      ctx.worklogService.getEntries(),
      t,
    );
  }
}

function renderAgentProgress(
  snapshot: { activePlan: { userRequest: string; tasks: Array<{ status: string }> } | null; tasks: Array<{ status: string }>; totalCreditsUsed: number },
  entries: Array<{ category: string; message: string; timestamp: string }>,
  translate: (key: string) => string,
): string {
  if (!snapshot) {
    return `<div class="agent-progress"><p>${translate("agent.noActiveAgent")}</p></div>`;
  }
  const taskCount = snapshot.tasks?.length ?? 0;
  const completedTasks = snapshot.tasks?.filter((t) => t.status === "completed").length ?? 0;
  const activePlanTitle = snapshot.activePlan?.userRequest ?? "";
  return `
    <div class="agent-progress">
      <h3>${translate("agent.progress")}</h3>
      ${activePlanTitle ? `<p class="agent-plan-title">${escapeHtml(activePlanTitle)}</p>` : ""}
      <p>${translate("agent.tasksCompleted")}: ${completedTasks}/${taskCount}</p>
      <p>${translate("agent.creditsUsed")}: ${snapshot.totalCreditsUsed}</p>
      <p>${translate("agent.recentActivity")}: ${entries.length}</p>
    </div>`;
}

function renderWorklogPanel(entries: Array<{ category: string; icon: string; message: string; timestamp: string }>): string {
  if (entries.length === 0) {
    return `<div class="worklog-panel"><p>${t("agent.noEntriesYet")}</p></div>`;
  }
  const recentEntries = entries.slice(-10).reverse();
  const rows = recentEntries
    .map((e) => `<tr><td>${escapeHtml(e.icon)}</td><td>${escapeHtml(e.message)}</td><td>${formatTimestamp(e.timestamp)}</td></tr>`)
    .join("");
  return `
    <div class="worklog-panel">
      <h4>${t("agent.worklogTitle")}</h4>
      <table><thead><tr><th></th><th>${t("common.message")}</th><th>${t("common.time")}</th></tr></thead>
      <tbody>${rows}</tbody></table>
    </div>`;
}

function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  } catch (error) {
    logger.debug('EventHandlers', 'Failed to format timestamp', error);
    return timestamp;
  }
}

export function refreshV3Panels(ctx: EventHandlerContext): void {
  const fastApplySessions = ctx.fastApplyService.getSessions();
  ctx.model.set("fastApplySessions", fastApplySessions);
  const controls = document.querySelector<HTMLElement>("#v3-controls-root");
  if (controls) {
    controls.innerHTML = renderV3Controls(
      ctx.permissionManager.getGodMode().isActive,
      ctx.permissionManager.getGodMode().expiresAt ?? null,
      ctx.entitlementsService.checkAccess("hasGodMode"),
      ctx.model.get("multiplayerRoom"),
    );
  }
  const fastApply = document.querySelector<HTMLElement>("#fast-apply-root");
  if (fastApply) fastApply.innerHTML = renderFastApplyPanel(fastApplySessions);
  const preview = document.querySelector<HTMLElement>("#preview-status-root");
  if (preview) preview.innerHTML = renderPreviewStatus(ctx.model.get("previewConfig"));
  const shipper = document.querySelector<HTMLElement>("#shipper-status-root");
  if (shipper) shipper.innerHTML = renderShipperStatus(ctx.model.get("deployState"));
  const multiplayer = document.querySelector<HTMLElement>("#multiplayer-status-root");
  if (multiplayer) multiplayer.innerHTML = renderMultiplayerStatus(ctx.model.get("multiplayerRoom"));
}

export function refreshCentralShell(ctx: EventHandlerContext): void {
  const root = document.querySelector<HTMLElement>("#central-shell");
  if (!root) {
    return;
  }
  root.innerHTML = renderCentralShell(
    ctx.model.get("kanbanOpen"),
    ctx.model.get("activeRepoScan"),
    ctx.model.get("collapsedDirectories"),
    ctx.model.get("kanbanTasks"),
    ctx.model.get("safeDiffProposals"),
    ctx.editorController.getOpenFiles(),
    ctx.editorController.getActiveFile()?.path ?? null,
  );
  if (ctx.model.get("kanbanOpen")) {
    attachKanbanInteractions(ctx);
  } else {
    mountEditor(ctx);
    ctx.model.set("safeDiffInteractionsAttached", false);
    attachSafeDiffInteractions(ctx);
  }
}

export function initializeKeyboardShortcuts(ctx: EventHandlerContext): void {
  const defaults = createDefaultShortcuts();
  const ks = ctx.keyboardShortcuts;

  for (const shortcut of defaults) {
    switch (shortcut.action) {
      case "saveFile":
        ks.register(shortcut, () => void ctx.editorController.saveFile());
        break;
      case "closeTab":
        ks.register(shortcut, () => ctx.editorController.closeActiveTab());
        break;
      case "commandPalette":
        ks.register(shortcut, () => ks.toggleCommandPalette());
        break;
      case "undo":
        ks.register(shortcut, () => {
          const content = ctx.editorController.undo();
          if (content) {
            ctx.model.get("editorView")?.dispatch({
              changes: { from: 0, to: ctx.model.get("editorView")!.state.doc.length, insert: content },
            });
          }
        });
        break;
      case "redo":
        ks.register(shortcut, () => {
          const content = ctx.editorController.redo();
          if (content) {
            ctx.model.get("editorView")?.dispatch({
              changes: { from: 0, to: ctx.model.get("editorView")!.state.doc.length, insert: content },
            });
          }
        });
        break;
      case "searchInFiles":
        ks.register(shortcut, () => ctx.searchService.showSearchOverlay());
        break;
      case "fileSwitcher":
        ks.register(shortcut, () => {
          const files = ctx.model.get("activeRepoScan").files.map((f) => ({ path: f.path }));
          ctx.fileSearchService.setFiles(files);
          ctx.fileSearchService.showOverlay((path) => {
            const file = ctx.model.get("activeRepoScan").files.find((f) => f.path === path);
            if (file) {
              void ctx.editorController.openFile(file.absolutePath, file.path);
            }
          });
        });
        break;
      case "toggleSidebar":
        ks.register(shortcut, () => {
          document.querySelector<HTMLElement>(".global-sidebar")?.classList.toggle("collapsed");
        });
        break;
      case "toggleTerminal":
        ks.register(shortcut, () => {
          document.querySelector<HTMLButtonElement>("#terminal-toggle-button")?.click();
        });
        break;
      case "toggleTheme":
        ks.register(shortcut, () => {
          getThemeService().toggle();
        });
        break;
      default:
        ks.register(shortcut, () => {});
        break;
    }
  }

  keyboardShortcutCleanup = ks.attachGlobalListeners();

  document.querySelector<HTMLButtonElement>("#sidebar-toggle-button")?.addEventListener("click", () => {
    const sidebar = document.querySelector<HTMLElement>(".global-sidebar");
    sidebar?.classList.toggle("collapsed");
  });

  document.querySelector<HTMLButtonElement>("#undo-button")?.addEventListener("click", () => {
    const content = ctx.editorController.undo();
    if (content) {
      ctx.model.get("editorView")?.dispatch({
        changes: { from: 0, to: ctx.model.get("editorView")!.state.doc.length, insert: content },
      });
    }
  });

  document.querySelector<HTMLButtonElement>("#redo-button")?.addEventListener("click", () => {
    const content = ctx.editorController.redo();
    if (content) {
      ctx.model.get("editorView")?.dispatch({
        changes: { from: 0, to: ctx.model.get("editorView")!.state.doc.length, insert: content },
      });
    }
  });

  document.querySelectorAll<HTMLButtonElement>("[data-bottom-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-bottom-tab]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const tab = btn.dataset.bottomTab;
      const safeDiffRoot = document.querySelector<HTMLElement>("#safe-diff-root");
      if (safeDiffRoot) {
        safeDiffRoot.style.display = tab === "safe-diff" ? "" : "none";
      }
      if (tab === "terminal") {
        document.querySelector<HTMLButtonElement>("#terminal-toggle-button")?.click();
      }
    });
  });

  document.querySelector<HTMLButtonElement>(".titlebar-icon[title]")?.addEventListener("click", () => {
    ctx.model.set("auditOpen", true);
    refreshAuditOverlay(ctx);
  });
}

export function refreshKanban(ctx: EventHandlerContext): void {
  ctx.model.set("kanbanTasks", ctx.kanbanService.list());
  if (ctx.model.get("kanbanOpen")) {
    refreshCentralShell(ctx);
  }
}

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export async function refreshMarketplaceOverlay(ctx: EventHandlerContext): Promise<void> {
  const root = document.querySelector<HTMLElement>("#marketplace-root");
  if (!root) return;

  const query = ctx.model.get("marketplaceSearchQuery");
  const filterTier = ctx.model.get("marketplaceFilterTier");
  const sort = ctx.model.get("marketplaceSort");
  const snapshot = ctx.model.get("marketplaceSnapshot");
  const enterpriseSkills = ctx.model.get("enterpriseSkills");

  ctx.marketplaceSearchService.setFilter({
    tier: filterTier || undefined,
    sort: (sort || "relevance") as MarketplaceSortOption,
  });

  let searchResults: MarketplaceSearchResult[] | undefined;
  if (query?.trim()) {
    const items = snapshot.skills.map((s) => ({
      id: s.id, name: s.name, description: s.description, type: "skill" as const, tier: s.tier,
    }));
    searchResults = await ctx.marketplaceSearchService.search(items, query);
  }

  root.innerHTML = renderMarketplaceOverlay(
    ctx.model.get("marketplaceOpen"),
    ctx.model.get("onboardingOpen"),
    ctx.model.get("suggestedSkill"),
    ctx.model.get("marketplaceTab"),
    snapshot,
    ctx.model.get("marketplaceDownloads"),
    query,
    enterpriseSkills,
    searchResults,
    filterTier,
    sort,
  );
}

export function refreshInstallationProgress(ctx: EventHandlerContext): void {
  const root = document.querySelector<HTMLElement>("#installation-progress-root");
  if (root) {
    root.innerHTML = renderInstallationProgress(ctx.model.get("installationProgress"));
  }
}

export function refreshAuditOverlay(ctx: EventHandlerContext): void {
  const root = document.querySelector<HTMLElement>("#audit-root");
  if (root) {
    root.innerHTML = renderAuditOverlay(
      ctx.model.get("auditOpen"),
      ctx.model.get("currentSession"),
      ctx.model.get("auditSnapshot"),
    );
  }
}

export function refreshSettingsOverlay(ctx: EventHandlerContext): void {
  const root = document.querySelector<HTMLElement>("#settings-root");
  if (root) {
    root.innerHTML = renderSettingsOverlay(
      ctx.model.get("settingsOpen"),
      ctx.model.get("currentSession"),
      ctx.sessionUsageService.getSnapshot(),
      ctx.model.get("updateStatus"),
      ctx.model.get("byokKeys"),
      renderMcpSettingsRows(ctx.mcpRegistry.list()),
      renderIdeLanguageSwitcher(getCurrentLanguage()),
    );
  }
}

export function refreshUpgradeModal(ctx: EventHandlerContext): void {
  const root = document.querySelector<HTMLElement>("#upgrade-root");
  if (root) {
    root.innerHTML = renderUpgradeModal(ctx.model.get("upgradeModalFeature"));
  }
}

export function refreshEntitlementControls(ctx: EventHandlerContext): void {
  const voiceButton = document.querySelector<HTMLButtonElement>("#voice-record-button");
  const canUseVoice = ctx.entitlementsService.checkAccess("hasVoiceDictation");
  if (voiceButton) {
    voiceButton.classList.toggle("locked", !canUseVoice);
    voiceButton.setAttribute("aria-disabled", canUseVoice ? "false" : "true");
    voiceButton.textContent = canUseVoice ? t("voice.button") : t("voice.locked");
  }

  const enhanceButton = document.querySelector<HTMLButtonElement>("#prompt-enhance-button");
  const canEnhance = ctx.entitlementsService.checkAccess("hasAutoPromptEnhancer");
  if (enhanceButton) {
    enhanceButton.classList.toggle("locked", !canEnhance);
    enhanceButton.setAttribute("aria-disabled", canEnhance ? "false" : "true");
    enhanceButton.textContent = canEnhance ? t("promptEnhancer.button") : t("promptEnhancer.locked");
  }

  refreshV3Panels(ctx);
}

export function openAuditDashboard(ctx: EventHandlerContext): void {
  ctx.model.set("auditOpen", true);
  refreshAuditOverlay(ctx);
  void ctx.auditService.dispatchForPlan(getCurrentPlan(ctx));
}

export function closeAuditDashboard(ctx: EventHandlerContext): void {
  ctx.model.set("auditOpen", false);
  refreshAuditOverlay(ctx);
}

export function getCurrentPlan(ctx: EventHandlerContext): OclushionPlan {
  return (ctx.model.get("currentSession")?.user.plan ?? "Free") as OclushionPlan;
}

export function openUpgradeModal(ctx: EventHandlerContext, feature: EntitlementFeature): void {
  ctx.model.set("upgradeModalFeature", feature);
  refreshUpgradeModal(ctx);
}

export function closeUpgradeModal(ctx: EventHandlerContext): void {
  ctx.model.set("upgradeModalFeature", null);
  refreshUpgradeModal(ctx);
}

export function handlePlanRestriction(ctx: EventHandlerContext, error: unknown, feature: EntitlementFeature): boolean {
  if (error instanceof PlanRestrictionError) {
    appendChatMessage("status", error.message, {}, ctx);
    openUpgradeModal(ctx, feature);
    return true;
  }
  return false;
}

export function getCurrentWorkspaceId(ctx: EventHandlerContext): string {
  return ctx.model.get("activeRepoScan").rootPath;
}

export function recordAudit(
  ctx: EventHandlerContext,
  input: Omit<Parameters<typeof ctx.auditService.record>[0], "workspaceId" | "plan">,
): void {
  ctx.auditService.record({
    ...input,
    workspaceId: getCurrentWorkspaceId(ctx),
    plan: getCurrentPlan(ctx),
  });
  void ctx.auditService.dispatchForPlan(getCurrentPlan(ctx));
}

export async function runMultiAgentWorkflow(ctx: EventHandlerContext, userRequest: string): Promise<void> {
  if (!userRequest.trim()) {
    showToast({ severity: "warning", message: t("agent.emptyPrompt") });
    return;
  }
  appendChatMessage("status", t("agent.started"), {}, ctx);
  recordAudit(ctx, {
    type: "PROMPT_SENT",
    actor: "agent",
    summary: `Multi-agent workflow started for ${getSelectedModel()}`,
    metadata: {
      model: getSelectedModel(),
      promptLength: userRequest.length,
      contextTokens: ctx.model.get("activePackedContext").usedTokens,
    },
  });
  try {
    const plan = await ctx.agentOrchestrator.orchestrate({
      userRequest,
      repositoryContext: ctx.model.get("activePackedContext"),
      privacyEnabled: ctx.model.get("privacyEnabled"),
      onProposals: (proposals) => {
        ctx.model.set("safeDiffProposals", [...proposals, ...ctx.model.get("safeDiffProposals")]);
        refreshSafeDiffPanel(ctx);
      },
    });
    appendChatMessage(
      "assistant",
      `${t("agent.completed")} ${plan.tasks.length} agents ran and ${plan.tasks.flatMap((task) => task.proposals).length} ${t("safeDiff.pending", { count: plan.tasks.flatMap((task) => task.proposals).length })} are ready in Safe Diff.`,
      {},
      ctx,
    );
    ctx.sessionUsageService.recordPrompt(
      ctx.model.get("activePackedContext").usedTokens + estimateTokensFromText(userRequest),
      plan.tasks.reduce((sum, task) => sum + task.creditsUsed, 0),
    );
  } catch (error) {
    appendChatMessage("status", error instanceof Error ? error.message : t("agent.failed"), {}, ctx);
  }
}

export async function sendKanbanTaskToAgents(ctx: EventHandlerContext, taskId: string): Promise<void> {
  const task = ctx.model.get("kanbanTasks").find((candidate) => candidate.id === taskId);
  if (!task) {
    return;
  }
  appendChatMessage("status", `${t("kanban.sendAi")} ${task.title}`, {}, ctx);
  try {
    const updatedTask = await ctx.taskHandoff.sendToAgents({
      task,
      repositoryContext: ctx.model.get("activePackedContext"),
      privacyEnabled: ctx.model.get("privacyEnabled"),
    });
    ctx.model.set("safeDiffProposals", [...(updatedTask.proposals ?? []), ...ctx.model.get("safeDiffProposals")]);
    refreshSafeDiffPanel(ctx);
    refreshKanban(ctx);
    recordAudit(ctx, {
      type: "PROMPT_SENT",
      actor: "agent",
      summary: `Kanban task completed by AI Builder: ${task.title}`,
      metadata: {
        taskId: task.id,
        creditsUsed: updatedTask.creditsUsed ?? 0,
        proposalCount: updatedTask.proposals?.length ?? 0,
      },
    });
  } catch (error) {
    await ctx.kanbanService.updateTask(task.id, { column: "review" });
    refreshKanban(ctx);
    appendChatMessage("status", error instanceof Error ? error.message : t("agent.failed"), {}, ctx);
  }
}

export async function loadMarketplaceCatalog(ctx: EventHandlerContext): Promise<void> {
  try {
    await ctx.marketplaceService.refreshCatalog();
    ctx.model.set("marketplaceSnapshot", await ctx.marketplaceService.snapshot(ctx.model.get("currentSession")?.user.plan.toLowerCase() as import("../marketplace/marketplace.types").UserTier | undefined));
    ctx.model.set("onboardingError", "");
  } catch (error) {
    logger.warn('EventHandlers', 'Failed to load marketplace catalog', error);
    ctx.model.set("marketplaceSnapshot", {
      skills: [],
      tools: [],
      installedSkills: await ctx.marketplaceService.skillsInstaller.listInstalled(),
      installedTools: await ctx.marketplaceService.toolsInstaller.listInstalled(),
    });
  }
  const org = getOrganization();
  if (org) {
    const snapshot = ctx.model.get("marketplaceSnapshot");
    const installedSkillIds = snapshot.installedSkills.map((s) => s.id);
    const installedSkillVersions = new Map(snapshot.installedSkills.map((s) => [s.id, s.version]));
    const unified = buildUnifiedSkillList(ctx.marketplaceService.getCatalog(), installedSkillIds, installedSkillVersions);
    const enterprise = unified
      .filter((u) => u.source === "org")
      .map((u) => ({ ...u.skill, installState: u.installState, lockResult: undefined }));
    ctx.model.set("enterpriseSkills", enterprise);
  } else {
    ctx.model.set("enterpriseSkills", []);
  }
  void ctx.marketplaceService.initializeEmbedder();
  refreshMarketplaceOverlay(ctx);
}

export async function openMarketplace(ctx: EventHandlerContext): Promise<void> {
  ctx.model.set("marketplaceOpen", true);
  refreshMarketplaceOverlay(ctx);
  await loadMarketplaceCatalog(ctx);
}

export function closeMarketplace(ctx: EventHandlerContext): void {
  ctx.model.set("marketplaceOpen", false);
  refreshMarketplaceOverlay(ctx);
}

export async function installMarketplaceSkillpack(ctx: EventHandlerContext, skillpackId: string): Promise<void> {
  ctx.model.get("marketplaceDownloads").add(skillpackId);
  refreshMarketplaceOverlay(ctx);

  const snapshot = ctx.model.get("marketplaceSnapshot");
  const skill = snapshot.skills.find((s) => s.id === skillpackId);
  if (!skill) {
    ctx.model.get("marketplaceDownloads").delete(skillpackId);
    refreshMarketplaceOverlay(ctx);
    return;
  }

  const progressId = ctx.installationProgressService.startBatch(
    t("installation.installingSkills"),
    [{ id: skill.id, name: skill.name, version: skill.version }],
  );
  ctx.model.set("installationProgress", ctx.installationProgressService.getSnapshot());
  refreshInstallationProgress(ctx);

  ctx.installationProgressService.updateTask(skill.id, "downloading", "active", 0);
  ctx.model.set("installationProgress", ctx.installationProgressService.getSnapshot());
  refreshInstallationProgress(ctx);

  try {
    await ctx.marketplaceService.installSkill(skillpackId, (step, progress) => {
      const stepStatus = progress === 100 ? "completed" : "active";
      const taskProgress = step === "downloading" ? progress : step === "verifying" ? progress : step === "writing" ? progress : progress;
      ctx.installationProgressService.updateTask(skill.id, step as InstallationStep, stepStatus, taskProgress);
      ctx.model.set("installationProgress", ctx.installationProgressService.getSnapshot());
      refreshInstallationProgress(ctx);
    });

    ctx.installationProgressService.updateTask(skill.id, "activating", "completed", 100);
    ctx.model.set("installationProgress", ctx.installationProgressService.getSnapshot());
    refreshInstallationProgress(ctx);

    ctx.installationProgressService.completeBatch(true);
    ctx.model.set("installationProgress", ctx.installationProgressService.getSnapshot());
    refreshInstallationProgress(ctx);

    await loadMarketplaceCatalog(ctx);
  } catch (error) {
    ctx.installationProgressService.updateTask(skill.id, "downloading", "failed", 0, error instanceof Error ? error.message : "Unknown error");
    ctx.model.set("installationProgress", ctx.installationProgressService.getSnapshot());
    refreshInstallationProgress(ctx);

    ctx.installationProgressService.completeBatch(false);
    ctx.model.set("installationProgress", ctx.installationProgressService.getSnapshot());
    refreshInstallationProgress(ctx);
  } finally {
    ctx.model.get("marketplaceDownloads").delete(skillpackId);
    refreshMarketplaceOverlay(ctx);
  }
}

export async function uninstallMarketplaceSkillpack(ctx: EventHandlerContext, skillpackId: string): Promise<void> {
  await ctx.marketplaceService.uninstallSkill(skillpackId);
  await loadMarketplaceCatalog(ctx);
}

export async function updateMarketplaceSkillpack(ctx: EventHandlerContext, skillpackId: string): Promise<void> {
  ctx.model.get("marketplaceDownloads").add(skillpackId);
  refreshMarketplaceOverlay(ctx);
  try {
    await ctx.marketplaceService.installSkill(skillpackId);
    await loadMarketplaceCatalog(ctx);
  } finally {
    ctx.model.get("marketplaceDownloads").delete(skillpackId);
    refreshMarketplaceOverlay(ctx);
  }
}

export async function updateAllMarketplaceSkillpacks(ctx: EventHandlerContext): Promise<void> {
  for (const skill of ctx.model.get("marketplaceSnapshot").skills.filter((entry) => entry.installState === "update_available")) {
    await ctx.marketplaceService.installSkill(skill.id);
  }
  for (const tool of ctx.model.get("marketplaceSnapshot").tools.filter((entry) => entry.installState === "update_available")) {
    await installMarketplaceTool(ctx, tool.id);
  }
  await loadMarketplaceCatalog(ctx);
}

export async function installMarketplaceTool(ctx: EventHandlerContext, toolId: string): Promise<void> {
  ctx.model.get("marketplaceDownloads").add(toolId);
  refreshMarketplaceOverlay(ctx);
  try {
    await ctx.marketplaceService.installTool(ctx.model.get("activeRepoScan").rootPath, toolId);
    await loadMarketplaceCatalog(ctx);
  } finally {
    ctx.model.get("marketplaceDownloads").delete(toolId);
    refreshMarketplaceOverlay(ctx);
  }
}

export async function uninstallMarketplaceTool(ctx: EventHandlerContext, toolId: string): Promise<void> {
  await ctx.marketplaceService.uninstallTool(ctx.model.get("activeRepoScan").rootPath, toolId);
  await loadMarketplaceCatalog(ctx);
}

export async function installMarketplaceProfile(ctx: EventHandlerContext, profileId: string): Promise<void> {
  ctx.model.set("onboardingError", "");
  refreshMarketplaceOverlay(ctx);
  try {
    if (!ctx.marketplaceService.getCatalog().skills.length) {
      await ctx.marketplaceService.refreshCatalog();
      ctx.model.set("marketplaceSnapshot", await ctx.marketplaceService.snapshot(ctx.model.get("currentSession")?.user.plan.toLowerCase() as import("../marketplace/marketplace.types").UserTier | undefined));
    }
    await ctx.marketplaceService.installProfile(profileId as import("../marketplace/marketplace.types").WorkProfileId);
    ctx.model.set("onboardingOpen", false);
    await loadMarketplaceCatalog(ctx);
  } catch (error) {
    ctx.model.set("onboardingError", error instanceof Error ? error.message : t("marketplace.unavailable"));
    ctx.model.set("onboardingOpen", true);
    refreshMarketplaceOverlay(ctx);
  }
}

export async function continueSuggestedSkill(ctx: EventHandlerContext, install: boolean): Promise<void> {
  const originalMessage = ctx.model.get("pendingSuggestedMessage");
  const skillId = ctx.model.get("suggestedSkill")?.skill.id;
  ctx.model.set("suggestedSkill", null);
  ctx.model.set("pendingSuggestedMessage", "");
  refreshMarketplaceOverlay(ctx);
  if (install && skillId) {
    await ctx.marketplaceService.installSkill(skillId);
    await loadMarketplaceCatalog(ctx);
  }
  const input = document.querySelector<HTMLInputElement>("#chat-input");
  if (input && originalMessage) {
    input.value = originalMessage;
    await runChatOrchestrator(ctx, true);
  }
}

export function openSettings(ctx: EventHandlerContext): void {
  ctx.model.set("settingsOpen", true);
  refreshSettingsOverlay(ctx);
  void refreshSpendCap(ctx);
}

export function closeSettings(ctx: EventHandlerContext): void {
  ctx.model.set("settingsOpen", false);
  refreshSettingsOverlay(ctx);
}

export async function saveByokSettings(ctx: EventHandlerContext): Promise<void> {
  await ctx.secureKeysService.saveApiKey(
    "openai",
    document.querySelector<HTMLInputElement>("#openai-key-input")?.value ?? "",
  );
  await ctx.secureKeysService.saveApiKey(
    "anthropic",
    document.querySelector<HTMLInputElement>("#anthropic-key-input")?.value ?? "",
  );
  ctx.model.set("byokKeys", await ctx.secureKeysService.loadAll());
  showToast({ severity: "success", message: t("settings.localKeysSaved") });
}

export async function refreshCreditBalance(ctx: EventHandlerContext): Promise<void> {
  const target = document.querySelector<HTMLElement>("#credit-balance-value");
  const currentSession = ctx.model.get("currentSession");
  if (!target || !currentSession) {
    return;
  }
  target.textContent = t("settings.creditsReady");
  try {
    const response = await fetch(`${getControlApiUrl()}/v1/desktop/credits/balance`, {
      headers: {
        Authorization: `Bearer ${currentSession.token}`,
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const raw = await response.json();
    const payload = balanceResponseSchema.parse(raw);
    target.textContent = t("settings.creditsValue", { count: payload.balance ?? 0 });
  } catch (error) {
    logger.debug('EventHandlers', 'Failed to fetch credits balance', error);
    target.textContent = t("settings.creditsSignIn");
  }
}

export async function openCreditsPortal(ctx: EventHandlerContext): Promise<void> {
  const currentSession = ctx.model.get("currentSession");
  if (!currentSession) {
    showToast({ severity: "warning", message: t("settings.signInBeforeCredits") });
    return;
  }
  const response = await fetch(`${getControlApiUrl()}/v1/billing/create-checkout-session`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${currentSession.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ packageId: "credits_20k" }),
  });
  if (!response.ok) {
    showToast({ severity: "error", message: t("settings.checkoutFailed", { status: response.status }) });
    return;
  }
  const raw = await response.json();
  const payload = checkoutSessionSchema.parse(raw);
  if (payload.url) {
    await openUrl(payload.url);
  }
}

export async function refreshSpendCap(ctx: EventHandlerContext): Promise<void> {
  const input = document.querySelector<HTMLInputElement>("#daily-spend-limit-input");
  const currentSession = ctx.model.get("currentSession");
  if (!input || !currentSession) {
    return;
  }
  const response = await fetch(`${getControlApiUrl()}/v1/desktop/spend-cap`, {
    headers: {
      Authorization: `Bearer ${currentSession.token}`,
    },
  });
  if (!response.ok) {
    return;
  }
  const raw = await response.json();
  const payload = spendCapSchema.parse(raw);
  input.value = String(payload.dailySpendLimit ?? "");
  const target = document.querySelector<HTMLElement>("#credit-balance-value");
  if (target && typeof payload.currentDailySpend === "number") {
    target.textContent = `${target.textContent ?? t("settings.creditsReady")} - ${t("settings.creditsUsedSession")}: ${payload.currentDailySpend}`;
  }
}

export async function saveSpendCap(ctx: EventHandlerContext): Promise<void> {
  const currentSession = ctx.model.get("currentSession");
  if (!currentSession) {
    showToast({ severity: "warning", message: t("settings.signInBeforeSpendCaps") });
    return;
  }
  const input = document.querySelector<HTMLInputElement>("#daily-spend-limit-input");
  const dailySpendLimit = Number.parseInt(input?.value ?? "0", 10);
  const response = await fetch(`${getControlApiUrl()}/v1/desktop/spend-cap`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${currentSession.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ dailySpendLimit: Number.isFinite(dailySpendLimit) ? dailySpendLimit : 0 }),
  });
  showToast({
    severity: response.ok ? "success" : "error",
    message: response.ok ? t("settings.spendCapSaved") : t("settings.spendCapFailed", { status: response.status }),
  });
}

export async function saveMcpIntegration(ctx: EventHandlerContext, provider: MCPProviderId): Promise<void> {
  const enabled = document.querySelector<HTMLInputElement>(`[data-mcp-enabled="${provider}"]`)?.checked ?? false;
  const apiToken = document.querySelector<HTMLInputElement>(`[data-mcp-token="${provider}"]`)?.value.trim();
  const baseUrl = document.querySelector<HTMLInputElement>(`[data-mcp-url="${provider}"]`)?.value.trim();
  const current = ctx.mcpRegistry.get(provider);
  await ctx.mcpRegistry.configure({
    ...current,
    enabled,
    apiToken: apiToken || current.apiToken,
    baseUrl: baseUrl || current.baseUrl,
  });
  refreshSettingsOverlay(ctx);
}

export async function checkDesktopUpdates(ctx: EventHandlerContext): Promise<void> {
  try {
    const update = await check();
    currentDesktopUpdate = update;
    ctx.model.set("updateStatus", update?.available
      ? `${t("common.update")} ${update.version}`
      : t("workspace.ready"));
  } catch (error) {
    logger.debug('EventHandlers', 'Failed to check for updates', error);
    ctx.model.set("updateStatus", t("common.offline"));
  }
  refreshSettingsOverlay(ctx);
}

export async function installDesktopUpdate(ctx: EventHandlerContext): Promise<void> {
  if (!currentDesktopUpdate) return;
  ctx.model.set("updateStatus", t("common.updaterDownloading"));
  try {
    await currentDesktopUpdate.downloadAndInstall();
    ctx.model.set("updateStatus", t("common.updaterRestart"));
  } catch (error) {
    logger.error('EventHandlers', 'Failed to install update', error);
    ctx.model.set("updateStatus", t("common.offline"));
    playErrorSound();
  }
}

function findSafeDiffProposal(ctx: EventHandlerContext, id: string): SafeDiffProposal | undefined {
  return ctx.model.get("safeDiffProposals").find((proposal) => proposal.id === id);
}

function updateSafeDiffProposal(ctx: EventHandlerContext, id: string, updater: (proposal: SafeDiffProposal) => SafeDiffProposal): void {
  ctx.model.set("safeDiffProposals", ctx.model.get("safeDiffProposals").map((proposal) => (proposal.id === id ? updater(proposal) : proposal)));
  refreshSafeDiffPanel(ctx);
}

export function approveSafeDiffProposal(ctx: EventHandlerContext, id: string): void {
  const proposal = findSafeDiffProposal(ctx, id);
  if (!proposal || proposal.kind !== "code") {
    return;
  }
  const editorView = ctx.model.get("editorView");
  editorView?.dispatch({
    changes: { from: 0, to: editorView.state.doc.length, insert: proposal.content },
  });
  updateSafeDiffProposal(ctx, id, (current) => ({ ...current, status: "approved" }));
  recordAudit(ctx, {
    type: "CODE_APPROVED",
    actor: "developer",
    summary: `Approved Safe Diff proposal: ${proposal.title}`,
    metadata: {
      proposalId: proposal.id,
      language: proposal.language || "plain",
      contentLength: proposal.content.length,
    },
  });
  appendChatMessage("status", `${t("safeDiff.title")} ${proposal.title}`, {}, ctx);
}

export async function fastApplyProposal(ctx: EventHandlerContext, id: string): Promise<void> {
  const proposal = findSafeDiffProposal(ctx, id);
  if (!proposal || proposal.kind !== "code") {
    return;
  }
  const target = inferFastApplyTargetPath(ctx, proposal);
  if (!target) {
    showToast({ severity: "warning", message: t("fastApply.needsRepo") });
    return;
  }
  const decision = await ctx.permissionManager.shouldPromptUser("file_write", target);
  if (decision.shouldPrompt && !window.confirm(t("fastApply.confirmWrite", { path: target }))) {
    return;
  }
  const session = await ctx.fastApplyService.applyChange({
    path: target,
    newContent: proposal.content,
    taskId: proposal.id,
    agentRole: "builder",
  });
  updateSafeDiffProposal(ctx, id, (current) => ({ ...current, status: "approved" }));
  refreshV3Panels(ctx);
  appendChatMessage("status", t("fastApply.wroteFile", { path: target, sessionId: session.id }), {}, ctx);
}

function inferFastApplyTargetPath(ctx: EventHandlerContext, proposal: SafeDiffProposal): string | null {
  const explicit = proposal.content.match(/^\s*(?:\/\/|#)\s*(?:file|path):\s*(.+)$/imu)?.[1]?.trim();
  if (explicit) {
    return explicit;
  }
  const extension = proposal.language === "tsx" ? "tsx" : proposal.language === "ts" ? "ts" : "";
  const candidate = ctx.model.get("activeRepoScan").files.find((file) => {
    if (!extension) return file.type === "source";
    return file.extension === extension;
  });
  return candidate?.absolutePath ?? null;
}

export function rejectSafeDiffProposal(ctx: EventHandlerContext, id: string): void {
  const proposal = findSafeDiffProposal(ctx, id);
  ctx.model.set("safeDiffProposals", ctx.model.get("safeDiffProposals").filter((candidate) => candidate.id !== id));
  refreshSafeDiffPanel(ctx);
  if (proposal) {
    recordAudit(ctx, {
      type: "CODE_REJECTED",
      actor: "developer",
      summary: `Rejected Safe Diff proposal: ${proposal.title}`,
      metadata: {
        proposalId: proposal.id,
        kind: proposal.kind,
        language: proposal.language || "plain",
      },
    });
  }
  appendChatMessage("status", proposal ? t("safeDiff.rejectedProposal", { title: proposal.title }) : t("safeDiff.rejectedProposalGeneric"), {}, ctx);
}

export function queueCommandProposal(ctx: EventHandlerContext, id: string): void {
  const proposal = findSafeDiffProposal(ctx, id);
  if (!proposal || proposal.kind !== "command") {
    return;
  }
  updateSafeDiffProposal(ctx, id, (current) => ({ ...current, status: "queued" }));
  recordAudit(ctx, {
    type: "COMMAND_EXECUTED",
    actor: "developer",
    summary: `Command approved from quarantine: ${proposal.title}`,
    metadata: {
      proposalId: proposal.id,
      commandLength: proposal.content.length,
      language: proposal.language || "shell",
    },
  });
  appendChatMessage("status", `${t("safeDiff.command")} ${proposal.content}`, {}, ctx);
}

export async function explainSafeDiffProposal(ctx: EventHandlerContext, id: string): Promise<void> {
  const proposal = findSafeDiffProposal(ctx, id);
  if (!proposal) {
    return;
  }
  updateSafeDiffProposal(ctx, id, (current) => ({ ...current, status: "explained" }));
  appendChatMessage("status", `${t("common.explain")} ${proposal.title}`, {}, ctx);
  const response = await ctx.modelRouter.generate({
    model: getSelectedModel(),
    systemPrompt: "You are Oclushion Safe Diff Explainer. Explain proposed code or commands clearly and mention risks.",
    userMessage: `Explain what this ${proposal.kind} does in detail:\n\n${proposal.content}`,
  });
  appendChatMessage("assistant", `[${response.provider}/${response.model} - ${response.latencyMs}ms]\n${response.content}`, {}, ctx);
}

export async function enhancePromptInput(ctx: EventHandlerContext): Promise<void> {
  const input = document.querySelector<HTMLInputElement>("#chat-input");
  const basicPrompt = input?.value.trim();
  if (!input || !basicPrompt || ctx.model.get("promptEnhancing")) {
    return;
  }
  try {
    ctx.entitlementsService.assertAccess("hasAutoPromptEnhancer", "Auto-Prompt Enhancer");
  } catch (error) {
    if (handlePlanRestriction(ctx, error, "hasAutoPromptEnhancer")) return;
    throw error;
  }
  ctx.model.set("promptEnhancing", true);
  input.classList.add("enhancing");
  try {
    const enhanced = await ctx.promptEnhancer.enhance({
      basicPrompt,
      repo: ctx.model.get("activeRepoScan"),
      model: getSelectedModel(),
    });
    input.value = enhanced;
    recordAudit(ctx, {
      type: "PROMPT_ENHANCED",
      actor: "developer",
      summary: t("promptEnhancer.audit"),
      metadata: { originalLength: basicPrompt.length, enhancedLength: enhanced.length },
    });
  } catch (error) {
    appendChatMessage("status", error instanceof Error ? error.message : t("promptEnhancer.failed"), {}, ctx);
  } finally {
    ctx.model.set("promptEnhancing", false);
    input.classList.remove("enhancing");
  }
}

export async function startVoiceRecording(ctx: EventHandlerContext): Promise<void> {
  if (ctx.model.get("voiceRecording")) return;
  try {
    validateVoiceDictationAccess(ctx.entitlementsService);
  } catch (error) {
    if (handlePlanRestriction(ctx, error, "hasVoiceDictation")) return;
    throw error;
  }
  ctx.model.set("voiceRecording", true);
  document.querySelector<HTMLButtonElement>("#voice-record-button")?.classList.add("recording");
  try {
    await ctx.voiceCapture.startRecording();
  } catch (error) {
    ctx.model.set("voiceRecording", false);
    document.querySelector<HTMLButtonElement>("#voice-record-button")?.classList.remove("recording");
    appendChatMessage("status", error instanceof Error ? error.message : t("voice.failedRecording"), {}, ctx);
  }
}

export async function stopVoiceRecording(ctx: EventHandlerContext): Promise<void> {
  if (!ctx.model.get("voiceRecording")) return;
  ctx.model.set("voiceRecording", false);
  const button = document.querySelector<HTMLButtonElement>("#voice-record-button");
  button?.classList.remove("recording");
  button?.classList.add("processing");
  try {
    const audio = await ctx.voiceCapture.stopRecording();
    const text = await ctx.voiceCapture.transcribe(audio);
    const input = document.querySelector<HTMLInputElement>("#chat-input");
    if (input) input.value = text;
    recordAudit(ctx, {
      type: "VOICE_TRANSCRIBED",
      actor: "developer",
      summary: t("voice.audit"),
      metadata: { characters: text.length },
    });
  } catch (error) {
    appendChatMessage("status", error instanceof Error ? error.message : t("voice.failedTranscription"), {}, ctx);
  } finally {
    button?.classList.remove("processing");
  }
}

export async function toggleGodMode(ctx: EventHandlerContext): Promise<void> {
  const current = ctx.permissionManager.getGodMode();
  if (current.isActive) {
    ctx.permissionManager.disableGodMode();
    recordAudit(ctx, { type: "GOD_MODE_DISABLED", actor: "developer", summary: t("godMode.disabledAudit"), metadata: {} });
    refreshV3Panels(ctx);
    return;
  }
  try {
    validateGodModeAccess(ctx.entitlementsService);
  } catch (error) {
    if (handlePlanRestriction(ctx, error, "hasGodMode")) return;
    throw error;
  }
  const first = window.confirm(t("godMode.warning"));
  const second = first && window.confirm(t("godMode.confirm"));
  if (!second) return;
  const session = ctx.permissionManager.enableGodMode("project-only");
  recordAudit(ctx, {
    type: "GOD_MODE_ENABLED",
    actor: "developer",
    summary: t("godMode.enabledAudit"),
    metadata: { scope: session.scope, expiresAt: session.expiresAt ?? null },
  });
  refreshV3Panels(ctx);
}

export async function openLivePreview(ctx: EventHandlerContext): Promise<void> {
  const previewConfig = await ctx.previewService.startPreviewServer({
    workspacePath: ctx.model.get("activeRepoScan").rootPath,
    framework: ctx.model.get("activeRepoScan").detectedFramework?.toLowerCase().includes("next") ? "nextjs" : "vite",
  });
  ctx.model.set("previewConfig", previewConfig);
  await ctx.previewWindow.open(previewConfig.url).catch(() => undefined);
  recordAudit(ctx, {
    type: "PREVIEW_STARTED",
    actor: "developer",
    summary: `Live preview attached to ${previewConfig.url}`,
    metadata: { url: previewConfig.url, framework: previewConfig.framework },
  });
  refreshV3Panels(ctx);
}

export async function toggleMultiplayer(ctx: EventHandlerContext): Promise<void> {
  if (ctx.model.get("multiplayerRoom")) {
    ctx.multiplayerService.disconnect();
    ctx.model.set("multiplayerRoom", null);
  } else {
    const room = await ctx.multiplayerService.joinRoom({
      roomId: `repo-${encodeWorkspaceRoomId(ctx.model.get("activeRepoScan").rootPath)}`,
      roomName: getRepoName(ctx.model.get("activeRepoScan")),
      serverUrl: readLocalSetting("oclushion.multiplayer.server-url") || "ws://localhost:1234",
    });
    ctx.model.set("multiplayerRoom", room);
    ctx.multiplayerService.bindFileToDoc("active-editor");
    recordAudit(ctx, {
      type: "MULTIPLAYER_JOINED",
      actor: "developer",
      summary: `Joined multiplayer room ${room.id}`,
      metadata: { roomId: room.id },
    });
  }
  refreshV3Panels(ctx);
}

function encodeWorkspaceRoomId(workspacePath: string): string {
  return encodeURIComponent(workspacePath)
    .replace(/%/g, "")
    .replace(/[^a-z0-9]/giu, "")
    .slice(0, 24)
    .toLowerCase() || "local";
}

export async function runShipperAgent(ctx: EventHandlerContext): Promise<void> {
  const token = readLocalSetting("oclushion.deploy.vercel-token");
  const projectId = readLocalSetting("oclushion.deploy.project-id");
  if (!token || !projectId) {
    showToast({ severity: "warning", message: t("shipper.missingConfig") });
    return;
  }
  const deployState = await ctx.shipperService.ship({
    workspacePath: ctx.model.get("activeRepoScan").rootPath,
    branchName: `oclushion/ship-${Date.now()}`,
    commitMessage: "feat(oclushion): ship AI approved changes",
    config: {
      provider: "vercel",
      token,
      projectId,
      productionBranch: "main",
      healthUrl: readLocalSetting("oclushion.deploy.health-url") || undefined,
    },
  });
  ctx.model.set("deployState", deployState);
  refreshV3Panels(ctx);
}

export async function resolveFastApplyAction(ctx: EventHandlerContext, action: string, path?: string, sessionId?: string): Promise<void> {
  const fastApplySessions = ctx.model.get("fastApplySessions");
  const targetSessionId = sessionId || fastApplySessions.find((session) => session.status === "pending")?.id;
  if (!targetSessionId) return;
  if (action === "accept-file" && path) await ctx.fastApplyService.acceptFile(path, targetSessionId);
  if (action === "revert-file" && path) await ctx.fastApplyService.revertFile(path, targetSessionId);
  if (action === "accept-all") await ctx.fastApplyService.acceptAll(targetSessionId);
  if (action === "revert-all") await ctx.fastApplyService.revertAll(targetSessionId);
  refreshV3Panels(ctx);
}

export function attachSafeDiffInteractions(ctx: EventHandlerContext): void {
  if (ctx.model.get("safeDiffInteractionsAttached")) {
    return;
  }
  ctx.model.set("safeDiffInteractionsAttached", true);
  document.querySelector<HTMLElement>("#safe-diff-root")?.addEventListener("click", (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest<HTMLButtonElement>("button[data-action]") : null;
    const action = target?.dataset.action;
    const proposalId = target?.dataset.proposalId;
    if (!action || !proposalId) {
      return;
    }

    if (action === "approve") {
      approveSafeDiffProposal(ctx, proposalId);
    } else if (action === "fast-apply") {
      void fastApplyProposal(ctx, proposalId);
    } else if (action === "reject") {
      rejectSafeDiffProposal(ctx, proposalId);
    } else if (action === "run-command") {
      queueCommandProposal(ctx, proposalId);
    } else if (action === "explain") {
      void explainSafeDiffProposal(ctx, proposalId);
    }
  });
}

export function attachAgentInteractions(ctx: EventHandlerContext): void {
  if (ctx.model.get("agentInteractionsAttached")) {
    return;
  }
  ctx.model.set("agentInteractionsAttached", true);
  document.querySelector<HTMLElement>("#agent-progress-root")?.addEventListener("click", (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.id === "run-agent-workflow-button") {
      const prompt = document.querySelector<HTMLInputElement>("#chat-input")?.value.trim() || t("agent.started");
      void runMultiAgentWorkflow(ctx, prompt);
    } else if (target?.id === "cancel-agent-session-button" && ctx.model.get("agentSnapshot").activePlan) {
      ctx.agentOrchestrator.cancel(ctx.model.get("agentSnapshot").activePlan!.id);
    }
  });
}

export function attachV3Interactions(ctx: EventHandlerContext): void {
  if (attachedInteractions.has("v3")) return;
  attachedInteractions.add("v3");

  document.querySelector<HTMLElement>("#v3-controls-root")?.addEventListener("click", (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.id === "god-mode-toggle") void toggleGodMode(ctx);
    if (target?.id === "open-live-preview-button") void openLivePreview(ctx);
    if (target?.id === "join-multiplayer-button") void toggleMultiplayer(ctx);
    if (target?.id === "shipper-run-button") void runShipperAgent(ctx);
  });
  document.querySelector<HTMLElement>("#fast-apply-root")?.addEventListener("click", (event) => {
    const button = event.target instanceof HTMLElement ? event.target.closest<HTMLButtonElement>("button[data-fast-apply-action]") : null;
    if (!button) return;
    void resolveFastApplyAction(
      ctx,
      button.dataset.fastApplyAction ?? "",
      button.dataset.fastApplyPath,
      button.dataset.fastApplySession,
    );
  });
  document.querySelector<HTMLButtonElement>("#prompt-enhance-button")?.addEventListener("click", () => {
    void enhancePromptInput(ctx);
  });
  const voiceButton = document.querySelector<HTMLButtonElement>("#voice-record-button");
  voiceButton?.addEventListener("pointerdown", () => {
    void startVoiceRecording(ctx);
  });
  voiceButton?.addEventListener("pointerup", () => {
    void stopVoiceRecording(ctx);
  });
  voiceButton?.addEventListener("pointerleave", () => {
    void stopVoiceRecording(ctx);
  });
}

export function attachPhase3Interactions(ctx: EventHandlerContext): void {
  if (attachedInteractions.has("phase3")) return;
  attachedInteractions.add("phase3");

  document.querySelector<HTMLButtonElement>("#git-refresh-btn")?.addEventListener("click", () => {
    void refreshGitStatus(ctx);
  });
  document.querySelector<HTMLButtonElement>("#git-commit-btn")?.addEventListener("click", () => {
    const msg = prompt("Commit message:");
    if (msg) void doGitCommit(ctx, msg);
  });
  document.querySelector<HTMLButtonElement>("#git-log-btn")?.addEventListener("click", () => {
    void showGitLog(ctx);
  });
  document.querySelector("#git-status-list")?.addEventListener("click", (event) => {
    const btn = event.target instanceof Element ? (event.target as HTMLElement).closest("button[data-git-stage]") : null;
    if (btn) {
      const path = (btn as HTMLElement).dataset.gitStage;
      if (path) void stageGitFile(ctx, path);
    }
  });

  document.querySelector<HTMLButtonElement>("#test-run-btn")?.addEventListener("click", () => {
    void runTests(ctx);
  });
  document.querySelector<HTMLButtonElement>("#test-detect-btn")?.addEventListener("click", () => {
    void detectTestFramework(ctx);
  });

  document.querySelector<HTMLButtonElement>("#suggestions-refresh-btn")?.addEventListener("click", () => {
    void refreshTerminalSuggestions(ctx);
  });
  document.querySelector("#suggestions-list")?.addEventListener("click", (event) => {
    const btn = event.target instanceof Element ? (event.target as HTMLElement).closest("button[data-suggest-cmd]") : null;
    if (btn) {
      const cmd = (btn as HTMLElement).dataset.suggestCmd;
      if (cmd) executeSuggestedCommand(ctx, cmd);
    }
  });

  document.querySelector<HTMLButtonElement>("#add-agent-button")?.addEventListener("click", () => {
    openAgentConfig(ctx);
  });

  document.querySelector<HTMLElement>("#settings-root")?.addEventListener("click", (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.id === "save-agent-config-btn") {
      void saveAgentConfigFromForm(ctx);
    }
    if (target?.id === "export-agent-yaml-btn") {
      void exportAgentYaml(ctx);
    }
    if (target?.id === "import-agent-yaml-btn") {
      void importAgentYaml(ctx);
    }
  });
}

async function refreshGitStatus(ctx: EventHandlerContext): Promise<void> {
  const rootPath = ctx.model.get("activeRepoScan").rootPath;
  if (!rootPath) return;
  const { GitWorkflowService } = await import("../editor/git-workflow.service");
  const git = new GitWorkflowService();
  const branches = await git.listBranches(rootPath);
  const currentBranch = branches.find((b) => b.current)?.name ?? "main";
  document.querySelector("#git-branch-name")!.textContent = currentBranch;

  const { GitStatusService } = await import("../editor/git-status.service");
  const statusService = new GitStatusService();
  const statuses = await statusService.refresh(rootPath);
  const list = document.querySelector("#git-status-list");
  if (!list) return;
  const entries = Array.from(statuses.entries());
  if (entries.length === 0) {
    list.innerHTML = `<small>${t("git.workingTreeClean")}</small>`;
    return;
  }
  list.innerHTML = entries.map(([path, status]) =>
    `<div class="git-status-item ${status}">
      <span class="git-status-badge">${(status[0] ?? "?").toUpperCase()}</span>
      <span class="git-status-path">${path}</span>
      <button data-git-stage="${path}" type="button" class="git-stage-btn" title="${t("git.stageFile")}">+</button>
    </div>`
  ).join("");
}

async function doGitCommit(ctx: EventHandlerContext, message: string): Promise<void> {
  const rootPath = ctx.model.get("activeRepoScan").rootPath;
  if (!rootPath) return;
  const { GitWorkflowService } = await import("../editor/git-workflow.service");
  const git = new GitWorkflowService();
  const ok = await git.commit(rootPath, message);
  if (ok) {
    alert("Commit successful");
    void refreshGitStatus(ctx);
  } else {
    alert("Commit failed");
  }
}

async function showGitLog(ctx: EventHandlerContext): Promise<void> {
  const rootPath = ctx.model.get("activeRepoScan").rootPath;
  if (!rootPath) return;
  const { GitWorkflowService } = await import("../editor/git-workflow.service");
  const git = new GitWorkflowService();
  const log = await git.getLog(rootPath);
  const list = document.querySelector("#git-status-list");
  if (!list) return;
  list.innerHTML = "<header class='git-log-header'><button id='git-back-to-status' type='button'>← Status</button><span>Recent Commits</span></header>" +
    log.map((c) => `<div class="git-log-item"><strong>${c.hash}</strong><span>${c.message}</span><small>${c.author} · ${new Date(c.date).toLocaleDateString()}</small></div>`).join("");
  document.querySelector<HTMLButtonElement>("#git-back-to-status")?.addEventListener("click", () => {
    void refreshGitStatus(ctx);
  });
}

async function stageGitFile(ctx: EventHandlerContext, path: string): Promise<void> {
  const rootPath = ctx.model.get("activeRepoScan").rootPath;
  if (!rootPath) return;
  const { GitWorkflowService } = await import("../editor/git-workflow.service");
  const git = new GitWorkflowService();
  await git.stageFile(rootPath, path);
  void refreshGitStatus(ctx);
}

async function runTests(ctx: EventHandlerContext): Promise<void> {
  const rootPath = ctx.model.get("activeRepoScan").rootPath;
  if (!rootPath) return;
  const { TestRunnerService } = await import("../test-runner/test-runner.service");
  const runner = new TestRunnerService();
  const summary = await runner.runTests(rootPath);
  const resultsEl = document.querySelector("#test-results");
  const fwEl = document.querySelector("#test-framework-name");
  if (fwEl) fwEl.textContent = summary.framework;
  if (!resultsEl) return;
  resultsEl.innerHTML = `
    <div class="test-summary">
      <span class="test-passed">✓ ${summary.passed}</span>
      <span class="test-failed">✗ ${summary.failed}</span>
      <span class="test-skipped">- ${summary.skipped}</span>
      <span class="test-duration">${summary.durationMs}ms</span>
    </div>
    ${summary.results.filter((r) => r.status === "failed").slice(0, 5).map((r) =>
      `<div class="test-result-item failed"><strong>${r.name}</strong>${r.error ? `<pre>${escapeHtmlForTest(r.error)}</pre>` : ""}</div>`
    ).join("")}
    ${summary.results.filter((r) => r.status === "passed").slice(0, 10).map((r) =>
      `<div class="test-result-item passed"><span>✓</span> ${r.name}</div>`
    ).join("")}
    ${summary.rawOutput ? `<details><summary>Raw output</summary><pre>${escapeHtmlForTest(summary.rawOutput.slice(0, 2000))}</pre></details>` : ""}
  `;
}

function escapeHtmlForTest(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function detectTestFramework(ctx: EventHandlerContext): Promise<void> {
  const rootPath = ctx.model.get("activeRepoScan").rootPath;
  if (!rootPath) return;
  const { TestRunnerService } = await import("../test-runner/test-runner.service");
  const runner = new TestRunnerService();
  const fw = await runner.detectFramework(rootPath);
  const el = document.querySelector("#test-framework-name");
  if (el) el.textContent = fw ?? "none";
}

async function refreshTerminalSuggestions(ctx: EventHandlerContext): Promise<void> {
  const rootPath = ctx.model.get("activeRepoScan").rootPath;
  const { TerminalSuggestionsService } = await import("../terminal/terminal-suggestions.service");
  const suggester = new TerminalSuggestionsService(ctx.modelRouter);
  const suggestions = await suggester.getSuggestions("", rootPath);
  const list = document.querySelector("#suggestions-list");
  if (!list) return;
  if (suggestions.length === 0) {
    list.innerHTML = `<span class='suggestion-item disabled'>${t("common.noSuggestions")}</span>`;
    return;
  }
  list.innerHTML = suggestions.map((s) =>
    `<button class="suggestion-item" data-suggest-cmd="${s.command}" type="button" title="${s.description}">
      <span class="suggestion-label">${s.label}</span>
      <code>${s.command}</code>
    </button>`
  ).join("");
}

function executeSuggestedCommand(ctx: EventHandlerContext, cmd: string): void {
  const { Terminal } = require("xterm") as typeof import("xterm");
  const mount = document.querySelector<HTMLElement>("#terminal-user-mount");
  if (mount) {
    const terminal = Terminal as unknown as { prototype: { write: (data: string) => void } };
    const input = mount.querySelector<HTMLInputElement>(".xterm-helper-textarea");
    if (input) {
      input.value = cmd;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }
}

function openAgentConfig(ctx: EventHandlerContext): void {
  ctx.model.set("settingsOpen", true);
  const { renderSettingsOverlay } = require("./ui-renderers");
  const root = document.querySelector("#settings-root");
  if (root) {
    root.innerHTML = renderSettingsOverlay(
      true,
      ctx.model.get("currentSession"),
      ctx.sessionUsageService.getSnapshot(),
      ctx.model.get("updateStatus"),
      ctx.model.get("byokKeys"),
      ctx.model.get("enterpriseManageError"),
      ctx.model.get("enterpriseManageSubmitting") ? "submitting" : "",
    );
  }
  setTimeout(() => {
    const agentTab = document.querySelector<HTMLButtonElement>("button[data-settings-tab='agents']");
    agentTab?.click();
  }, 50);
}

async function saveAgentConfigFromForm(ctx: EventHandlerContext): Promise<void> {
  const id = (document.querySelector<HTMLInputElement>("#agent-form-id")?.value ?? "").trim();
  const name = (document.querySelector<HTMLInputElement>("#agent-form-name")?.value ?? "").trim();
  const role = (document.querySelector<HTMLSelectElement>("#agent-form-role")?.value ?? "builder") as any;
  const model = (document.querySelector<HTMLInputElement>("#agent-form-model")?.value ?? "").trim();
  const prompt = (document.querySelector<HTMLTextAreaElement>("#agent-form-prompt")?.value ?? "").trim();
  if (!id || !name) return;
  ctx.agentOrchestrator.registry.register({
    id, name, role,
    description: "",
    model: model || "gpt-5.4-mini",
    permissions: ["read", "propose"],
    allowedPaths: ["**"],
    forbiddenPaths: [],
    systemPrompt: prompt,
  });
  alert(`Agent "${name}" saved`);
}

async function exportAgentYaml(ctx: EventHandlerContext): Promise<void> {
  const { generateAgentYaml } = await import("../agents/agent-config.service");
  const agents = ctx.agentOrchestrator.registry.list();
  const yaml = generateAgentYaml(agents);
  const blob = new Blob([yaml], { type: "text/yaml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "agents.yaml";
  a.click();
  URL.revokeObjectURL(url);
}

async function importAgentYaml(ctx: EventHandlerContext): Promise<void> {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".yaml,.yml";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    const text = await file.text();
    const count = ctx.agentOrchestrator.registry.loadFromYaml(text);
    alert(`${count} agent(s) loaded from YAML`);
  };
  input.click();
}

export function attachUpgradeInteractions(ctx: EventHandlerContext): void {
  if (attachedInteractions.has("upgrade")) return;
  attachedInteractions.add("upgrade");

  document.querySelector<HTMLElement>("#upgrade-root")?.addEventListener("click", (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (
      target?.id === "upgrade-modal-close" ||
      target?.id === "upgrade-modal-later" ||
      target?.classList.contains("upgrade-overlay")
    ) {
      closeUpgradeModal(ctx);
    } else if (target?.id === "upgrade-account-button") {
      closeUpgradeModal(ctx);
      openSettings(ctx);
    }
  });
}

export function attachKanbanInteractions(ctx: EventHandlerContext): void {
  if (ctx.model.get("kanbanInteractionsAttached")) {
    return;
  }
  ctx.model.set("kanbanInteractionsAttached", true);
  const central = document.querySelector<HTMLElement>("#central-shell");
  central?.addEventListener("click", (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.id === "new-kanban-task-button") {
      const title = window.prompt(t("kanban.taskTitlePrompt"));
      if (!title) {
        return;
      }
      const description = window.prompt(t("kanban.taskDescriptionPrompt")) ?? "";
      void ctx.kanbanService.createTask({ title, description, priority: "medium" }).then(() => refreshKanban(ctx));
      return;
    }

    const actionButton = target?.closest<HTMLButtonElement>("button[data-task-action]");
    const action = actionButton?.dataset.taskAction;
    const taskId = actionButton?.dataset.taskId;
    if (action === "send-ai" && taskId) {
      void sendKanbanTaskToAgents(ctx, taskId);
    } else if (action === "review" && taskId) {
      const task = ctx.model.get("kanbanTasks").find((candidate) => candidate.id === taskId);
      if (task?.proposals?.length) {
        ctx.model.set("safeDiffProposals", [...task.proposals, ...ctx.model.get("safeDiffProposals")]);
        ctx.model.set("kanbanOpen", false);
        refreshCentralShell(ctx);
      }
    }
  });

  central?.addEventListener("dragstart", (event) => {
    const card = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>(".kanban-task") : null;
    if (card?.dataset.taskId) {
      event.dataTransfer?.setData("text/plain", card.dataset.taskId);
    }
  });

  central?.addEventListener("dragover", (event) => {
    if (event.target instanceof HTMLElement && event.target.closest(".kanban-column")) {
      event.preventDefault();
    }
  });

  central?.addEventListener("drop", (event) => {
    const column = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>(".kanban-column") : null;
    const taskId = event.dataTransfer?.getData("text/plain");
    const columnId = column?.dataset.kanbanColumn as KanbanColumn | undefined;
    if (taskId && columnId) {
      event.preventDefault();
      void ctx.kanbanService.moveTask(taskId, columnId).then(() => refreshKanban(ctx));
    }
  });
}

export function attachMarketplaceInteractions(ctx: EventHandlerContext): void {
  if (attachedInteractions.has("marketplace")) return;
  attachedInteractions.add("marketplace");

  document.querySelector<HTMLButtonElement>("#marketplace-nav-button")?.addEventListener("click", () => {
    void openMarketplace(ctx);
  });
  document.querySelector<HTMLButtonElement>("#workspace-open-skillpacks-button")?.addEventListener("click", () => {
    void openMarketplace(ctx);
  });
  document.querySelector<HTMLButtonElement>("#ai-open-skillpacks-button")?.addEventListener("click", () => {
    void openMarketplace(ctx);
  });

  document.querySelector<HTMLElement>("#marketplace-root")?.addEventListener("click", (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.id === "marketplace-overlay" || target?.id === "marketplace-close-button") {
      closeMarketplace(ctx);
      return;
    }

    if (target?.id === "onboarding-retry-catalog-button") {
      ctx.model.set("onboardingError", "");
      refreshMarketplaceOverlay(ctx);
      void loadMarketplaceCatalog(ctx);
      return;
    }

    const tabButton = target?.closest<HTMLButtonElement>("button[data-marketplace-tab]");
    const nextTab = tabButton?.dataset.marketplaceTab;
    if (nextTab === "skills" || nextTab === "tools" || nextTab === "enterprise") {
      ctx.model.set("marketplaceTab", nextTab);
      refreshMarketplaceOverlay(ctx);
      return;
    }

    const profileButton = target?.closest<HTMLButtonElement>("button[data-profile-id]");
    const profileId = profileButton?.dataset.profileId;
    if (profileId) {
      void installMarketplaceProfile(ctx, profileId);
      return;
    }

    const suggestedButton = target?.closest<HTMLButtonElement>("button[data-suggested-action]");
    const suggestedAction = suggestedButton?.dataset.suggestedAction;
    if (suggestedAction === "install" || suggestedAction === "skip") {
      void continueSuggestedSkill(ctx, suggestedAction === "install");
      return;
    }

    const actionButton = target?.closest<HTMLButtonElement>("button[data-marketplace-action]");
    const action = actionButton?.dataset.marketplaceAction;
    const skillpackId = actionButton?.dataset.skillId;
    const toolId = actionButton?.dataset.toolId;
    if (target?.id === "enterprise-manage-button") {
      void openEnterpriseManage(ctx);
      return;
    }
    if (target?.id === "marketplace-update-all-button") {
      void updateAllMarketplaceSkillpacks(ctx);
      return;
    }
    if (!action) {
      return;
    }
    if (action === "install-skill" && skillpackId) {
      void installMarketplaceSkillpack(ctx, skillpackId);
    } else if (action === "update" && skillpackId) {
      void updateMarketplaceSkillpack(ctx, skillpackId);
    } else if (action === "uninstall-skill" && skillpackId) {
      void uninstallMarketplaceSkillpack(ctx, skillpackId);
    } else if (action === "install-tool" && toolId) {
      void installMarketplaceTool(ctx, toolId);
    } else if (action === "uninstall-tool" && toolId) {
      void uninstallMarketplaceTool(ctx, toolId);
    }
  });

  document.querySelector<HTMLElement>("#marketplace-root")?.addEventListener("input", (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.id === "marketplace-search-input") {
      ctx.model.set("marketplaceSearchQuery", (target as HTMLInputElement).value);
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => void refreshMarketplaceOverlay(ctx), 150);
    }
  });

  document.querySelector<HTMLElement>("#marketplace-root")?.addEventListener("change", (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.id === "marketplace-tier-filter") {
      ctx.model.set("marketplaceFilterTier", (target as HTMLSelectElement).value);
      void refreshMarketplaceOverlay(ctx);
    }
    if (target?.id === "marketplace-sort") {
      ctx.model.set("marketplaceSort", (target as HTMLSelectElement).value);
      void refreshMarketplaceOverlay(ctx);
    }
  });
}

export async function openEnterpriseManage(ctx: EventHandlerContext): Promise<void> {
  ctx.model.set("enterpriseManageOpen", true);
  ctx.model.set("enterpriseManageError", "");
  ctx.model.set("enterpriseManageEditingId", null);
  refreshEnterpriseManageOverlay(ctx);
  try {
    const skills = await fetchSkills();
    ctx.model.set("enterpriseManageSkills", skills);
  } catch (error) {
    ctx.model.set("enterpriseManageError", error instanceof Error ? error.message : "Failed to load enterprise skills");
  }
  refreshEnterpriseManageOverlay(ctx);
}

export function closeEnterpriseManage(ctx: EventHandlerContext): void {
  ctx.model.set("enterpriseManageOpen", false);
  ctx.model.set("enterpriseManageSkills", []);
  ctx.model.set("enterpriseManageError", "");
  ctx.model.set("enterpriseManageEditingId", null);
  ctx.model.set("enterpriseManageSubmitting", false);
  refreshEnterpriseManageOverlay(ctx);
  refreshMarketplaceOverlay(ctx);
}

export function refreshEnterpriseManageOverlay(ctx: EventHandlerContext): void {
  const root = document.querySelector<HTMLElement>("#marketplace-root");
  if (root) {
    root.innerHTML = renderEnterpriseManageOverlay(
      ctx.model.get("enterpriseManageOpen"),
      ctx.model.get("enterpriseManageSkills"),
      ctx.model.get("enterpriseManageError"),
      ctx.model.get("enterpriseManageSubmitting"),
      ctx.model.get("enterpriseManageEditingId"),
    );
  }
}

export function attachEnterpriseManageInteractions(ctx: EventHandlerContext): void {
  if (attachedInteractions.has("enterpriseManage")) return;
  attachedInteractions.add("enterpriseManage");

  document.querySelector<HTMLElement>("#marketplace-root")?.addEventListener("click", (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!ctx.model.get("enterpriseManageOpen")) return;

    if (target?.id === "enterprise-manage-overlay" || target?.id === "enterprise-manage-close-button") {
      closeEnterpriseManage(ctx);
      return;
    }

    const actionBtn = target?.closest<HTMLButtonElement>("button[data-enterprise-action]");
    if (!actionBtn) return;
    const action = actionBtn.dataset.enterpriseAction;
    const skillId = actionBtn.dataset.enterpriseId;

    if (action === "edit" && skillId) {
      ctx.model.set("enterpriseManageEditingId", skillId);
      refreshEnterpriseManageOverlay(ctx);
      return;
    }
    if (action === "cancel-edit") {
      ctx.model.set("enterpriseManageEditingId", null);
      refreshEnterpriseManageOverlay(ctx);
      return;
    }
    if (action === "approve" && skillId) {
      ctx.model.set("enterpriseManageSubmitting", true);
      refreshEnterpriseManageOverlay(ctx);
      void approveSkill(skillId).then(() => {
        ctx.model.set("enterpriseManageSkills", getCachedSkills());
        ctx.model.set("enterpriseManageSubmitting", false);
        refreshEnterpriseManageOverlay(ctx);
      });
      return;
    }
    if (action === "delete" && skillId) {
      if (!confirm("Delete this enterprise skill?")) return;
      ctx.model.set("enterpriseManageSubmitting", true);
      refreshEnterpriseManageOverlay(ctx);
      void deleteSkill(skillId).then(() => {
        ctx.model.set("enterpriseManageSkills", getCachedSkills());
        ctx.model.set("enterpriseManageSubmitting", false);
        refreshEnterpriseManageOverlay(ctx);
      });
      return;
    }
    if (action === "save-edit" && skillId) {
      const card = actionBtn.closest<HTMLElement>("[data-enterprise-id]");
      if (!card) return;
      const name = card.querySelector<HTMLInputElement>(".enterprise-name-input")?.value;
      const description = card.querySelector<HTMLTextAreaElement>(".enterprise-desc-input")?.value;
      const version = card.querySelector<HTMLInputElement>(".enterprise-version-input")?.value;
      const content = card.querySelector<HTMLTextAreaElement>(".enterprise-content-input")?.value;
      if (!name || !description || !version || !content) return;
      ctx.model.set("enterpriseManageSubmitting", true);
      refreshEnterpriseManageOverlay(ctx);
      void updateSkill(skillId, { name, description, version, content }).then(() => {
        ctx.model.set("enterpriseManageSkills", getCachedSkills());
        ctx.model.set("enterpriseManageEditingId", null);
        ctx.model.set("enterpriseManageSubmitting", false);
        refreshEnterpriseManageOverlay(ctx);
      });
      return;
    }
  });

  document.querySelector<HTMLElement>("#marketplace-root")?.addEventListener("submit", (event) => {
    const form = event.target instanceof HTMLFormElement ? event.target : null;
    if (form?.id !== "enterprise-create-form") return;
    if (!ctx.model.get("enterpriseManageOpen")) return;
    event.preventDefault();
    if (ctx.model.get("enterpriseManageSubmitting")) return;

    const name = document.querySelector<HTMLInputElement>("#enterprise-create-name")?.value;
    const description = document.querySelector<HTMLTextAreaElement>("#enterprise-create-desc")?.value;
    const category = document.querySelector<HTMLInputElement>("#enterprise-create-category")?.value;
    const version = document.querySelector<HTMLInputElement>("#enterprise-create-version")?.value;
    const tagsRaw = document.querySelector<HTMLInputElement>("#enterprise-create-tags")?.value;
    const content = document.querySelector<HTMLTextAreaElement>("#enterprise-create-content")?.value;
    if (!name || !description || !content) return;

    ctx.model.set("enterpriseManageSubmitting", true);
    refreshEnterpriseManageOverlay(ctx);

    const input: CreateEnterpriseSkillInput = {
      name,
      description,
      category: (category || "fullstack") as import("../marketplace/marketplace.types").SkillCategory,
      version: version || "1.0.0",
      content,
      tags: tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [],
    };

    void createSkill(input).then(() => {
      ctx.model.set("enterpriseManageSkills", getCachedSkills());
      ctx.model.set("enterpriseManageSubmitting", false);
      document.querySelector<HTMLFormElement>("#enterprise-create-form")?.reset();
      refreshEnterpriseManageOverlay(ctx);
    });
  });
}

export function attachSettingsInteractions(ctx: EventHandlerContext): void {
  if (attachedInteractions.has("settings")) return;
  attachedInteractions.add("settings");

  document.querySelectorAll<HTMLButtonElement>(".settings-button").forEach((button) => button.addEventListener("click", () => {
    openSettings(ctx);
  }));
  document.querySelector<HTMLButtonElement>("#titlebar-settings-button")?.addEventListener("click", () => {
    openSettings(ctx);
  });
  document.querySelector<HTMLButtonElement>("#titlebar-settings-button-secondary")?.addEventListener("click", () => {
    openSettings(ctx);
  });
  document.querySelector<HTMLButtonElement>("#right-settings-button")?.addEventListener("click", () => {
    openSettings(ctx);
  });
  document.querySelector<HTMLButtonElement>("#ai-open-settings-button")?.addEventListener("click", () => {
    openSettings(ctx);
  });
  document.querySelector<HTMLButtonElement>("#ai-open-terminal-button")?.addEventListener("click", () => {
    document.querySelector<HTMLButtonElement>("#terminal-toggle-button")?.click();
  });

  document.querySelector<HTMLElement>("#settings-root")?.addEventListener("click", (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.id === "settings-overlay" || target?.id === "settings-close-button") {
      closeSettings(ctx);
    } else if (target?.id === "save-byok-button") {
      void saveByokSettings(ctx);
    } else if (target?.id === "refresh-credits-button") {
      void refreshCreditBalance(ctx);
    } else if (target?.id === "save-spend-cap-button") {
      void saveSpendCap(ctx);
    } else if (target?.id === "buy-credits-button") {
      void openCreditsPortal(ctx);
    } else if (target?.id === "install-update-button") {
      void installDesktopUpdate(ctx);
    } else {
      const languageButton = target?.closest<HTMLButtonElement>("button[data-lang]");
      const language = languageButton?.dataset.lang;
      if (language) {
        void changeLanguage(language).then(() => {
          refreshSettingsOverlay(ctx);
          refreshV3Panels(ctx);
          refreshCentralShell(ctx);
          refreshEntitlementControls(ctx);
        });
        return;
      }

      const mcpButton = target?.closest<HTMLButtonElement>("button[data-mcp-save]");
      const provider = mcpButton?.dataset.mcpSave as MCPProviderId | undefined;
      if (provider) {
        void saveMcpIntegration(ctx, provider);
      }
    }
  });
}

export function attachAuditInteractions(ctx: EventHandlerContext): void {
  if (attachedInteractions.has("audit")) return;
  attachedInteractions.add("audit");

  document.querySelector<HTMLButtonElement>("#audit-nav-button")?.addEventListener("click", () => {
    openAuditDashboard(ctx);
  });
  document.querySelector<HTMLButtonElement>("#right-audit-button")?.addEventListener("click", () => {
    openAuditDashboard(ctx);
  });

  document.querySelector<HTMLElement>("#audit-root")?.addEventListener("click", (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.id === "audit-overlay" || target?.id === "audit-close-button") {
      closeAuditDashboard(ctx);
    }
  });
}

export function attachKanbanNavInteractions(ctx: EventHandlerContext): void {
  if (attachedInteractions.has("kanbanNav")) return;
  attachedInteractions.add("kanbanNav");

  document.querySelector<HTMLButtonElement>("#kanban-nav-button")?.addEventListener("click", () => {
    ctx.model.set("kanbanOpen", !ctx.model.get("kanbanOpen"));
    refreshCentralShell(ctx);
  });
}

export function attachChatInteractions(ctx: EventHandlerContext): void {
  if (attachedInteractions.has("chat")) return;
  attachedInteractions.add("chat");

  document.querySelector<HTMLButtonElement>("#chat-send-button")?.addEventListener("click", () => {
    void runChatOrchestrator(ctx);
  });
  document.querySelector<HTMLInputElement>("#chat-input")?.addEventListener("keydown", (event) => {
    const input = event.currentTarget instanceof HTMLInputElement ? event.currentTarget : null;
    if (event.key === "Tab" && input?.value.trim()) {
      event.preventDefault();
      void enhancePromptInput(ctx);
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void runChatOrchestrator(ctx);
    }
  });
  document.querySelector<HTMLButtonElement>("#sano-privacy-toggle")?.addEventListener("click", () => {
    ctx.model.set("privacyEnabled", !ctx.model.get("privacyEnabled"));
    refreshPrivacyToggle(ctx);
  });
  document.querySelector<HTMLSelectElement>("#model-selector")?.addEventListener("change", (event) => {
    const selector = event.currentTarget instanceof HTMLSelectElement ? event.currentTarget : null;
    document
      .querySelector<HTMLInputElement>("#custom-model-input")
      ?.classList.toggle("visible", selector?.value === "custom");
  });
}

export function refreshPrivacyToggle(ctx: EventHandlerContext): void {
  const toggle = document.querySelector<HTMLButtonElement>("#sano-privacy-toggle");
  if (!toggle) {
    return;
  }
  toggle.classList.toggle("active", ctx.model.get("privacyEnabled"));
  toggle.setAttribute("aria-pressed", String(ctx.model.get("privacyEnabled")));
  toggle.innerHTML = `<i></i> ${ctx.model.get("privacyEnabled") ? t("privacy.active") : t("privacy.off")}`;
}

export function attachSkillpackInteractions(ctx: EventHandlerContext): void {
  if (ctx.model.get("skillpackInteractionsAttached")) {
    return;
  }
  ctx.model.set("skillpackInteractionsAttached", true);

  document.querySelector<HTMLElement>("#profile-list")?.addEventListener("click", (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest<HTMLButtonElement>(".profile-card") : null;
    const skillpackId = target?.dataset.skillpackId;
    if (!skillpackId) {
      return;
    }
    ctx.skillpackManager.activate(skillpackId);
  });

  document.querySelector<HTMLButtonElement>("#reset-skillpack-button")?.addEventListener("click", () => {
    ctx.skillpackManager.resetToPlanDefault();
  });
}

export function attachAuthInteractions(ctx: EventHandlerContext): void {
  if (attachedInteractions.has("auth")) return;
  attachedInteractions.add("auth");

  const root = document.querySelector<HTMLElement>("#auth-root");
  root?.addEventListener("click", (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest<HTMLButtonElement>("button[data-auth-mode]") : null;
    const nextMode = target?.dataset.authMode;
    if (nextMode === "login" || nextMode === "register") {
      ctx.model.set("authMode", nextMode);
      ctx.model.set("authError", "");
      ctx.model.set("authSSOMode", "hidden");
      ctx.model.set("authSSOError", "");
      refreshAuthOverlay(ctx);
    }

    const ssoToggle = event.target instanceof HTMLElement ? event.target.closest("#desktop-auth-sso-toggle") : null;
    if (ssoToggle) {
      ctx.model.set("authSSOMode", "domain");
      ctx.model.set("authSSOError", "");
      refreshAuthOverlay(ctx);
      return;
    }

    const ssoBack = event.target instanceof HTMLElement ? event.target.closest("#desktop-auth-sso-back") : null;
    if (ssoBack) {
      ctx.model.set("authSSOMode", "hidden");
      ctx.model.set("authSSOError", "");
      refreshAuthOverlay(ctx);
      return;
    }

    const ssoCancel = event.target instanceof HTMLElement ? event.target.closest("#desktop-auth-sso-cancel") : null;
    if (ssoCancel) {
      ctx.model.set("authSSOMode", "hidden");
      ctx.model.set("authSSOError", "");
      ctx.model.set("authSSODomain", "");
      refreshAuthOverlay(ctx);
      return;
    }

    const ssoSubmit = event.target instanceof HTMLElement ? event.target.closest("#desktop-auth-sso-submit") : null;
    if (ssoSubmit) {
      const domainInput = document.querySelector<HTMLInputElement>("#desktop-auth-sso-domain-input");
      const domain = domainInput?.value?.trim();
      if (!domain) return;
      ctx.model.set("authSSODomain", domain);
      ctx.model.set("authSSOMode", "waiting");
      ctx.model.set("authSSOError", "");
      refreshAuthOverlay(ctx);
      void handleSSOLogin(ctx, domain);
      return;
    }
  });

  root?.addEventListener("submit", (event) => {
    const form = event.target instanceof HTMLFormElement ? event.target : null;
    if (form?.id !== "desktop-auth-form") {
      return;
    }
    event.preventDefault();
    if (!ctx.model.get("authSubmitting")) {
      void handleNativeAuthSubmit(ctx, form);
    }
  });
}

async function handleSSOLogin(ctx: EventHandlerContext, domain: string): Promise<void> {
  try {
    const { redirectUrl, flowId } = await startSSOFlow(domain);
    try {
      await openUrl(redirectUrl);
    } catch {
      window.open(redirectUrl, "_blank");
    }
    let attempts = 0;
    const maxAttempts = 150;
    const pollInterval = setInterval(async () => {
      attempts++;
      const session = await pollSSO(flowId);
      if (session) {
        clearInterval(pollInterval);
        ctx.model.set("authSSOMode", "hidden");
        ctx.model.set("authSSOError", "");
        ctx.model.set("authSSODomain", "");
        refreshAuthOverlay(ctx);
        renderSession(ctx, session);
      } else if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
        ctx.model.set("authSSOMode", "domain");
        ctx.model.set("authSSOError", t("auth.ssoPollFailed"));
        refreshAuthOverlay(ctx);
      }
    }, 2000);
  } catch (error) {
    ctx.model.set("authSSOMode", "domain");
    ctx.model.set("authSSOError", error instanceof Error ? error.message : t("auth.ssoPollFailed"));
    refreshAuthOverlay(ctx);
  }
}

export async function handleNativeAuthSubmit(ctx: EventHandlerContext, form: HTMLFormElement): Promise<void> {
  const data = new FormData(form);
  const email = String(data.get("email") ?? "").trim();
  const password = String(data.get("password") ?? "");
  ctx.model.set("authError", "");
  ctx.model.set("authSubmitting", true);
  refreshAuthOverlay(ctx);

  try {
    if (ctx.model.get("authMode") === "register") {
      const name = String(data.get("name") ?? "").trim();
      const confirmPassword = String(data.get("confirmPassword") ?? "");
      if (password !== confirmPassword) {
        throw new Error(t("auth.passwordsDoNotMatch"));
      }
      await registerWithControlApi({ name, email, password });
    } else {
      await loginWithControlApi({ email, password });
    }
    ctx.model.set("authError", "");
  } catch (error) {
    ctx.model.set("authError", error instanceof Error ? error.message : t("session.unableToSignIn"));
    showToast({ severity: "error", message: ctx.model.get("authError") });
  } finally {
    ctx.model.set("authSubmitting", false);
    refreshAuthOverlay(ctx);
  }
}

export function refreshAuthOverlay(ctx: EventHandlerContext): void {
  const root = document.querySelector<HTMLElement>("#auth-root");
  if (root) {
    root.innerHTML = renderAuthOverlay(
      ctx.model.get("authMode"),
      ctx.model.get("authError"),
      ctx.model.get("authSubmitting"),
      ctx.model.get("authSSOMode"),
      ctx.model.get("authSSOError"),
    );
  }
}

export function renderSession(ctx: EventHandlerContext, session: OclushionSession | null): void {
  ctx.model.set("currentSession", session);
  ctx.entitlementsService.updateFromSession(session);
  if (session?.token) {
    const role = getRoleFromToken(session.token);
    ctx.permissionManager.setUserRole(role as import("../security/rbac").OrganizationRole | null);
  } else {
    ctx.permissionManager.setUserRole(null);
  }
  const planName = document.querySelector<HTMLElement>("#plan-name");
  const planRenewal = document.querySelector<HTMLElement>("#plan-renewal");
  const miniPlan = document.querySelector<HTMLElement>("#mini-plan");
  const signInButton = document.querySelector<HTMLButtonElement>("#sign-in-button");

  if (!session) {
    if (planName) planName.textContent = t("session.noPlan");
    if (planRenewal) planRenewal.textContent = t("session.syncSkills");
    if (miniPlan) miniPlan.textContent = t("common.offline");
    if (signInButton) signInButton.textContent = t("session.signIn");
    refreshEntitlementControls(ctx);
    refreshAuditOverlay(ctx);
    refreshAuthOverlay(ctx);
    return;
  }

  if (planName) planName.textContent = t("session.planLabel", { plan: session.user.plan });
  if (planRenewal) planRenewal.textContent = formatPlanRenewal(session);
  if (miniPlan) miniPlan.textContent = t("session.planLabel", { plan: session.user.plan });
  if (signInButton) signInButton.textContent = session.user.name || session.user.email;
  ctx.model.set("authError", "");
  ctx.model.set("authSubmitting", false);
  refreshEntitlementControls(ctx);
  refreshAuditOverlay(ctx);
  refreshAuthOverlay(ctx);
  void ctx.auditService.dispatchForPlan(session.user.plan);
}

export function mountEditor(ctx: EventHandlerContext): void {
  const editorMount = document.querySelector<HTMLDivElement>("#editor");
  if (!editorMount) return;

  ctx.editorController.destroy();
  ctx.editorController.mount(editorMount);
}

function formatPlanRenewal(session: OclushionSession): string {
  return `${session.user.plan} plan`;
}

function readLocalSetting(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch (error) {
    logger.debug('EventHandlers', 'Failed to read local setting', error);
    return "";
    return "";
  }
}

async function registerWithControlApi(data: { name: string; email: string; password: string }): Promise<void> {
  const baseUrl = getControlApiUrl();
  if (!baseUrl) {
    throw new Error("Control API is not configured. Set VITE_OCLUSHION_CONTROL_API_URL.");
  }
  const response = await fetch(`${baseUrl}/v1/desktop/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const raw = await response.json();
    const payload = errorMessageSchema.parse(raw);
    throw new Error(payload.message ?? t("auth.registrationFailed", { status: response.status }));
  }
}

async function loginWithControlApi(data: { email: string; password: string }): Promise<void> {
  const baseUrl = getControlApiUrl();
  if (!baseUrl) {
    throw new Error("Control API is not configured. Set VITE_OCLUSHION_CONTROL_API_URL.");
  }
  const response = await fetch(`${baseUrl}/v1/desktop/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const raw = await response.json();
    const payload = errorMessageSchema.parse(raw);
    throw new Error(payload.message ?? t("auth.loginFailed", { status: response.status }));
  }
}

async function startSSOFlow(domain: string): Promise<{ redirectUrl: string; flowId: string }> {
  const baseUrl = getControlApiUrl();
  if (!baseUrl) throw new Error("Control API is not configured.");
  const response = await fetch(`${baseUrl}/v1/auth/sso/authorize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain }),
  });
  if (!response.ok) {
    const raw = await response.json();
    const payload = ssoErrorSchema.parse(raw);
    throw new Error(payload.error ?? `SSO authorize failed with HTTP ${response.status}`);
  }
  const raw = await response.json();
  return ssoAuthorizeSchema.parse(raw);
}

async function pollSSO(flowId: string): Promise<OclushionSession | null> {
  const baseUrl = getControlApiUrl();
  if (!baseUrl) throw new Error("Control API is not configured.");
  const response = await fetch(`${baseUrl}/v1/auth/sso/poll?flowId=${encodeURIComponent(flowId)}`);
  if (!response.ok) return null;
  const raw = await response.json();
  const data = ssoPollSchema.parse(raw);
  if (data.status !== "completed" || !data.token || !data.user) return null;
  return normalizeSession({ token: data.token, user: data.user });
}

function normalizeSession(value: unknown): OclushionSession {
  if (!value || typeof value !== "object") throw new Error("Invalid session payload.");
  const payload = value as Partial<OclushionSession>;
  if (typeof payload.token !== "string" || !payload.user) throw new Error("Invalid session payload.");
  return {
    token: payload.token,
    user: {
      id: String(payload.user.id),
      email: String(payload.user.email),
      name: String(payload.user.name),
      plan: normalizePlan(payload.user.plan),
      organizationId: String(payload.user.organizationId),
      planRenewalDate: String(payload.user.planRenewalDate),
    },
  };
}

function normalizePlan(value: unknown): OclushionPlan {
  if (value === "Free" || value === "Pro" || value === "Team" || value === "Enterprise") return value;
  if (typeof value === "string") {
    const v = value.toLowerCase();
    if (v === "free") return "Free";
    if (v === "pro") return "Pro";
    if (v === "team") return "Team";
    if (v === "enterprise") return "Enterprise";
  }
  return "Free";
}
