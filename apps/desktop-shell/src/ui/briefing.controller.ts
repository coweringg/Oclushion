import { BaseController, type ControllerContext } from "./controller";
import { BriefingRenderer, type BriefingViewState } from "./renderers/briefing.renderer";
import type { PhantomSchedulerService } from "../phantom/phantom-scheduler.service";
import { logger } from "../utils/logger";

export class BriefingController extends BaseController {
  private renderer = new BriefingRenderer();
  private container: HTMLElement | null = null;
  private unsubscribe: (() => void) | null = null;

  private state: BriefingViewState = {
    isVisible: false,
    session: null,
    expandedTaskId: null,
  };

  public constructor(
    context: ControllerContext,
    private readonly scheduler: PhantomSchedulerService,
  ) {
    super(context);
  }

  public mount(): void {
    this.container = this.context.root instanceof Document
      ? this.context.root.getElementById("ocl-phantom-briefing-mount")
      : this.context.root.querySelector("#ocl-phantom-briefing-mount");

    if (!this.container) {
      return;
    }

    this.unsubscribe = this.scheduler.subscribe((session) => {
      if (session && session.status === "completed" && !this.state.isVisible) {
        this.state.session = session;
        this.state.isVisible = true;
        this.render();
      }
    });

    this.render();
    this.attachEvents();
  }

  public override destroy(): void {
    super.destroy();
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  public showMockBriefing(): void {
    const yesterday = new Date(Date.now() - 8 * 3600000).toISOString();
    
    this.state.session = {
      id: "mock-session",
      startedAt: yesterday,
      finishedAt: new Date().toISOString(),
      userAbsentSince: yesterday,
      status: "completed",
      totalBuilds: 2,
      totalAttacks: 24,
      overallSurvivalRate: 95,
      tasks: [
        {
          id: "task-1",
          source: "todo-comment",
          title: "Implementar rate limiting en AuthController",
          description: "TODO: Añadir rate limiting para prevenir fuerza bruta.",
          targetFiles: ["auth.controller.ts"],
          status: "survived",
          createdAt: yesterday,
          breakerReport: {
            id: "rep-1",
            sessionId: "mock-session",
            totalAttacks: 12,
            survived: 12,
            failed: 0,
            survivalRate: 100,
            generatedAt: new Date().toISOString(),
            attacks: [
              {
                id: "atk-1",
                vector: "dos-loop",
                description: "Triggered 500 parallel login requests",
                targetFile: "auth.controller.ts",
                targetFunction: "login",
                survived: true,
                evidence: "Rate limiter blocked requests after 5 attempts.",
                severity: "high",
                executedAt: new Date().toISOString(),
              },
              {
                id: "atk-2",
                vector: "null-injection",
                description: "Replaced body payload with null",
                targetFile: "auth.controller.ts",
                targetFunction: "login",
                survived: true,
                evidence: "Validation schema caught null payload.",
                severity: "high",
                executedAt: new Date().toISOString(),
              }
            ]
          }
        },
        {
          id: "task-2",
          source: "sentry-issue",
          title: "Fix TypeError en UserManager (SENTRY-492)",
          description: "Cannot read property 'role' of undefined",
          targetFiles: ["user-manager.ts"],
          status: "needs-review",
          createdAt: yesterday,
          breakerReport: {
            id: "rep-2",
            sessionId: "mock-session",
            totalAttacks: 12,
            survived: 11,
            failed: 1,
            survivalRate: 91,
            generatedAt: new Date().toISOString(),
            attacks: [
              {
                id: "atk-3",
                vector: "type-coercion",
                description: "Sent role ID as array instead of string",
                targetFile: "user-manager.ts",
                targetFunction: "updateRole",
                survived: false,
                evidence: "VULNERABLE: Loose equality allowed array to bypass check.",
                severity: "medium",
                executedAt: new Date().toISOString(),
              }
            ]
          }
        }
      ]
    };
    
    this.state.isVisible = true;
    this.render();
  }

  private attachEvents(): void {
    if (!this.container) return;

    this.container.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;

      const header = target.closest(".ocl-task-header") as HTMLElement;
      if (header) {
        const taskId = header.dataset.toggleTask;
        if (taskId) {
          this.state.expandedTaskId = this.state.expandedTaskId === taskId ? null : taskId;
          this.render();
        }
        return;
      }

      if (target.id === "btn-briefing-dismiss") {
        this.state.isVisible = false;
        this.render();
        return;
      }

      if (target.id === "btn-briefing-accept") {
        logger.info("Briefing", "User accepted safe changes");
        this.state.isVisible = false;
        this.render();
        return;
      }
    });
  }

  private render(): void {
    if (this.container) {
      this.renderer.render(this.container, this.state);
    }
  }
}
