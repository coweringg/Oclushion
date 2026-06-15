import type { ServiceContext } from "./app-init";
import type { EventHandlerContext } from "./event-handlers";
import { logger } from "../utils/logger";
import type { AgentTask } from "../agents/types";
import { ChatSidebarController } from "../chat/sidebar.controller";
import { TerminalController } from "../terminal/terminal.controller";
import { getStoredSession, subscribeToSession } from "../auth.service";
import { createMockRepoScanResult } from "../repo-scanner";
import { createMockSourceFiles, packRepositoryContext } from "../context.service";
import { EditorController } from "../editor/editor.controller";
import { KeyboardShortcutsService } from "../keyboard-shortcuts/keyboard-shortcuts.service";
import { GitStatusService } from "../editor/git-status.service";
import { SearchService } from "../editor/search.service";
import { ErrorHandlerService } from "../error-handler/error-handler.service";
import { OnboardingService } from "../onboarding/onboarding.service";
import { TourService } from "../tour/tour.service";
import { mainAppTour } from "../tour/tour.default";
import { ContextualTooltipService } from "../tooltip/tooltip.service";
import {
  attachOnboardingProgressInteractions,
  autoDetectOnboardingStep,
  refreshOnboardingProgress,
} from "../onboarding/onboarding-progress";
import { FileSearchService } from "../editor/file-search.service";
import { InstallationProgressService } from "../marketplace/installation-progress.service";
import {
  attachChatInteractions,
  attachSafeDiffInteractions,
  attachAgentInteractions,
  attachV3Interactions,
  attachPhase3Interactions,
  attachUpgradeInteractions,
  attachKanbanNavInteractions,
  attachMarketplaceInteractions,
  attachEnterpriseManageInteractions,
  attachAuditInteractions,
  attachSettingsInteractions,
  attachAuthInteractions,
  attachRepoInteractions,
  refreshRepoCard,
  refreshContextEngine,
  refreshSkillpacks,
  refreshMarketplaceOverlay,
  refreshAuditOverlay,
  refreshSettingsOverlay,
  refreshEntitlementControls,
  refreshCentralShell,
  checkDesktopUpdates,
  renderSession,
  initializeKeyboardShortcuts,
} from "./event-handlers";
import { t } from "../i18n/translate";
import { translateUI } from "../i18n/translate";
import { playSuccessSound, playErrorSound } from "../notifications/notification-sound";
import type { TaskCompletionPayload } from "../notifications/task-notifier";
import { enableShortcutTooltips } from "../ui/shortcut-tooltip";
import { showOnboardingDashboard } from "../onboarding/onboarding-dashboard";
import { renderMainLayout } from "./initialize-renderers";
import {
  initializeAllPhase4Controllers,
  mountLazyControllers,
  setupTaskCompletedListener,
} from "./initialize-controllers";

