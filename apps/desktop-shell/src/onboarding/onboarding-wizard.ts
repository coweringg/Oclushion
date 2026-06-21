import type { KeyValueStore } from "../persistent-store";
import { logger } from "../utils/logger";

const ONBOARDING_KEY = "ocl_onboarding_completed";

export type StepId = "welcome" | "open-repo" | "config-ai" | "first-prompt" | "done";

const STEPS: { id: StepId; icon: string; label: string }[] = [
  { id: "welcome", icon: "\u{1F44B}", label: "Welcome" },
  { id: "open-repo", icon: "\u{1F4C1}", label: "Open Repository" },
  { id: "config-ai", icon: "\u{1F511}", label: "Configure AI" },
  { id: "first-prompt", icon: "\u{1F4AC}", label: "First Prompt" },
];

type WizardListener = (event: "completed" | "skipped") => void;

export class OnboardingWizard {
  private currentStepIndex = 0;
  private overlay: HTMLElement | null = null;
  private listeners = new Set<WizardListener>();

  constructor(
    private readonly kvStore: KeyValueStore,
    private readonly onOpenRepo: () => Promise<string | null>,
    private readonly onSaveApiKey: (provider: string, key: string) => Promise<void>,
    private readonly onSendPrompt: (text: string) => void,
  ) {}

