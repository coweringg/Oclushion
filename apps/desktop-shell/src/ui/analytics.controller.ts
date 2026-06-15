import { BaseController, type ControllerContext } from "./controller";
import { AnalyticsRenderer, type AnalyticsState } from "./renderers/analytics.renderer";
import type { TeamSyncService } from "../multiplayer/team-sync.service";

export class AnalyticsController extends BaseController {
  private readonly renderer = new AnalyticsRenderer();
  private container: HTMLElement | null = null;
  private unsubscribe: (() => void) | null = null;
  
  private currentState: AnalyticsState = {
    standup: null,
    isOpen: false,
  };

  public constructor(
    context: ControllerContext,
    private readonly teamSyncService: TeamSyncService,
  ) {
    super(context);
    
    this.currentState.standup = {
      id: "std-1",
      sessionId: "ses-1",
      generatedAt: new Date().toISOString(),
      period: { from: "yesterday", to: "today" },
      teamHighlights: [],
      blockers: [],
      memberSummaries: [
        {
          userId: "u1",
          userName: "Juan (Junior)",
          tasksCompleted: ["Auth Fix"],
          blockers: ["CORS Error"],
          timeStuckOnTaskMinutes: 180,
          wellbeingStatus: "burnout_risk",
          healthScore: 35,
          aiCreditsUsed: 400
        },
        {
          userId: "u2",
          userName: "Maria (Senior)",
          tasksCompleted: ["DB Migration", "API Cache"],
          blockers: [],
          timeStuckOnTaskMinutes: 5,
          wellbeingStatus: "excellent",
          healthScore: 92,
          aiCreditsUsed: 120
        }
      ]
    };
  }

  public mount(): void {
    this.container = this.context.root instanceof Document 
      ? this.context.root.getElementById("ocl-analytics-mount") 
      : this.context.root.querySelector("#ocl-analytics-mount");

    if (!this.container) return;

    this.attachEvents();
    this.render();
  }

  private attachEvents(): void {
    this.listen("#analytics-trigger", "click", () => {
      this.currentState.isOpen = !this.currentState.isOpen;
      this.render();
    });
  }

  private render(): void {
    if (this.container) {
      this.renderer.render(this.container, this.currentState);
    }
  }
}
