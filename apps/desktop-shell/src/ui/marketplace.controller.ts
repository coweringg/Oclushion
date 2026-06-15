import { BaseController, type ControllerContext } from "./controller";
import { MarketplaceRenderer, type MarketplaceState } from "./renderers/marketplace.renderer";
import type { MarketplaceItem } from "../marketplace/marketplace.types";
import { SkillPublishController } from "./skill-publish.controller";

export type MarketplaceControllerActions = {
  open(): Promise<void>;
  installSkill(skillId: string): Promise<void>;
  uninstallSkill(skillId: string): Promise<void>;
  purchaseSkill(skillId: string): Promise<void>;
  fetchCatalog(): Promise<MarketplaceItem[]>;
  getInstalledIds(): Promise<string[]>;
  getPurchasedIds(): Promise<string[]>;
};

export class MarketplaceController extends BaseController {
  private renderer = new MarketplaceRenderer();
  private container: HTMLElement;
  private publishController: SkillPublishController | null = null;
  
  private state: MarketplaceState = {
    activeTab: "community",
    activeCategory: "all",
    items: [],
    installedIds: new Set(),
    purchasedIds: new Set(),
    searchQuery: "",
  };

  public constructor(
    context: ControllerContext,
    private readonly actions: MarketplaceControllerActions,
  ) {
    super(context);
    this.container = document.createElement("div");
    this.container.id = "marketplace-view";
    this.container.style.display = "none";
    this.container.style.position = "absolute";
    this.container.style.top = "0";
    this.container.style.left = "0";
    this.container.style.width = "100%";
    this.container.style.height = "100%";
    this.container.style.zIndex = "100";
    document.body.appendChild(this.container);
  }

  public mount(): void {
    this.listen("#marketplace-nav-button", "click", () => {
      void this.openMarketplace();
    });

    this.publishController = new SkillPublishController(this.context);
    this.publishController.mount();

    this.container.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      
      if (target.id === "btn-open-publish" || target.closest("#btn-open-publish")) {
        this.publishController?.open();
        return;
      }

      const tabEl = target.closest(".ocl-nav-item[data-tab]");
      if (tabEl) {
        this.state.activeTab = (tabEl as HTMLElement).dataset.tab as any;
        this.updateView();
      }

      const catEl = target.closest(".ocl-nav-item[data-category]");
      if (catEl) {
        this.state.activeCategory = (catEl as HTMLElement).dataset.category as string;
        this.updateView();
      }

      const btn = target.closest("button[data-marketplace-action]");
      if (btn) {
        const action = (btn as HTMLElement).dataset.marketplaceAction;
        const skillId = (btn as HTMLElement).dataset.skillId;
        
        if (action === "install-skill" && skillId) {
          void this.actions.installSkill(skillId).then(() => this.refreshState());
        }
        if (action === "uninstall-skill" && skillId) {
          void this.actions.uninstallSkill(skillId).then(() => this.refreshState());
        }
        if (action === "purchase-skill" && skillId) {
          void this.actions.purchaseSkill(skillId).then(() => this.refreshState());
        }
      }
    });

    this.container.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      if (target.id === "ocl-search-input") {
        this.state.searchQuery = target.value;
        this.updateView();
      }
    });
  }

  public async openMarketplace() {
    this.container.style.display = "block";
    await this.refreshState();
  }

  public closeMarketplace() {
    this.container.style.display = "none";
  }

  private async refreshState() {
    const [items, installed, purchased] = await Promise.all([
      this.actions.fetchCatalog(),
      this.actions.getInstalledIds(),
      this.actions.getPurchasedIds(),
    ]);

    this.state.items = items;
    this.state.installedIds = new Set(installed);
    this.state.purchasedIds = new Set(purchased);
    this.updateView();
  }

  private updateView() {
    this.renderer.render(this.container, this.state);
    
    if (document.activeElement?.id === "ocl-search-input") {
      const input = this.container.querySelector("#ocl-search-input") as HTMLInputElement;
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }
  }
}