  subscribe(listener: WizardListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async shouldShow(): Promise<boolean> {
    try {
      const completed = await this.kvStore.getItem(ONBOARDING_KEY);
      return completed !== "true";
    } catch {
      try {
        return localStorage.getItem(ONBOARDING_KEY) !== "true";
      } catch {
        return true;
      }
    }
  }

  mount(root: HTMLElement): void {
    root.innerHTML = this.renderOverlay();
    this.overlay = root.firstElementChild as HTMLElement;
    this.renderCurrentStep();
    this.attachEvents();
  }

  private renderOverlay(): string {
    const stepButtons = STEPS.map((s, i) => {
      const cls = [
        "ocl-wizard-step",
        i === this.currentStepIndex ? "current" : "",
        i < this.currentStepIndex ? "done" : "",
      ].filter(Boolean).join(" ");
      return [
        '<button class="' + cls + '" data-step-index="' + i + '" type="button" disabled>',
        '  <span class="ocl-wizard-step-num">' + (i < this.currentStepIndex ? "✓" : s.icon) + "</span>",
        '  <span class="ocl-wizard-step-label">' + s.label + "</span>",
        "</button>",
      ].join("\n");
    }).join("\n");

    return [
      '<div class="ocl-wizard-overlay" id="onboarding-wizard-overlay">',
      '  <div class="ocl-wizard-container">',
      '    <aside class="ocl-wizard-sidebar">',
      '      <div class="ocl-wizard-logo">Oclushion</div>',
      '      <div class="ocl-wizard-steps">',
      stepButtons,
      "      </div>",
      '      <button id="onboarding-skip-all" class="ocl-wizard-skip" type="button">Skip all →</button>',
      "    </aside>",
      '    <main class="ocl-wizard-content" id="onboarding-step-content">',
      "    </main>",
      "  </div>",
      "</div>",
    ].join("\n");
  }

  private renderCurrentStep(): void {
    const content = document.getElementById("onboarding-step-content");
    if (!content) return;

    const step = STEPS[this.currentStepIndex];
    if (!step) return;
    content.innerHTML = this.getStepHtml(step.id);
    this.updateSidebar();
    this.attachStepEvents(step.id);
  }

  private getStepHtml(stepId: StepId): string {
    switch (stepId) {
      case "welcome": return this.renderWelcomeStep();
      case "open-repo": return this.renderOpenRepoStep();
      case "config-ai": return this.renderConfigAiStep();
      case "first-prompt": return this.renderFirstPromptStep();
      default: return "";
    }
  }

  private renderWelcomeStep(): string {
    return [
      '<div class="ocl-wizard-step-content">',
      '  <div class="ocl-wizard-icon">✨</div>',
      '  <h2 class="ocl-wizard-heading">Welcome to Oclushion</h2>',
      '  <p class="ocl-wizard-subtitle">Your AI-native development environment. Let us get you set up in a few quick steps.</p>',
      '  <ul class="ocl-wizard-benefits">',
      "    <li>\u{1F4C1} Open any project folder — local, safe, no uploads required</li>",
      "    <li>\u{1F916} Chat with AI that understands your full codebase</li>",
      "    <li>\u{1F6E1}️ Built-in security scanning with Sano Shield</li>",
      "    <li>\u{1F9E9} Extend with skill packs from the marketplace</li>",
      "  </ul>",
      '  <div class="ocl-wizard-actions">',
      '    <button id="onboarding-next" class="ocl-wizard-btn primary" type="button">Get Started</button>',
      "  </div>",
      "</div>",
    ].join("\n");
  }

  private renderOpenRepoStep(): string {
    return [
      '<div class="ocl-wizard-step-content">',
      '  <div class="ocl-wizard-icon">\u{1F4C1}</div>',
      '  <h2 class="ocl-wizard-heading">Open a Repository</h2>',
      '  <p class="ocl-wizard-subtitle">Choose a project folder to get started. Your code stays on your machine — always.</p>',
      '  <div class="ocl-wizard-actions">',
      '    <button id="onboarding-pick-folder" class="ocl-wizard-btn primary" type="button">\u{1F4C2}  Choose Folder</button>',
      "    <button id=\"onboarding-skip-folder\" class=\"ocl-wizard-btn ghost\" type=\"button\">Skip, I will do it later</button>",
      "  </div>",
      '  <p class="ocl-wizard-tip" style="margin-top: 16px">The repository will be scanned locally with Sano Shield. No data leaves your machine.</p>',
      "</div>",
    ].join("\n");
  }

  private renderConfigAiStep(): string {
    return [
      '<div class="ocl-wizard-step-content">',
      '  <div class="ocl-wizard-icon">\u{1F511}</div>',
      '  <h2 class="ocl-wizard-heading">Configure AI Provider</h2>',
      '  <p class="ocl-wizard-subtitle">Choose your AI provider and enter your API key to start coding with AI.</p>',
      '  <div style="margin-bottom: 16px">',
      '    <label style="display: block; font-size: 13px; color: #d1d5db; margin-bottom: 6px">Provider</label>',
      '    <select id="onboarding-provider" style="width: 100%; padding: 10px 12px; background: rgba(139,155,181,0.08); border: 1px solid rgba(139,155,181,0.15); border-radius: 8px; color: #fff; font-size: 14px; outline: none">',
      '      <option value="anthropic">Anthropic (Claude)</option>',
      '      <option value="openai">OpenAI (GPT)</option>',
      '      <option value="ollama">Ollama (Local)</option>',
      '      <option value="lmstudio">LM Studio (Local)</option>',
      "    </select>",
      "  </div>",
      '  <div style="margin-bottom: 24px">',
      '    <label style="display: block; font-size: 13px; color: #d1d5db; margin-bottom: 6px">API Key</label>',
      '    <input type="password" id="onboarding-api-key" placeholder="sk-ant-..." style="width: 100%; padding: 10px 12px; background: rgba(139,155,181,0.08); border: 1px solid rgba(139,155,181,0.15); border-radius: 8px; color: #fff; font-size: 14px; outline: none" />',
      "  </div>",
      '  <div class="ocl-wizard-actions">',
      '    <button id="onboarding-save-key" class="ocl-wizard-btn primary" type="button">Save &amp; Continue</button>',
      "    <button id=\"onboarding-skip-key\" class=\"ocl-wizard-btn ghost\" type=\"button\">Skip, I will configure later</button>",
      "  </div>",
      "</div>",
    ].join("\n");
  }

  private renderFirstPromptStep(): string {
    return [
      '<div class="ocl-wizard-step-content">',
      '  <div class="ocl-wizard-icon">\u{1F3AF}</div>',
      '  <h2 class="ocl-wizard-heading">Your first prompt is ready!</h2>',
      '  <p class="ocl-wizard-subtitle">Try sending this example prompt to ask AI about your project.</p>',
      '  <div class="ocl-wizard-prompt-suggestion">',
      '    <p>&quot;<strong>Explain the architecture of this project and suggest where I should start contributing.</strong>&quot;</p>',
      "  </div>",
      '  <div class="ocl-wizard-actions">',
      '    <button id="onboarding-send-prompt" class="ocl-wizard-btn primary" type="button">\u{1F4E4}  Send example prompt</button>',
      '    <button id="onboarding-write-own" class="ocl-wizard-btn secondary" type="button">✏️  I will write my own</button>',
      "  </div>",
      "</div>",
    ].join("\n");
  }

  private updateSidebar(): void {
    document.querySelectorAll(".ocl-wizard-step").forEach((el) => {
      const index = parseInt((el as HTMLElement).dataset.stepIndex ?? "0", 10);
      el.classList.toggle("current", index === this.currentStepIndex);
      el.classList.toggle("done", index < this.currentStepIndex);
      const numEl = el.querySelector(".ocl-wizard-step-num");
      if (numEl) {
        numEl.textContent = index < this.currentStepIndex ? "✓" : STEPS[index]?.icon ?? "";
      }
    });
  }

  private attachStepEvents(stepId: StepId): void {
    switch (stepId) {
      case "welcome":
        document.getElementById("onboarding-next")?.addEventListener("click", () => this.next());
        break;
      case "open-repo":
        document.getElementById("onboarding-pick-folder")?.addEventListener("click", () => this.handlePickFolder());
        document.getElementById("onboarding-skip-folder")?.addEventListener("click", () => this.next());
        break;
      case "config-ai":
        document.getElementById("onboarding-save-key")?.addEventListener("click", () => this.handleSaveKey());
        document.getElementById("onboarding-skip-key")?.addEventListener("click", () => this.next());
        break;
      case "first-prompt":
        document.getElementById("onboarding-send-prompt")?.addEventListener("click", () =>
          this.handleSendPrompt(
            "Explain the architecture of this project and suggest where I should start contributing.",
          ),
        );
        document.getElementById("onboarding-write-own")?.addEventListener("click", () => this.complete());
        break;
    }
  }

  private attachEvents(): void {
    document.getElementById("onboarding-skip-all")?.addEventListener("click", () => this.skip());
  }

  private async handlePickFolder(): Promise<void> {
    const folder = await this.onOpenRepo();
    if (folder) {
      this.next();
    }
  }

  private async handleSaveKey(): Promise<void> {
    const provider = (document.getElementById("onboarding-provider") as HTMLSelectElement)?.value ?? "anthropic";
    const key = (document.getElementById("onboarding-api-key") as HTMLInputElement)?.value ?? "";
    if (key.trim()) {
      try {
        await this.onSaveApiKey(provider, key.trim());
      } catch (error) {
        logger.debug("OnboardingWizard", "Failed to save API key", error);
      }
    }
    this.next();
  }

  private handleSendPrompt(text: string): void {
    this.onSendPrompt(text);
    this.complete();
  }

  private next(): void {
    if (this.currentStepIndex < STEPS.length - 1) {
      this.currentStepIndex++;
      this.renderCurrentStep();
    } else {
      this.complete();
    }
  }

  private async complete(): Promise<void> {
    try {
      await this.kvStore.setItem(ONBOARDING_KEY, "true");
    } catch {
      try {
        localStorage.setItem(ONBOARDING_KEY, "true");
      } catch {}
    }
    this.destroy();
    for (const listener of this.listeners) {
      listener("completed");
    }
  }

  private async skip(): Promise<void> {
    try {
      await this.kvStore.setItem(ONBOARDING_KEY, "true");
    } catch {
      try {
        localStorage.setItem(ONBOARDING_KEY, "true");
      } catch {}
    }
    this.destroy();
    for (const listener of this.listeners) {
      listener("skipped");
    }
  }

  private destroy(): void {
    this.overlay?.remove();
    this.overlay = null;
    document.querySelectorAll(".ocl-wizard-overlay").forEach((el) => el.remove());
  }
}
