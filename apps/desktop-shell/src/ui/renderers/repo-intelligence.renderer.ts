export type RepoIntelligenceButton = {
  id: string;
  icon: string;
  label: string;
};

export class RepoIntelligenceRenderer {
  private readonly buttons: RepoIntelligenceButton[] = [
    { id: "ri-repo-graph", icon: "📊", label: "Repo Graph" },
    { id: "ri-context-gen", icon: "📋", label: "Context Generator" },
    { id: "ri-token-opt", icon: "⚡", label: "Token Optimizer" },
    { id: "ri-safe-diff", icon: "✂️", label: "Safe Diff" },
    { id: "ri-deps-analyzer", icon: "📦", label: "Dependency Analyzer" },
    { id: "ri-docs-gen", icon: "📝", label: "Docs Generator" },
  ];

  public render(): string {
    return `
      <section class="ocl-ri-panel">
        <h3 class="ocl-ri-title">REPO INTELLIGENCE</h3>
        <div class="ocl-ri-grid">
          ${this.buttons.map(btn => this.renderButton(btn)).join("")}
        </div>
      </section>
    `;
  }

  private renderButton(btn: RepoIntelligenceButton): string {
    return `
      <button type="button" class="ocl-ri-button" data-ri-action="${btn.id}">
        <span class="ocl-ri-icon">${btn.icon}</span>
        <span class="ocl-ri-label">${btn.label}</span>
      </button>
    `;
  }
}
