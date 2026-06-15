import { BaseController, type ControllerContext } from "./controller";
import { ActivityBarRenderer, type ActivityBarState } from "./renderers/activity-bar.renderer";
import { logger } from "../utils/logger";

export class ActivityBarController extends BaseController {
  private renderer = new ActivityBarRenderer();
  private container: HTMLElement | null = null;
  private state: ActivityBarState;

  public constructor(context: ControllerContext) {
    super(context);
    
    this.state = {
      activeTabId: "explorer",
      tabs: [
        { id: "explorer", icon: "📁", title: "Explorer (Ctrl+Shift+E)" },
        { id: "search", icon: "🔍", title: "Search (Ctrl+Shift+F)" },
        { id: "source-control", icon: "🌿", title: "Source Control (Ctrl+Shift+G)", hasBadge: true },
        { id: "debug", icon: "🐛", title: "Run and Debug (Ctrl+Shift+D)" },
        { id: "skills", icon: "🧩", title: "Skills Marketplace (Ctrl+Shift+X)" },
      ]
    };
  }

  public mount(): void {
    this.container = this.context.root instanceof Document
      ? this.context.root.getElementById("activity-bar")
      : this.context.root.querySelector("#activity-bar");

    if (!this.container) {
      return;
    }

    this.render();
    this.attachEvents();
  }

  private attachEvents(): void {
    if (!this.container) return;

    this.container.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      const tab = target.closest(".ocl-activity-tab") as HTMLElement;
      
      if (tab) {
        const tabId = tab.dataset.tab;
        if (tabId && tabId !== this.state.activeTabId) {
          logger.info("ActivityBar", `Switched to tab: ${tabId}`);
          this.state.activeTabId = tabId;
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
