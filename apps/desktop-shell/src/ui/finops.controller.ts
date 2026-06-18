import { BaseController, type ControllerContext } from "./controller";
import { FinOpsRenderer, type FinOpsState } from "./renderers/finops.renderer";
import type { FinOpsService } from "../agents/finops.service";
import type { AgentOrchestrator } from "../agents/agent-orchestrator";
import { logger } from "../utils/logger";

export class FinOpsController extends BaseController {
  private renderer = new FinOpsRenderer();
  private container: HTMLElement | null = null;
  private unsubscribe: (() => void) | null = null;

  private state: FinOpsState = {
    alerts: [],
  };

  public constructor(
    context: ControllerContext,
    private readonly finOpsService: FinOpsService,
    private readonly orchestrator: AgentOrchestrator,
  ) {
    super(context);
  }

  public mount(): void {
    const containerId = "finops-root";
    this.container = this.context.root instanceof Document
      ? this.context.root.getElementById(containerId)
      : this.context.root.querySelector(`#${containerId}`);

    if (!this.container) {
      this.container = document.createElement("div");
      this.container.id = containerId;
      document.body.appendChild(this.container);
    }

    this.unsubscribe = this.orchestrator.subscribe((snapshot) => {
      
      const latestCompleted = [...snapshot.tasks].reverse().find(t => t.status === "completed");
      if (latestCompleted) {
        const alert = this.finOpsService.analyzeTask(latestCompleted.input, latestCompleted.targetPaths);
        if (alert && !this.state.alerts.some(a => a.title === alert.title)) {
          this.state.alerts.push(alert);
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

      const actionBtn = target.closest("[data-action]") as HTMLElement;
      if (actionBtn) {
        const action = actionBtn.dataset.action;
        const card = actionBtn.closest(".ocl-finops-card") as HTMLElement;
        const alertId = card?.dataset.id;
        
        if (alertId) {
          if (action === "fix") {
            logger.info("FinOps", `Triggering SafeDiff generation for alert: ${alertId}`);
          }
          
          this.state.alerts = this.state.alerts.filter(a => a.id !== alertId);
          this.render();
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
