import { BaseController, type ControllerContext } from "./controller";
import { SkillPublishRenderer, type SkillPublishState } from "./renderers/skill-publish.renderer";
import { logger } from "../utils/logger";

export class SkillPublishController extends BaseController {
  private renderer = new SkillPublishRenderer();
  private container: HTMLElement | null = null;
  
  private state: SkillPublishState = {
    isOpen: false,
    privacy: "public",
    targetOrg: null,
    allowedPlans: {
      free: true,
      pro: true,
      enterprise: true,
    },
    availableOrgs: [
      { id: "org-oclushion", name: "Oclushion Corp (Enterprise)" },
      { id: "discord-vip", name: "Oclushion VIP (Discord)" }
    ]
  };

  public constructor(context: ControllerContext) {
    super(context);
  }

  public mount(): void {
    this.container = document.createElement("div");
    this.container.id = "ocl-skill-publish-container";
    document.body.appendChild(this.container);

    this.container.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;

      if (target.id === "btn-close-publish" || target.id === "btn-cancel-publish") {
        this.close();
      }

      if (target.id === "btn-submit-publish") {
        this.submit();
      }

      const radio = target.closest("input[name='privacy']") as HTMLInputElement;
      if (radio) {
        this.state.privacy = radio.value as "public" | "private";
        if (this.state.privacy === "private") {
          this.state.targetOrg = null;
        }
        this.updateView();
      }

      const freeLabel = target.closest("label:has(#chk-plan-free)");
      if (freeLabel) {
        e.preventDefault();
        this.state.allowedPlans.free = !this.state.allowedPlans.free;
        this.updateView();
      }

      const proLabel = target.closest("label:has(#chk-plan-pro)");
      if (proLabel) {
        e.preventDefault();
        this.state.allowedPlans.pro = !this.state.allowedPlans.pro;
        this.updateView();
      }

      const entLabel = target.closest("label:has(#chk-plan-enterprise)");
      if (entLabel) {
        e.preventDefault();
        this.state.allowedPlans.enterprise = !this.state.allowedPlans.enterprise;
        this.updateView();
      }
    });

    this.container.addEventListener("change", (e) => {
      const target = e.target as HTMLElement;
      if (target.id === "select-target-org") {
        const val = (target as HTMLSelectElement).value;
        this.state.targetOrg = val === "" ? null : val;
        this.updateView();
      }
    });
  }

  public open(): void {
    this.state.isOpen = true;
    this.updateView();
  }

  public close(): void {
    this.state.isOpen = false;
    this.updateView();
  }

  private submit(): void {
    logger.info("SkillPublish", "Skill published successfully", this.state);
    this.close();
  }

  private updateView(): void {
    if (this.container) {
      this.renderer.render(this.container, this.state);
    }
  }
}
