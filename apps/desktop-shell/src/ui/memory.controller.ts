import { BaseController, type ControllerContext } from "./controller";
import { MemoryRenderer, type MemoryState } from "./renderers/memory.renderer";
import type { ProjectMemoryService } from "../memory/project-memory.service";
import { logger } from "../utils/logger";

export class MemoryController extends BaseController {
  private renderer = new MemoryRenderer();
  private container: HTMLElement;
  
  private state: MemoryState = {
    entries: [],
    isScanning: false,
  };

  public constructor(
    context: ControllerContext,
    private readonly memoryService: ProjectMemoryService,
  ) {
    super(context);
    this.container = document.createElement("div");
    this.container.id = "memory-panel-view";
    this.container.style.display = "none";
    this.container.style.position = "absolute";
    this.container.style.top = "0";
    this.container.style.right = "0";
    this.container.style.width = "400px";
    this.container.style.height = "100%";
    this.container.style.zIndex = "90";
    this.container.style.boxShadow = "-5px 0 25px rgba(0,0,0,0.5)";
    document.body.appendChild(this.container);
  }

  public mount(): void {
    this.listen("#toggle-memory-btn", "click", () => {
      this.togglePanel();
    });

    this.container.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      
      const forgetBtn = target.closest(".ocl-btn-forget");
      if (forgetBtn) {
        const memoryId = (forgetBtn as HTMLElement).dataset.memoryId;
        if (memoryId) {
          void this.forgetMemory(memoryId);
        }
      }

      const reindexBtn = target.closest("#ocl-btn-reindex");
      if (reindexBtn && !this.state.isScanning) {
        void this.reindexProject();
      }
    });
  }

  public async togglePanel() {
    if (this.container.style.display === "none") {
      this.container.style.display = "block";
      await this.refreshState();
    } else {
      this.container.style.display = "none";
    }
  }

  private async refreshState() {
    try {
      this.state.entries = await this.memoryService.list();
      this.updateView();
    } catch (err) {
      logger.error("MemoryController", "Failed to fetch memories", err);
    }
  }

  private async forgetMemory(id: string) {
    try {
      await this.memoryService.remove(id);
      this.state.entries = this.state.entries.filter(e => e.id !== id);
      this.updateView();
    } catch (err) {
      logger.error("MemoryController", "Failed to forget memory", err);
    }
  }

  private async reindexProject() {
    this.state.isScanning = true;
    this.updateView();

    try {
      await new Promise(r => setTimeout(r, 2000));
      
      await this.memoryService.add({
        type: "fact",
        content: "New architecture rule: UI logic must be isolated in renderers.",
        source: "auto-detected",
        confidence: 0.95
      });

      await this.refreshState();
    } catch (err) {
      logger.error("MemoryController", "Failed to re-index project", err);
    } finally {
      this.state.isScanning = false;
      this.updateView();
    }
  }

  private updateView() {
    this.renderer.render(this.container, this.state);
  }
}
