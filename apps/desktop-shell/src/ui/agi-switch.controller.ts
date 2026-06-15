import { BaseController, type ControllerContext } from "./controller";
import { AgiSwitchRenderer, type AgiSwitchState } from "./renderers/agi-switch.renderer";
import type { AgentOrchestrator } from "../agents/orchestrator";

export class AgiSwitchController extends BaseController {
  private readonly renderer = new AgiSwitchRenderer();
  private container: HTMLElement | null = null;
  private swarmRenderer: any = null;
  
  private currentState: AgiSwitchState = {
    isActive: false,
  };

  public constructor(
    context: ControllerContext,
    private readonly agentOrchestrator: AgentOrchestrator,
  ) {
    super(context);
  }

  public mount(): void {
    this.container = this.context.root instanceof Document 
      ? this.context.root.getElementById("ocl-agi-switch-mount") 
      : this.context.root.querySelector("#ocl-agi-switch-mount");

    if (!this.container) return;

    this.attachEvents();
    this.render();
  }

  private attachEvents(): void {
    this.listen("#agi-toggle-btn", "click", () => {
      this.currentState.isActive = !this.currentState.isActive;
      this.render();
      
      const swarmOverlay = document.getElementById("agi-swarm-overlay");

      if (this.currentState.isActive) {
        this.agentOrchestrator.enableAgiMode();
        this.playBootSound();
        if (swarmOverlay) {
          swarmOverlay.classList.add("active");
        }
      } else {
        this.agentOrchestrator.disableAgiMode();
        if (swarmOverlay) {
          swarmOverlay.classList.remove("active");
        }
      }
    });
  }

  private playBootSound(): void {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(50, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.5);
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 1);
    } catch (e) {
    }
  }

  private render(): void {
    if (this.container) {
      this.renderer.render(this.container, this.currentState);
    }
  }
}
