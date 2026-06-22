import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";

const STEPS = [
  { id: "welcome", icon: "\u{1F44B}", label: "Welcome" },
  { id: "open-repo", icon: "\u{1F4C1}", label: "Open Repository" },
  { id: "config-ai", icon: "\u{1F511}", label: "Configure AI" },
  { id: "first-prompt", icon: "\u{1F4AC}", label: "First Prompt" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

@customElement("ide-onboarding-wizard")
export class IdeOnboardingWizard extends LitElement {
  @property({ type: Boolean, reflect: true })
  active = false;

  onOpenRepo?: () => Promise<string | null>;
  onSaveApiKey?: (provider: string, key: string) => Promise<void>;
  onSendPrompt?: (text: string) => void;

  private currentStepIndex = 0;

  protected override createRenderRoot() {
    return this;
  }

  override render() {
    if (!this.active) {
      return html``;
    }

    const currentStep = STEPS[this.currentStepIndex];
    if (!currentStep) {
      return html``;
    }

    return html`
      <div class="ocl-wizard-overlay" id="onboarding-wizard-overlay">
        <div class="ocl-wizard-container">
          <aside class="ocl-wizard-sidebar">
            <div class="ocl-wizard-logo">Oclushion</div>
            <div class="ocl-wizard-steps">
              ${STEPS.map((s, i) => {
                const cls = [
                  "ocl-wizard-step",
                  i === this.currentStepIndex ? "current" : "",
                  i < this.currentStepIndex ? "done" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return html`
                  <button class="${cls}" type="button" disabled>
                    <span class="ocl-wizard-step-num"
                      >${i < this.currentStepIndex ? "✓" : s.icon}</span
                    >
                    <span class="ocl-wizard-step-label">${s.label}</span>
                  </button>
                `;
              })}
            </div>
            <button
              id="onboarding-skip-all"
              class="ocl-wizard-skip"
              type="button"
              @click=${this.skip}
            >
              Skip all →
            </button>
          </aside>
          <main class="ocl-wizard-content" id="onboarding-step-content">
            ${this.renderStepContent(currentStep.id)}
          </main>
        </div>
      </div>
    `;
  }

  private renderStepContent(stepId: StepId) {
    switch (stepId) {
      case "welcome":
        return this.renderWelcomeStep();
      case "open-repo":
        return this.renderOpenRepoStep();
      case "config-ai":
        return this.renderConfigAiStep();
      case "first-prompt":
        return this.renderFirstPromptStep();
    }
  }

  private renderWelcomeStep() {
    return html`
      <div class="ocl-wizard-step-content">
        <div class="ocl-wizard-icon">✨</div>
        <h2 class="ocl-wizard-heading">Welcome to Oclushion</h2>
        <p class="ocl-wizard-subtitle">
          Your AI-native development environment. Let us get you set up in a few
          quick steps.
        </p>
        <ul class="ocl-wizard-benefits">
          <li>📁 Open any project folder — local, safe, no uploads required</li>
          <li>🤖 Chat with AI that understands your full codebase</li>
          <li>🛡️ Built-in security scanning with Sano Shield</li>
          <li>🧩 Extend with skill packs from the marketplace</li>
        </ul>
        <div class="ocl-wizard-actions">
          <button
            id="onboarding-next"
            class="ocl-wizard-btn primary"
            type="button"
            @click=${this.next}
          >
            Get Started
          </button>
        </div>
      </div>
    `;
  }

  private renderOpenRepoStep() {
    return html`
      <div class="ocl-wizard-step-content">
        <div class="ocl-wizard-icon">📁</div>
        <h2 class="ocl-wizard-heading">Open a Repository</h2>
        <p class="ocl-wizard-subtitle">
          Choose a project folder to get started. Your code stays on your
          machine — always.
        </p>
        <div class="ocl-wizard-actions">
          <button
            id="onboarding-pick-folder"
            class="ocl-wizard-btn primary"
            type="button"
            @click=${this.handlePickFolder}
          >
            📂 Choose Folder
          </button>
          <button
            id="onboarding-skip-folder"
            class="ocl-wizard-btn ghost"
            type="button"
            @click=${this.next}
          >
            Skip, I will do it later
          </button>
        </div>
        <p class="ocl-wizard-tip" style="margin-top: 16px">
          The repository will be scanned locally with Sano Shield. No data
          leaves your machine.
        </p>
      </div>
    `;
  }

  private renderConfigAiStep() {
    return html`
      <div class="ocl-wizard-step-content">
        <div class="ocl-wizard-icon">🔑</div>
        <h2 class="ocl-wizard-heading">Configure AI Provider</h2>
        <p class="ocl-wizard-subtitle">
          Choose your AI provider and enter your API key to start coding with
          AI.
        </p>
        <div style="margin-bottom: 16px">
          <label
            style="display: block; font-size: 13px; color: #d1d5db; margin-bottom: 6px"
          >
            Provider
          </label>
          <select
            id="onboarding-provider"
            style="width: 100%; padding: 10px 12px; background: rgba(139,155,181,0.08); border: 1px solid rgba(139,155,181,0.15); border-radius: 8px; color: #fff; font-size: 14px; outline: none"
          >
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="openai">OpenAI (GPT)</option>
            <option value="ollama">Ollama (Local)</option>
            <option value="lmstudio">LM Studio (Local)</option>
          </select>
        </div>
        <div style="margin-bottom: 24px">
          <label
            style="display: block; font-size: 13px; color: #d1d5db; margin-bottom: 6px"
          >
            API Key
          </label>
          <input
            type="password"
            id="onboarding-api-key"
            placeholder="sk-ant-..."
            style="width: 100%; padding: 10px 12px; background: rgba(139,155,181,0.08); border: 1px solid rgba(139,155,181,0.15); border-radius: 8px; color: #fff; font-size: 14px; outline: none"
          />
        </div>
        <div class="ocl-wizard-actions">
          <button
            id="onboarding-save-key"
            class="ocl-wizard-btn primary"
            type="button"
            @click=${this.handleSaveKey}
          >
            Save &amp; Continue
          </button>
          <button
            id="onboarding-skip-key"
            class="ocl-wizard-btn ghost"
            type="button"
            @click=${this.next}
          >
            Skip, I will configure later
          </button>
        </div>
      </div>
    `;
  }

  private renderFirstPromptStep() {
    return html`
      <div class="ocl-wizard-step-content">
        <div class="ocl-wizard-icon">🎯</div>
        <h2 class="ocl-wizard-heading">Your first prompt is ready!</h2>
        <p class="ocl-wizard-subtitle">
          Try sending this example prompt to ask AI about your project.
        </p>
        <div class="ocl-wizard-prompt-suggestion">
          <p>
            &quot;<strong
              >Explain the architecture of this project and suggest where I
              should start contributing.</strong
            >&quot;
          </p>
        </div>
        <div class="ocl-wizard-actions">
          <button
            id="onboarding-send-prompt"
            class="ocl-wizard-btn primary"
            type="button"
            @click=${this.handleSendPrompt}
          >
            📤 Send example prompt
          </button>
          <button
            id="onboarding-write-own"
            class="ocl-wizard-btn secondary"
            type="button"
            @click=${this.complete}
          >
            ✏️ I will write my own
          </button>
        </div>
      </div>
    `;
  }

  private async handlePickFolder() {
    if (!this.onOpenRepo) return;
    const folder = await this.onOpenRepo();
    if (folder) {
      this.next();
    }
  }

  private async handleSaveKey() {
    const provider =
      (
        this.querySelector<HTMLSelectElement>("#onboarding-provider")
      )?.value ?? "anthropic";
    const key =
      this.querySelector<HTMLInputElement>("#onboarding-api-key")?.value ?? "";
    if (key.trim() && this.onSaveApiKey) {
      try {
        await this.onSaveApiKey(provider, key.trim());
      } catch {
        // Key saving failed silently — proceed anyway
      }
    }
    this.next();
  }

  private handleSendPrompt() {
    const EXAMPLE_PROMPT =
      "Explain the architecture of this project and suggest where I should start contributing.";
    this.onSendPrompt?.(EXAMPLE_PROMPT);
    this.complete();
  }

  private next() {
    if (this.currentStepIndex < STEPS.length - 1) {
      this.currentStepIndex++;
      this.requestUpdate();
    } else {
      this.complete();
    }
  }

  private async complete() {
    try {
      localStorage.setItem("ocl_onboarding_completed", "true");
    } catch {
      // Storage unavailable — proceed
    }
    this.active = false;
    this.currentStepIndex = 0;
    this.dispatchEvent(
      new CustomEvent("onboarding-completed", { bubbles: true, composed: true }),
    );
  }

  private async skip() {
    try {
      localStorage.setItem("ocl_onboarding_completed", "true");
    } catch {
      // Storage unavailable — proceed
    }
    this.active = false;
    this.currentStepIndex = 0;
    this.dispatchEvent(
      new CustomEvent("onboarding-skipped", { bubbles: true, composed: true }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ide-onboarding-wizard": IdeOnboardingWizard;
  }
}
