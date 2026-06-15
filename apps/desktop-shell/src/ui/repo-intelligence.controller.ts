import { RepoIntelligenceRenderer } from "./renderers/repo-intelligence.renderer";
import { showToast } from "./toast";

export class RepoIntelligenceController {
  private readonly renderer = new RepoIntelligenceRenderer();
  private container: HTMLElement | null = null;

  public mount(rootId: string): void {
    this.container = document.getElementById(rootId);
    if (!this.container) return;

    this.container.innerHTML = this.renderer.render();
    this.attachEvents();
  }

  private attachEvents(): void {
    if (!this.container) return;

    this.container.addEventListener("click", (e) => {
      const button = (e.target as HTMLElement).closest(".ocl-ri-button");
      if (button) {
        const actionId = button.getAttribute("data-ri-action");
        if (actionId) {
          this.handleAction(actionId);
        }
      }
    });
  }

  private handleAction(actionId: string): void {
    switch (actionId) {
      case "ri-repo-graph":
        showToast({ message: "Repo Graph — Generando visualización de dependencias del repositorio...", severity: "info" });
        break;
      case "ri-context-gen":
        showToast({ message: "Context Generator — Empaquetando contexto para el portapapeles...", severity: "info" });
        break;
      case "ri-token-opt":
        showToast({ message: "Token Optimizer — Compactando historial de chat...", severity: "info" });
        break;
      case "ri-safe-diff":
        document.dispatchEvent(new CustomEvent("ocl-command", { detail: { commandId: "submit-review" } }));
        break;
      case "ri-deps-analyzer":
        showToast({ message: "Dependency Analyzer — Analizando package.json por vulnerabilidades...", severity: "info" });
        break;
      case "ri-docs-gen":
        showToast({ message: "Docs Generator — Generando TSDoc para el archivo actual...", severity: "info" });
        break;
      default:
        console.warn("Unknown Repo Intelligence action:", actionId);
    }
  }
}
