import { createPersistentStore } from "../persistent-store";
import { SkillpackManager } from "../skillpacks/skillpack.manager";
import { AppStateManager, createInitialAppState as createLegacyAppState } from "../state/app-state";
import { ChatSessionService } from "../chat/chat-session.service";
import { MarketplaceService } from "../marketplace/marketplace.service";
import { MarketplaceSearchService } from "../marketplace/marketplace-search.service";
import { ContextService } from "../context.service";
import { PromptBuilder } from "../prompt-builder";
import { ModelRouter } from "../llm/model-router";
import { SanoShield } from "../sano-shield.service";
import { AgentRegistry } from "../agents/agent-registry";
import { FileOwnershipService } from "../agents/file-ownership.service";
import { PermissionManager } from "../security/permission.manager";
import { TerminalService } from "../terminal/terminal.service";
import { WorklogService } from "../agents/worklog.service";
import { AgentRunner } from "../agents/agent-runner";
import { AgentOrchestrator } from "../agents/agent-orchestrator";
import { KanbanService } from "../kanban/kanban.service";
import { TaskHandoffService } from "../kanban/task-handoff.service";
import { MCPRegistry } from "../mcp/mcp-registry";
import { MCPClient } from "../mcp/mcp-client";
import { MCPContextInjector } from "../mcp/mcp-context-injector";
import { ProjectMemoryService } from "../memory/project-memory.service";
import { EntitlementsService } from "../billing/entitlements.service";
import { SessionUsageService } from "../billing/session-usage.service";
import { AuditService, createControlApiAuditDispatcher } from "../audit.service";
import { FastApplyService } from "../fast-apply/fast-apply.service";
import { PromptEnhancerService } from "../prompt-enhancer/prompt-enhancer.service";
import { WhisperClient } from "../voice/whisper-client";
import { VoiceCaptureService } from "../voice/voice-capture.service";
import { PreviewService } from "../preview/preview.service";
import { PreviewWindow } from "../preview/preview-window";
import { SecureExecutor } from "../security/secure-executor";
import { ShipperService } from "../shipper/shipper.service";
import { MultiplayerService } from "../multiplayer/multiplayer.service";
import { ErrorHandlerService } from "../error-handler/error-handler.service";
import { secureKeysService } from "../llm/secure-keys.service";
import { initializeEnterpriseRegistry } from "../enterprise/unified-registry.service";
import { getOrganization } from "../enterprise/organization.service";
import { AppModel, createInitialAppState } from "./state-manager";
import { initI18n } from "../i18n/i18n";
import { logger } from "../utils/logger";
import { CanvasService } from "../canvas/canvas.service";
import { SpatialLayoutService } from "../canvas/spatial-layout.service";
import { IntentRouter } from "../agents/intent-router";

export interface ServiceContext {
  persistentStore: Awaited<ReturnType<typeof createPersistentStore>>;
  skillpackManager: SkillpackManager;
  appState: AppStateManager;
  chatSessionService: ChatSessionService;
  marketplaceService: MarketplaceService;
  marketplaceSearchService: MarketplaceSearchService;
  contextService: ContextService;
  promptBuilder: PromptBuilder;
  modelRouter: ModelRouter;
  sanoShield: SanoShield;
  agentRegistry: AgentRegistry;
  fileOwnership: FileOwnershipService;
  permissionManager: PermissionManager;
  terminalService: TerminalService;
  worklogService: WorklogService;
  agentRunner: AgentRunner;
  agentOrchestrator: AgentOrchestrator;
  kanbanService: KanbanService;
  taskHandoff: TaskHandoffService;
  mcpRegistry: MCPRegistry;
  mcpInjector: MCPContextInjector;
  projectMemory: ProjectMemoryService;
  entitlementsService: EntitlementsService;
  sessionUsageService: SessionUsageService;
  auditService: AuditService;
  fastApplyService: FastApplyService;
  promptEnhancer: PromptEnhancerService;
  whisperClient: WhisperClient;
  voiceCapture: VoiceCaptureService;
  previewService: PreviewService;
  previewWindow: PreviewWindow;
  secureExecutor: SecureExecutor;
  shipperService: ShipperService;
  multiplayerService: MultiplayerService;
  secureKeysService: typeof secureKeysService;
  errorHandler: ErrorHandlerService;
  model: AppModel;
  canvasService: CanvasService;
  spatialLayoutService: SpatialLayoutService;
  intentRouter: IntentRouter;
}

