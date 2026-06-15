import { BaseController, type ControllerContext } from "./controller";
import { SettingsRenderer, type SettingsState } from "./renderers/settings.renderer";
import { SecureKeysService } from "../llm/secure-keys.service";
import { logger } from "../utils/logger";

export class SettingsController extends BaseController {
  private renderer = new SettingsRenderer();
  private secureKeys = new SecureKeysService();
  private container: HTMLElement;
  
  private state: SettingsState = {
    isOfflineMode: false,
    localModels: [],
    selectedLocalModel: "",
    openaiKey: "",
    anthropicKey: "",
    isOpen: false,
  };

  public constructor(context: ControllerContext) {
    super(context);
    this.container = document.createElement("div");
    this.container.id = "oclushion-settings-container";
    document.body.appendChild(this.container);
  }

  public mount(): void {
    this.listen(".settings-button", "click", () => {
      void this.open();
    });

    this.container.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (target.id === "ocl-btn-close-settings") {
        this.close();
      } else if (target.id === "ocl-btn-save-settings") {
        void this.save();
      }
    });

    this.container.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      if (target.id === "ocl-toggle-offline") {
        this.state.isOfflineMode = target.checked;
        this.updateView();
      } else if (target.id === "ocl-select-model") {
        this.state.selectedLocalModel = target.value;
      }
    });

    this.container.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      if (target.id === "ocl-input-openai") {
        this.state.openaiKey = target.value;
      } else if (target.id === "ocl-input-anthropic") {
        this.state.anthropicKey = target.value;
      }
    });
  }

  public async open(): Promise<void> {
    this.state.isOpen = true;
    
    try {
      this.state.openaiKey = await this.secureKeys.loadKey("apikey", "openai") || "";
      this.state.anthropicKey = await this.secureKeys.loadKey("apikey", "anthropic") || "";
      const savedOfflineMode = localStorage.getItem("oclushion.offlineMode");
      this.state.isOfflineMode = savedOfflineMode === "true";
      const savedModel = localStorage.getItem("oclushion.localModel");
      
      this.updateView();

      await this.fetchLocalModels();
      
      if (savedModel && this.state.localModels.includes(savedModel)) {
        this.state.selectedLocalModel = savedModel;
      } else if (this.state.localModels.length > 0 && !this.state.localModels.includes(this.state.selectedLocalModel)) {
        this.state.selectedLocalModel = this.state.localModels[0] || "";
      }

      this.updateView();
    } catch (err) {
      logger.error("SettingsController", "Failed to load settings", err);
    }
  }

  public close(): void {
    this.state.isOpen = false;
    this.updateView();
  }

  private async save(): Promise<void> {
    try {
      await this.secureKeys.saveKey("apikey", "openai", this.state.openaiKey);
      await this.secureKeys.saveKey("apikey", "anthropic", this.state.anthropicKey);
      
      localStorage.setItem("oclushion.offlineMode", String(this.state.isOfflineMode));
      localStorage.setItem("oclushion.localModel", this.state.selectedLocalModel);
      
      this.close();
      logger.info("SettingsController", "Settings saved successfully");
    } catch (err) {
      logger.error("SettingsController", "Failed to save settings", err);
    }
  }

  private async fetchLocalModels(): Promise<void> {
    try {
      const response = await fetch("http://127.0.0.1:11434/api/tags");
      if (!response.ok) {
        throw new Error("Ollama not reachable");
      }
      const data = await response.json();
      if (data && Array.isArray(data.models)) {
        this.state.localModels = data.models.map((m: { name: string }) => m.name);
      }
    } catch (err) {
      logger.warn("SettingsController", "Could not fetch Ollama models", err);
      this.state.localModels = [];
    }
  }

  private updateView(): void {
    this.renderer.render(this.container, this.state);
  }
}
