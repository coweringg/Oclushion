import { BaseController, type ControllerContext } from "./controller";
import { LiveCursorsRenderer, type CursorPosition } from "./renderers/live-cursors.renderer";
import type { TeamSyncService } from "../multiplayer/team-sync.service";

export class LiveCursorsController extends BaseController {
  private renderer = new LiveCursorsRenderer();
  private container: HTMLElement | null = null;
  private cursors: Map<string, CursorPosition> = new Map();
  private updateInterval: any = null;

  public constructor(
    context: ControllerContext,
    private readonly teamSyncService: TeamSyncService
  ) {
    super(context);
  }

  public mount(): void {
    this.container = document.createElement("div");
    document.body.appendChild(this.container);

    this.startMockSimulation();
  }

  public override destroy(): void {
    super.destroy();
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }

  private startMockSimulation(): void {
    const agents = [
      { id: "agent-1", name: "Agent Architect", color: "#8b5cf6", x: 200, y: 150 },
      { id: "agent-2", name: "DevJuan", color: "#22c55e", x: 400, y: 300 },
      { id: "agent-3", name: "Agent QA", color: "#f59e0b", x: 600, y: 100 }
    ];

    agents.forEach(a => this.cursors.set(a.id, a));

    this.updateInterval = setInterval(() => {
      this.cursors.forEach(cursor => {
        cursor.x += (Math.random() - 0.5) * 40;
        cursor.y += (Math.random() - 0.5) * 40;
        
        cursor.x = Math.max(0, Math.min(window.innerWidth - 100, cursor.x));
        cursor.y = Math.max(0, Math.min(window.innerHeight - 50, cursor.y));
      });

      if (this.container) {
        this.renderer.render(this.container, Array.from(this.cursors.values()));
      }
    }, 500);
  }
}