export async function initializeServices(): Promise<ServiceContext> {
  await initI18n();

  const persistentStore = await createPersistentStore();
  const byokKeys = await secureKeysService.loadAll();
  const skillpackManager = await SkillpackManager.create({ storage: persistentStore });
  const appState = new AppStateManager(createLegacyAppState());
  const chatSessionService = await ChatSessionService.create(persistentStore);
  const marketplaceService = new MarketplaceService(persistentStore);
  const marketplaceSearchService = new MarketplaceSearchService();
  const org = getOrganization();
  if (org) {
    await initializeEnterpriseRegistry();
  }
  const contextService = new ContextService(marketplaceService.skillsInstaller);
  const promptBuilder = new PromptBuilder();
  const modelRouter = new ModelRouter();
  const sanoShield = new SanoShield();
  const agentRegistry = new AgentRegistry();
  const fileOwnership = new FileOwnershipService();
  const permissionManager = new PermissionManager();
  const terminalService = new TerminalService(sanoShield, permissionManager);
  const agentExecutor = new SecureExecutor(permissionManager, sanoShield);
  const worklogService = new WorklogService();
  const agentRunner = new AgentRunner(modelRouter, sanoShield, agentExecutor, terminalService, worklogService);
  const agentOrchestrator = new AgentOrchestrator(agentRegistry, agentRunner, fileOwnership);
  const kanbanService = await KanbanService.create(persistentStore);
  const taskHandoff = new TaskHandoffService(kanbanService, agentOrchestrator);
  const mcpRegistry = await MCPRegistry.create(persistentStore);
  const mcpInjector = new MCPContextInjector(new MCPClient(mcpRegistry), sanoShield);
  const projectMemory = await ProjectMemoryService.create(persistentStore);
  const entitlementsService = new EntitlementsService();
  const sessionUsageService = new SessionUsageService();

  const model = new AppModel(createInitialAppState());
  model.set("byokKeys", byokKeys);

  const auditService = await AuditService.create(
    persistentStore,
    createControlApiAuditDispatcher(() => model.get("currentSession")),
  );

  auditService.startAutoSync();

  const fastApplyService = new FastApplyService(undefined, (event) => {
    auditService.record({
      type: event.type,
      actor: event.type === "FAST_APPLY_WRITTEN" ? "agent" : "developer",
      summary: `${event.type} ${event.path}`,
      metadata: {
        path: event.path,
        taskId: event.taskId,
        agentRole: event.agentRole,
        linesAdded: event.linesAdded ?? null,
        linesRemoved: event.linesRemoved ?? null,
        restoredFromSnapshot: event.restoredFromSnapshot ?? false,
      },
      workspaceId: model.get("activeRepoScan")?.rootPath ?? "unknown",
      plan: model.get("currentSession")?.user.plan ?? "Free",
    });
  }, () => model.get("activeRepoScan").rootPath);

  const promptEnhancer = new PromptEnhancerService(modelRouter, sanoShield);
  const whisperClient = new WhisperClient(() => model.get("byokKeys").openai);
  const voiceCapture = new VoiceCaptureService(whisperClient, sanoShield);
  const previewService = new PreviewService();
  const previewWindow = new PreviewWindow();
  const secureExecutor = new SecureExecutor(permissionManager, sanoShield, (event) => {
    auditService.record({
      type: event.type,
      actor: "agent",
      summary: event.summary,
      metadata: event.metadata,
      workspaceId: model.get("activeRepoScan")?.rootPath ?? "unknown",
      plan: model.get("currentSession")?.user.plan ?? "Free",
    });
  });
  const shipperService = new ShipperService(secureExecutor, {}, (event) => {
    auditService.record({
      type: event.type,
      actor: "agent",
      summary: event.summary,
      metadata: event.metadata,
      workspaceId: model.get("activeRepoScan")?.rootPath ?? "unknown",
      plan: model.get("currentSession")?.user.plan ?? "Free",
    });
  });
  const multiplayerService = new MultiplayerService({
    id: `local-${crypto.getRandomValues(new Uint32Array(1))[0]}`,
    name: "Local Developer",
    color: "#7c3aed",
    type: "human",
    role: "full-write",
  });

  const errorHandler = new ErrorHandlerService();
  errorHandler.subscribe((event) => {
    if (import.meta.env.PROD) {
      logger.warn("ErrorHandler", event.type, event.error.message);
    }
  });

  const canvasService = new CanvasService(persistentStore);
  const spatialLayoutService = new SpatialLayoutService(persistentStore);
  const intentRouter = new IntentRouter(agentOrchestrator, kanbanService, modelRouter);

  return {
    persistentStore,
    skillpackManager,
    appState,
    chatSessionService,
    marketplaceService,
    marketplaceSearchService,
    contextService,
    promptBuilder,
    modelRouter,
    sanoShield,
    agentRegistry,
    fileOwnership,
    permissionManager,
    terminalService,
    worklogService,
    agentRunner,
    agentOrchestrator,
    kanbanService,
    taskHandoff,
    mcpRegistry,
    mcpInjector,
    projectMemory,
    entitlementsService,
    sessionUsageService,
    auditService,
    fastApplyService,
    promptEnhancer,
    whisperClient,
    voiceCapture,
    previewService,
    previewWindow,
    secureExecutor,
    shipperService,
    multiplayerService,
    secureKeysService,
    errorHandler,
    model,
    canvasService,
    spatialLayoutService,
    intentRouter,
  };
}
