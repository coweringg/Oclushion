import { BaseController, type ControllerContext } from "./controller";
import { OrgSidebarRenderer, type OrgSidebarState } from "./renderers/org-sidebar.renderer";
import type { TeamSyncService } from "../multiplayer/team-sync.service";

export class OrgSidebarController extends BaseController {
  private readonly renderer = new OrgSidebarRenderer();
  private container: HTMLElement | null = null;
  private unsubscribe: (() => void) | null = null;
  
  private currentState: OrgSidebarState = {
    organizations: [
      { id: "org-1", name: "Oclushion Corp", tier: "enterprise", members: [], settings: { requireInternalReviews: true } },
      { id: "org-2", name: "Universidad XYZ", tier: "free", members: [], settings: { requireInternalReviews: false } },
    ],
    activeOrgId: "org-1",
    onlineCounts: {
      "org-1": 12,
      "org-2": 4,
    },
    onlineMembers: [
      { id: "user-1", name: "DevJuan", avatar: "👨‍💻", status: "online" },
      { id: "agent-qa", name: "Agent QA", avatar: "🐛", status: "online" },
      { id: "agent-arch", name: "Agent Architect", avatar: "🧠", status: "online" }
    ]
  };

  public constructor(
    context: ControllerContext,
    private readonly teamSyncService: TeamSyncService,
  ) {
    super(context);
  }

  public mount(): void {
    this.container = this.context.root instanceof Document 
      ? this.context.root.getElementById("org-sidebar") 
      : this.context.root.querySelector("#org-sidebar");

    if (!this.container) {
      return;
    }

    this.render();
    this.attachEvents();
  }

  public override destroy(): void {
    super.destroy();
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  private attachEvents(): void {
    this.listen(".ocl-org-icon[data-org-id]", "click", (e, element) => {
      const orgId = element.getAttribute("data-org-id");
      if (orgId) {
        this.currentState.activeOrgId = orgId;
        this.render();
      }
    });
  }

  private render(): void {
    if (this.container) {
      this.renderer.render(this.container, this.currentState);
    }
  }
}
