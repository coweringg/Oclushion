import { AgentSwarmRenderer } from "./renderers/agent-swarm.renderer";
import type { AgentOrchestrator } from "../agents/agent-orchestrator";

export class AgentSwarmController {
  private readonly renderer = new AgentSwarmRenderer();
  private container: HTMLElement | null = null;
  private unsubscribe: (() => void) | null = null;

  public constructor(private readonly orchestrator: AgentOrchestrator) {}

  public mount(rootId: string): void {
    this.container = document.getElementById(rootId);
    if (!this.container) return;

    this.container.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (target.id === "ocl-btn-kill-switch") {
        const activePlan = this.orchestrator.snapshot().activePlan;
        if (activePlan) {
          this.orchestrator.cancel(activePlan.id);
        }
        this.render();
      }
    });

    this.render();

    this.unsubscribe = this.orchestrator.subscribe(() => {
      this.render();
    });
  }

  public unmount(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this.container) {
      this.container.innerHTML = "";
    }
  }

  private render(): void {
    if (!this.container) return;
    
    const agents = this.orchestrator.registry.list();
    const snapshot = this.orchestrator.snapshot();
    
    this.renderer.render(this.container, agents, snapshot);
  }
}
