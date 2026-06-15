import { BaseController, type ControllerContext } from "./controller";
import { ProductionMonitorRenderer, type ProductionMonitorState } from "./renderers/production-monitor.renderer";
import type { ProductionMonitorService } from "../monitoring/production-monitor.service";
import { logger } from "../utils/logger";

export class ProductionMonitorController extends BaseController {
  private renderer = new ProductionMonitorRenderer();
  private container: HTMLElement | null = null;
  private unsubscribe: (() => void) | null = null;

  private state: ProductionMonitorState = {
    isConnected: false,
    issues: [],
    autoFixEnabled: false,
  };

  public constructor(
    context: ControllerContext,
    private readonly monitorService: ProductionMonitorService,
    private readonly onAutoFix: (issueId: string, stackTrace: string, affectedFiles: string[]) => void,
  ) {
    super(context);
  }

  public mount(): void {
    this.container = this.context.root instanceof Document
      ? this.context.root.getElementById("ocl-production-monitor-mount")
      : this.context.root.querySelector("#ocl-production-monitor-mount");

    if (!this.container) {
      return;
    }

    this.state.isConnected = this.monitorService.getConfig() !== null;
    this.state.autoFixEnabled = this.monitorService.getConfig()?.autoFixEnabled ?? false;
    this.state.issues = this.monitorService.getTrackedIssues();

    this.unsubscribe = this.monitorService.subscribe((issues) => {
      this.state.issues = issues;
      this.state.isConnected = true;
      this.render();

      if (this.state.autoFixEnabled) {
        const pendingIssues = issues.filter(i => i.fixStatus === "pending");
        for (const tracked of pendingIssues) {
          this.triggerAutoFix(tracked.issue.id, tracked.stackTrace, tracked.affectedFiles);
        }
      }
    });

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
    if (!this.container) return;

    this.container.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;

      if (target.id === "btn-toggle-autofix" || target.closest("#btn-toggle-autofix")) {
        this.state.autoFixEnabled = !this.state.autoFixEnabled;
        this.render();
        logger.info("ProductionMonitor", `Auto-fix ${this.state.autoFixEnabled ? "enabled" : "disabled"}`);
        return;
      }

      const fixBtn = target.closest("[data-fix-issue]") as HTMLElement;
      if (fixBtn) {
        const issueId = fixBtn.dataset.fixIssue;
        if (issueId) {
          const tracked = this.state.issues.find(i => i.issue.id === issueId);
          if (tracked) {
            this.triggerAutoFix(issueId, tracked.stackTrace, tracked.affectedFiles);
          }
        }
        return;
      }

      const skipBtn = target.closest("[data-skip-issue]") as HTMLElement;
      if (skipBtn) {
        const issueId = skipBtn.dataset.skipIssue;
        if (issueId) {
          this.monitorService.markSkipped(issueId);
        }
        return;
      }
    });
  }

  private triggerAutoFix(issueId: string, stackTrace: string, affectedFiles: string[]): void {
    this.monitorService.markFixing(issueId, `fix-${Date.now()}`);
    this.onAutoFix(issueId, stackTrace, affectedFiles);
    logger.info("ProductionMonitor", `Auto-fix triggered for issue: ${issueId}`);
  }

  private render(): void {
    if (this.container) {
      this.renderer.render(this.container, this.state);
    }
  }
}
