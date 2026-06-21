import type { ServiceContext } from "./app-init";
import type { EventHandlerContext } from "./event-handlers";
import { ChatSidebarController } from "../chat/sidebar.controller";
import { TerminalController } from "../terminal/terminal.controller";
import { logger } from "../utils/logger";
import type { TaskCompletionPayload } from "../notifications/task-notifier";

export async function initializeTerminalController(
  ctx: EventHandlerContext,
  services: ServiceContext,
): Promise<void> {
  try {
    await services.terminalService.start();
    const terminalController = new TerminalController(
      { state: services.appState, root: document },
      services.terminalService,
      { cwdProvider: () => ctx.model.get("activeRepoScan").rootPath },
    );
    ctx.model.set("terminalController", terminalController);
    terminalController.mount();
    await terminalController.initialize();
  } catch (terminalError) {
    logger.warn("AppLifecycle", "Terminal initialization skipped (not in Tauri context or backend unavailable):", terminalError);
  }
}

export async function initializeChatSidebarController(
  ctx: EventHandlerContext,
  services: ServiceContext,
): Promise<void> {
  const chatSidebarController = new ChatSidebarController(
    { state: services.appState, root: document },
    services.chatSessionService,
    {
      activateSession: (session, messages) => {
        ctx.model.set("activeChatSession", session);
        ctx.model.set("activeChatMessages", messages);
        services.appState.setState({
          activeChatSessionId: session.id,
          chatSessions: [],
          chatHistory: messages
            .filter((message): message is import("../chat/chat-session.types").ChatMessage & { role: "user" | "assistant" } =>
              message.role === "user" || message.role === "assistant",
            )
            .map((message) => ({
              id: message.id,
              role: message.role,
              content: message.content,
              createdAt: message.createdAt,
            })),
        });
      },
    },
  );
  ctx.model.set("chatSidebarController", chatSidebarController);
  chatSidebarController.mount();
  await chatSidebarController.initialize();
}

export async function initializeAllPhase4Controllers(
  ctx: EventHandlerContext,
  services: ServiceContext,
): Promise<void> {
  await initializeTerminalController(ctx, services);
  await initializeChatSidebarController(ctx, services);
}

export async function mountLazyControllers(ctx: EventHandlerContext): Promise<void> {
  const controllers = [
    import("../ui/command-palette.controller").then(({ CommandPaletteController }) => {
      const palette = new CommandPaletteController(ctx.voiceCapture, ctx.intentRouter, ctx.fileSearchService);
      palette.mount(document.body);
    }),
    import("../ui/os-tabs.controller").then(({ OsTabsController }) => {
      const osTabs = new OsTabsController({ root: document } as never, ctx.editorController, ctx.canvasService);
      osTabs.mount();
    }),
    import("../ui/agi-switch.controller").then(({ AgiSwitchController }) => {
      const agiSwitch = new AgiSwitchController({ root: document } as never, ctx.agentOrchestrator);
      agiSwitch.mount();
    }),
    import("../ui/menubar.controller").then(({ MenubarController }) => {
      const menubar = new MenubarController({ root: document } as never);
      menubar.mount();
    }),
    import("../ui/status-bar.controller").then(({ StatusBarController }) => {
      const statusBar = new StatusBarController({ root: document } as never);
      statusBar.mount();
    }),
    import("../ui/activity-bar.controller").then(({ ActivityBarController }) => {
      const activityBar = new ActivityBarController({ root: document } as never);
      activityBar.mount();
    }),
    import("../ui/context-menu.controller").then(({ ContextMenuController }) => {
      const contextMenu = new ContextMenuController({ root: document } as never);
      contextMenu.mount();
    }),
    import("../ui/time-travel.controller").then(({ TimeTravelController }) => {
      const timeTravel = new TimeTravelController({ root: document } as never, ctx.agentOrchestrator);
      timeTravel.mount();
    }),
    import("../memory/hive-memory.service").then(({ HiveMemoryService }) => {
      const hiveMemory = new HiveMemoryService();
      return import("../ui/hive-suggestions.controller").then(({ HiveSuggestionsController }) => {
        const hiveSuggestions = new HiveSuggestionsController({ root: document } as never, hiveMemory, ctx.agentOrchestrator);
        hiveSuggestions.mount();
      });
    }),
    import("../agents/finops.service").then(({ FinOpsService }) => {
      const finOpsService = new FinOpsService();
      return import("../ui/finops.controller").then(({ FinOpsController }) => {
        const finOpsController = new FinOpsController({ root: document } as never, finOpsService, ctx.agentOrchestrator);
        finOpsController.mount();
      });
    }),
    import("../ui/agent-swarm.controller").then(({ AgentSwarmController }) => {
      const swarm = new AgentSwarmController(ctx.agentOrchestrator);
      swarm.mount("agent-swarm-root");
    }),
    import("../ui/repo-intelligence.controller").then(({ RepoIntelligenceController }) => {
      const repoIntel = new RepoIntelligenceController();
      repoIntel.mount("repo-intelligence-root");
    }),
    import("../ui/renderers/canvas-spatial.renderer").then(({ SpatialCanvasRenderer }) => {
      const spatialRenderer = new SpatialCanvasRenderer(
        ctx.canvasService,
        ctx.spatialLayoutService,
      );
      const container = document.getElementById("spatial-canvas-root");
      if (container) {
        spatialRenderer.render(container);
      }
    }),
    import("../agents/assistant-hub.controller").then(({ AssistantHubController }) => {
      const hub = new AssistantHubController(
        { root: document } as never,
        ctx.secureKeysService,
        ctx.modelRouter,
      );
      hub.mountTo("assistant-hub-root");
    }),
  ];

  await Promise.allSettled(controllers);
}

export function setupTaskCompletedListener(): () => void {
  const handler = (event: Event) => {
    const payload = (event as CustomEvent<TaskCompletionPayload>).detail;
    if (!payload) return;

    import("../ui/toast").then(({ showToast }) => {
      import("../notifications/notification-sound").then(({ playSuccessSound, playErrorSound }) => {
        import("../i18n/translate").then(({ t }) => {
          if (document.visibilityState === "visible") {
            showToast({
              severity: payload.status === "error" ? "error" : payload.status === "partial" ? "warning" : "success",
              message: t("toasts.agentTaskCompleted", { duration: Math.round(payload.durationSeconds), title: payload.taskTitle }),
              durationMs: 5_000,
            });
          }
          if (payload.status === "error") {
            playErrorSound();
          } else {
            playSuccessSound();
          }
        });
      });
    });
  };

  window.addEventListener("agent:task:completed", handler);
  return () => window.removeEventListener("agent:task:completed", handler);
}