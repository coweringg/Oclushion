import { BaseController, type ControllerContext } from "./controller";
import { HiveSuggestionsRenderer, type HiveSuggestionsState } from "./renderers/hive-suggestions.renderer";
import type { HiveMemoryService } from "../memory/hive-memory.service";
import type { AgentOrchestrator } from "../agents/agent-orchestrator";
import { logger } from "../utils/logger";

export class HiveSuggestionsController extends BaseController {
  private renderer = new HiveSuggestionsRenderer();
  private container: HTMLElement | null = null;
  private unsubscribe: (() => void) | null = null;
  private currentProject = "current-project";

  private state: HiveSuggestionsState = {
    insights: [],
  };

  public constructor(
    context: ControllerContext,
    private readonly hiveMemory: HiveMemoryService,
    private readonly orchestrator: AgentOrchestrator,
  ) {
    super(context);
  }

  public mount(): void {
    const containerId = "hive-suggestions-root";
    this.container = this.context.root instanceof Document
      ? this.context.root.getElementById(containerId)
      : this.context.root.querySelector(`#${containerId}`);

    if (!this.container) {
      this.container = document.createElement("div");
      this.container.id = containerId;
      document.body.appendChild(this.container);
    }

    this.unsubscribe = this.orchestrator.subscribe((snapshot) => {
      const activeTask = snapshot.tasks.find(t => t.status === "pending" || t.status === "running");
      if (activeTask) {
        const query = `${activeTask.input} ${activeTask.targetPaths.join(" ")}`;
        const matches = this.hiveMemory.search(query, this.currentProject);
        
        const newInsights = matches.filter(m => !this.state.insights.some(i => i.id === m.id));
        if (newInsights.length > 0) {
          this.state.insights = [...this.state.insights, ...newInsights];
          this.render();
        }
      }
    });

    this.attachEvents();
  }

  public override destroy(): void {
    super.destroy();
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  private attachEvents(): void {
    if (!this.container) return;

    this.container.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;

      const dismissBtn = target.closest("[data-action='dismiss']") as HTMLElement;
      if (dismissBtn) {
        const card = dismissBtn.closest(".ocl-hive-card") as HTMLElement;
        const insightId = card?.dataset.id;
        if (insightId) {
          this.state.insights = this.state.insights.filter(i => i.id !== insightId);
          this.render();
        }
        return;
      }

      const applyBtn = target.closest("[data-action='apply']") as HTMLElement;
      if (applyBtn) {
        const card = applyBtn.closest(".ocl-hive-card") as HTMLElement;
        const insightId = card?.dataset.id;
        if (insightId) {
          const insight = this.state.insights.find(i => i.id === insightId);
          if (insight) {
            logger.info("HiveSuggestions", `Injecting insight ${insight.id} to orchestrator context`);
            this.state.insights = this.state.insights.filter(i => i.id !== insightId);
            this.render();
          }
        }
      }
    });
  }

  private render(): void {
    if (this.container) {
      this.renderer.render(this.container, this.state);
    }
  }
}
