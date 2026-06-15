import { BaseController, type ControllerContext } from "./controller";
import { TimeTravelRenderer, type TimeTravelState } from "./renderers/time-travel.renderer";
import type { AgentOrchestrator } from "../agents/agent-orchestrator";
import { logger } from "../utils/logger";

export class TimeTravelController extends BaseController {
  private renderer = new TimeTravelRenderer();
  private container: HTMLElement | null = null;
  private unsubscribe: (() => void) | null = null;

  private state: TimeTravelState = {
    tasks: [],
    selectedTaskId: null,
  };

  public constructor(
    context: ControllerContext,
    private readonly orchestrator: AgentOrchestrator,
  ) {
    super(context);
  }

  public mount(): void {
    this.container = this.context.root instanceof Document
      ? this.context.root.getElementById("time-travel-root")
      : this.context.root.querySelector(`#time-travel-root`);

    if (!this.container) {
      return;
    }

    this.unsubscribe = this.orchestrator.subscribe((snapshot) => {
      this.state.tasks = snapshot.tasks;
      if (!this.state.tasks.find(t => t.id === this.state.selectedTaskId)) {
        this.state.selectedTaskId = null; // Clear if plan changed
      }
      this.render();
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

      const node = target.closest(".ocl-tt-node") as HTMLElement;
      if (node) {
        const taskId = node.dataset.task;
        if (taskId) {
          this.state.selectedTaskId = this.state.selectedTaskId === taskId ? null : taskId;
          this.render();
        }
        return;
      }

      const forkBtn = target.closest(".ocl-tt-fork-btn") as HTMLElement;
      if (forkBtn && forkBtn.dataset.action === "rewind") {
        const taskId = forkBtn.dataset.task;
        const inputArea = this.container?.querySelector(".ocl-tt-fork-input") as HTMLTextAreaElement;
        const instruction = inputArea?.value.trim();
        
        if (taskId) {
          logger.info("TimeTravel", `Rewinding to task ${taskId} with instruction: ${instruction}`);
          this.orchestrator.rewindTo(taskId, instruction);
          this.state.selectedTaskId = null;
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