export async function initializeAppLifecycle(services: ServiceContext): Promise<void> {
  const { model, skillpackManager, auditService, agentOrchestrator, kanbanService, worklogService, chatSessionService, sessionUsageService } = services;

  lifecycleUnsubscribers = [];

  model.set("activeRepoScan", createMockRepoScanResult());
  model.set("activePackedContext", packRepositoryContext(createMockSourceFiles(), 128_000));
  model.set("auditSnapshot", auditService.snapshot());
  model.set("agentSnapshot", agentOrchestrator.snapshot());
  model.set("kanbanTasks", kanbanService.list());
  model.set("currentSession", getStoredSession());

  const ctx: EventHandlerContext = {
    model,
    skillpackManager,
    auditService,
    agentOrchestrator,
    kanbanService,
    taskHandoff: services.taskHandoff,
    marketplaceService: services.marketplaceService,
    marketplaceSearchService: services.marketplaceSearchService,
    chatSessionService,
    secureKeysService: services.secureKeysService,
    entitlementsService: services.entitlementsService,
    sessionUsageService: services.sessionUsageService,
    mcpRegistry: services.mcpRegistry,
    fastApplyService: services.fastApplyService,
    promptEnhancer: services.promptEnhancer,
    voiceCapture: services.voiceCapture,
    permissionManager: services.permissionManager,
    shipperService: services.shipperService,
    multiplayerService: services.multiplayerService,
    previewService: services.previewService,
    previewWindow: services.previewWindow,
    modelRouter: services.modelRouter,
    sanoShield: services.sanoShield,
    promptBuilder: services.promptBuilder,
    projectMemory: services.projectMemory,
    mcpInjector: services.mcpInjector,
    worklogService,
    contextService: services.contextService,
    terminalService: services.terminalService,
    editorController: new EditorController({
      readTextFile: async (path: string) => {
        const { readTextFile } = await import("@tauri-apps/plugin-fs");
        return readTextFile(path);
      },
      writeTextFile: async (path: string, content: string) => {
        const { writeTextFile } = await import("@tauri-apps/plugin-fs");
        return writeTextFile(path, content);
      },
      stat: async (path: string) => {
        const { stat } = await import("@tauri-apps/plugin-fs");
        return stat(path);
      },
      rootPath: model.get("activeRepoScan")?.rootPath ?? "",
    }),
    keyboardShortcuts: new KeyboardShortcutsService(),
    gitStatusService: new GitStatusService(),
    searchService: new SearchService(),
    errorHandler: new ErrorHandlerService(),
    onboardingService: new OnboardingService(),
    tourService: new TourService(mainAppTour),
    fileSearchService: new FileSearchService(),
    installationProgressService: new InstallationProgressService(),
    canvasService: services.canvasService,
    intentRouter: services.intentRouter,
  };

  renderMainLayout(ctx);
  const tooltipService = new ContextualTooltipService();
  tooltipService.init();

  await mountLazyControllers(ctx);

  renderSession(ctx, model.get("currentSession"));
  lifecycleUnsubscribers.push(subscribeToSession((session) => renderSession(ctx, session)));
  lifecycleUnsubscribers.push(subscribeToSession((session) => {
    if (!session) {
      void auditService.flushOnLogout();
    }
  }));
  initializeKeyboardShortcuts(ctx);
  lifecycleUnsubscribers.push(enableShortcutTooltips());

  lifecycleUnsubscribers.push(skillpackManager.subscribe(() => refreshSkillpacks(ctx)));
  lifecycleUnsubscribers.push(auditService.subscribe((snapshot) => {
    model.set("auditSnapshot", snapshot);
    refreshAuditOverlay(ctx);
  }));
  lifecycleUnsubscribers.push(agentOrchestrator.subscribe((snapshot) => {
    model.set("agentSnapshot", snapshot);
  }));
  lifecycleUnsubscribers.push(kanbanService.subscribe((tasks) => {
    model.set("kanbanTasks", tasks);
    if (model.get("kanbanOpen")) {
      refreshCentralShell(ctx);
    }
  }));

  attachChatInteractions(ctx);
  attachSafeDiffInteractions(ctx);
  attachAgentInteractions(ctx);
  attachV3Interactions(ctx);
  attachPhase3Interactions(ctx);
  attachUpgradeInteractions(ctx);
  attachKanbanNavInteractions(ctx);
  attachMarketplaceInteractions(ctx);
  attachEnterpriseManageInteractions(ctx);
  attachAuditInteractions(ctx);
  attachSettingsInteractions(ctx);
  attachAuthInteractions(ctx);
  attachRepoInteractions(ctx);

  void checkDesktopUpdates(ctx);
  refreshRepoCard(ctx);
  void refreshContextEngine(ctx);
  refreshSkillpacks(ctx);
  void refreshMarketplaceOverlay(ctx);
  refreshAuditOverlay(ctx);
  refreshSettingsOverlay(ctx);
  refreshEntitlementControls(ctx);
  translateUI();

  const detachAutoDetect = autoDetectOnboardingStep(ctx.onboardingService);
  lifecycleUnsubscribers.push(detachAutoDetect);

  ctx.onboardingService.subscribe((event) => {
    if (event.type === "onboarding:step_completed" || event.type === "onboarding:completed" || event.type === "onboarding:skipped") {
      refreshOnboardingProgress(ctx.onboardingService);
    }
    if (event.type === "onboarding:completed") {
      showOnboardingDashboard(ctx.onboardingService);
    }
  });

  attachOnboardingProgressInteractions(ctx.onboardingService, (action) => {
    if (action === "resume") {
      ctx.tourService.reset();
      showWelcomeOnboarding(ctx);
    }
  });

  if (ctx.onboardingService.shouldShow()) {
    showWelcomeOnboarding(ctx);
  }

  await initializeAllPhase4Controllers(ctx, services);
  lifecycleUnsubscribers.push(setupTaskCompletedListener());
}

function showWelcomeOnboarding(ctx: EventHandlerContext): void {
  if (ctx.tourService.hasCompleted() || ctx.tourService.isActive()) return;

  ctx.tourService.onChange((event) => {
    if (event.type === "tour:completed") {
      ctx.onboardingService.complete();
    }
    if (event.type === "tour:skipped") {
      ctx.onboardingService.skip();
    }
  });

  ctx.tourService.start();
}

let lifecycleUnsubscribers: Array<() => void> = [];

export function destroyAppLifecycle(): void {
  lifecycleUnsubscribers.forEach((fn) => fn());
  lifecycleUnsubscribers = [];
}