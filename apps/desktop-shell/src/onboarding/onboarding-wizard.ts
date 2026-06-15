import type { OnboardingService, OnboardingStep, WorkProfile } from "./onboarding.service";
import { WORK_PROFILES, ONBOARDING_STEPS } from "./onboarding.service";

const WIZARD_ID = "ocl-onboarding-wizard";

export type WizardAction = "next" | "prev" | "skip" | "finish" | "close";

export type WizardCallbacks = {
  onProfileSelect: (profile: WorkProfile) => void;
  onAction: (action: WizardAction) => void;
  onStepAction: (step: OnboardingStep, direction: "prev" | "next") => void;
};

function wizardHTML(service: OnboardingService, callbacks: WizardCallbacks): string {
  const state = service.getState();

  return `
    <div id="${WIZARD_ID}" class="ocl-wizard-overlay" role="dialog" aria-label="Onboarding wizard">
      <div class="ocl-wizard-container">
        <div class="ocl-wizard-sidebar">
          <div class="ocl-wizard-logo">Oclushion</div>
          <nav class="ocl-wizard-steps" aria-label="Onboarding steps">
            ${ONBOARDING_STEPS.map((step, i) => {
              const isDone = state.completedSteps.includes(step);
              const isCurrent = state.currentStep === step;
              return `
                <button class="ocl-wizard-step ${isDone ? "done" : ""} ${isCurrent ? "current" : ""}"
                  data-step="${step}" type="button" ${isDone || isCurrent ? "" : "disabled"}>
                  <span class="ocl-wizard-step-num">${isDone ? "✓" : i + 1}</span>
                  <span class="ocl-wizard-step-label">${service.getStepLabel(step)}</span>
                </button>`;
            }).join("")}
          </nav>
          <button class="ocl-wizard-skip" type="button" data-action="skip">Skip onboarding</button>
        </div>
        <div class="ocl-wizard-content">
          ${renderStepContent(service, callbacks)}
        </div>
      </div>
    </div>`;
}

function renderStepContent(service: OnboardingService, callbacks: WizardCallbacks): string {
  const state = service.getState();

  switch (state.currentStep) {
    case "welcome":
      return renderWelcome(state.completedSteps.length > 0);
    case "choose_profile":
      return renderProfileSelection(state.profile, callbacks);
    case "connect_api":
      return renderConnectAPI();
    case "install_skillpack":
      return renderInstallSkillpack(state.profile);
    case "tour_chat":
      return renderTourStep("tour_chat", "AI Chat", "This is where you talk to the AI. Ask questions, request code changes, or just explore your codebase.", "💬");
    case "tour_editor":
      return renderTourStep("tour_editor", "Smart Editor", "Code with AI-powered completions, inline diffs, and real-time suggestions. Open any file and start editing.", "✏️");
    case "tour_agents":
      return renderTourStep("tour_agents", "AI Agents", "Let agents work for you - code review, security audits, documentation, and more. Configure them to run automatically.", "🤖");
    case "open_project":
      return renderOpenProject();
    case "first_prompt":
      return renderFirstPrompt(state.profile);
    case "configure_mcp":
      return renderConfigureMCP();
    case "complete":
      return renderComplete(service, callbacks);
    default:
      return "<p>Loading...</p>";
  }
}

function renderWelcome(hasProgress: boolean): string {
  return `
    <div class="ocl-wizard-step-content welcome">
      <div class="ocl-wizard-icon">👋</div>
      <h1 class="ocl-wizard-heading">Welcome to Oclushion</h1>
      <p class="ocl-wizard-subtitle">The AI-native IDE for real development. Let's get you set up in under 2 minutes.</p>
      <ul class="ocl-wizard-benefits">
        <li>🧠 AI that understands your entire codebase</li>
        <li>🛡️ Built-in security and privacy controls</li>
        <li>🔧 200+ skills for every stack</li>
        <li>🚀 One-click deploy to Vercel, Fly.io, and more</li>
      </ul>
      <div class="ocl-wizard-actions">
        <button class="ocl-wizard-btn primary" type="button" data-action="next">
          ${hasProgress ? "Continue" : "Get Started"}
        </button>
        <button class="ocl-wizard-btn ghost" type="button" data-action="skip">Skip — I know my way around</button>
      </div>
    </div>`;
}

function renderProfileSelection(
  selected: WorkProfile | null,
  callbacks: WizardCallbacks,
): string {
  return `
    <div class="ocl-wizard-step-content profile">
      <h2 class="ocl-wizard-heading">Choose Your Profile</h2>
      <p class="ocl-wizard-subtitle">We'll tailor the experience to your stack. You can change this later.</p>
      <div class="ocl-wizard-profiles">
        ${WORK_PROFILES.map(
          (p) => `
          <button class="ocl-wizard-profile-card ${selected === p.id ? "selected" : ""}"
            type="button" data-profile="${p.id}">
            <span class="ocl-wizard-profile-icon">${p.icon}</span>
            <span class="ocl-wizard-profile-name">${p.label}</span>
            <span class="ocl-wizard-profile-desc">${p.description}</span>
          </button>`,
        ).join("")}
      </div>
      <div class="ocl-wizard-actions">
        <button class="ocl-wizard-btn secondary" type="button" data-action="prev">Back</button>
        <button class="ocl-wizard-btn primary" type="button" data-action="next"
          ${selected ? "" : "disabled"}>Next</button>
      </div>
    </div>`;
}

function renderConnectAPI(): string {
  return `
    <div class="ocl-wizard-step-content api">
      <h2 class="ocl-wizard-heading">Connect Your API Key</h2>
      <p class="ocl-wizard-subtitle">Oclushion uses your own AI provider keys (BYOK). No extra charges.</p>
      <div class="ocl-wizard-api-options">
        <div class="ocl-wizard-api-card">
          <div class="ocl-wizard-api-icon">🤖</div>
          <h3>OpenAI</h3>
          <p>GPT-4o, GPT-4o-mini, o3</p>
          <code>sk-proj-••••••••••</code>
          <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener">Get key →</a>
        </div>
        <div class="ocl-wizard-api-card">
          <div class="ocl-wizard-api-icon">🧠</div>
          <h3>Anthropic</h3>
          <p>Claude Sonnet 4, Opus, Haiku</p>
          <code>sk-ant-••••••••••</code>
          <a href="https://console.anthropic.com/keys" target="_blank" rel="noopener">Get key →</a>
        </div>
      </div>
      <p class="ocl-wizard-tip">💡 You can also configure both and switch between them anytime.</p>
      <div class="ocl-wizard-actions">
        <button class="ocl-wizard-btn secondary" type="button" data-action="prev">Back</button>
        <button class="ocl-wizard-btn primary" type="button" data-action="next">I'll do this later</button>
      </div>
    </div>`;
}

function renderInstallSkillpack(profile: WorkProfile | null): string {
  const packName = profile ? `${profile.charAt(0).toUpperCase() + profile.slice(1)} Skill Pack` : "Recommended Skill Pack";
  return `
    <div class="ocl-wizard-step-content install">
      <h2 class="ocl-wizard-heading">Install Your Skill Pack</h2>
      <p class="ocl-wizard-subtitle">We'll install the ${packName} — optimized prompts and tools for your workflow.</p>
      <div class="ocl-wizard-installing">
        <div class="ocl-wizard-spinner"></div>
        <p>Installing <strong>${packName}</strong>...</p>
        <div class="ocl-wizard-skill-list">
          <div class="ocl-wizard-skill-item done">✓ Code generation prompts</div>
          <div class="ocl-wizard-skill-item done">✓ Project scaffolding</div>
          <div class="ocl-wizard-skill-item">⟳ Stack-specific tools</div>
          <div class="ocl-wizard-skill-item">○ Security best practices</div>
          <div class="ocl-wizard-skill-item">○ Testing templates</div>
        </div>
      </div>
      <div class="ocl-wizard-actions">
        <button class="ocl-wizard-btn primary" type="button" data-action="next">Continue</button>
      </div>
    </div>`;
}

function renderTourStep(_step: OnboardingStep, title: string, description: string, icon: string): string {
  return `
    <div class="ocl-wizard-step-content tour">
      <div class="ocl-wizard-tour-icon">${icon}</div>
      <h2 class="ocl-wizard-heading">${title}</h2>
      <p class="ocl-wizard-subtitle">${description}</p>
      <div class="ocl-wizard-tour-preview">
        <div class="ocl-wizard-tour-placeholder">
          <span>Interactive tour highlight will appear here</span>
        </div>
      </div>
      <div class="ocl-wizard-actions">
        <button class="ocl-wizard-btn secondary" type="button" data-action="prev">Back</button>
        <button class="ocl-wizard-btn primary" type="button" data-action="next">Got it!</button>
      </div>
    </div>`;
}

function renderOpenProject(): string {
  return `
    <div class="ocl-wizard-step-content project">
      <h2 class="ocl-wizard-heading">Open a Project</h2>
      <p class="ocl-wizard-subtitle">Start with a demo project or open your own.</p>
      <div class="ocl-wizard-project-options">
        <button class="ocl-wizard-project-card" type="button">
          <span class="ocl-wizard-project-icon">📂</span>
          <span class="ocl-wizard-project-title">Open Existing Project</span>
          <span class="ocl-wizard-project-desc">Browse your file system</span>
        </button>
        <button class="ocl-wizard-project-card" type="button">
          <span class="ocl-wizard-project-icon">🧪</span>
          <span class="ocl-wizard-project-title">Clone Demo Repo</span>
          <span class="ocl-wizard-project-desc">Next.js + Tailwind starter</span>
        </button>
        <button class="ocl-wizard-project-card" type="button">
          <span class="ocl-wizard-project-icon">✨</span>
          <span class="ocl-wizard-project-title">Create New Project</span>
          <span class="ocl-wizard-project-desc">Guided project setup</span>
        </button>
      </div>
      <div class="ocl-wizard-actions">
        <button class="ocl-wizard-btn secondary" type="button" data-action="prev">Back</button>
        <button class="ocl-wizard-btn primary" type="button" data-action="next">Skip — I'll do this later</button>
      </div>
    </div>`;
}

function renderFirstPrompt(profile: WorkProfile | null): string {
  const suggestions: Record<string, string> = {
    frontend: '"Explain the component structure of this project"',
    backend: '"Show me the API routes and their handlers"',
    fullstack: '"Give me an overview of the full architecture"',
    data: '"What data pipeline does this project use?"',
    security: '"Run a security audit on this project"',
  };
  const suggestion = profile ? suggestions[profile] ?? suggestions.fullstack : suggestions.fullstack;

  return `
    <div class="ocl-wizard-step-content prompt">
      <h2 class="ocl-wizard-heading">Send Your First Prompt</h2>
      <p class="ocl-wizard-subtitle">Try asking the AI something about your project.</p>
      <div class="ocl-wizard-prompt-suggestion">
        <p>💡 Try: <strong>${suggestion}</strong></p>
      </div>
      <div class="ocl-wizard-chat-sim">
        <div class="ocl-wizard-chat-bubble user">
          <span>${suggestion}</span>
        </div>
        <div class="ocl-wizard-chat-bubble ai">
          <span>I can see this is a ${profile ?? "fullstack"} project. Let me analyze the structure...</span>
        </div>
      </div>
      <div class="ocl-wizard-actions">
        <button class="ocl-wizard-btn secondary" type="button" data-action="prev">Back</button>
        <button class="ocl-wizard-btn primary" type="button" data-action="next">Looks good!</button>
      </div>
    </div>`;
}

function renderConfigureMCP(): string {
  return `
    <div class="ocl-wizard-step-content mcp">
      <h2 class="ocl-wizard-heading">Connect External Tools (Optional)</h2>
      <p class="ocl-wizard-subtitle">MCP servers let Oclushion interact with your tools.</p>
      <div class="ocl-wizard-mcp-grid">
        <label class="ocl-wizard-mcp-item">
          <input type="checkbox" /> GitHub — manage PRs, issues, code review
        </label>
        <label class="ocl-wizard-mcp-item">
          <input type="checkbox" /> Linear — manage issues and sprints
        </label>
        <label class="ocl-wizard-mcp-item">
          <input type="checkbox" /> Notion — browse and edit docs
        </label>
        <label class="ocl-wizard-mcp-item">
          <input type="checkbox" /> Slack — search messages, post updates
        </label>
        <label class="ocl-wizard-mcp-item">
          <input type="checkbox" /> Jira — manage tasks and tickets
        </label>
        <label class="ocl-wizard-mcp-item">
          <input type="checkbox" /> Figma — inspect design tokens
        </label>
      </div>
      <div class="ocl-wizard-actions">
        <button class="ocl-wizard-btn secondary" type="button" data-action="prev">Back</button>
        <button class="ocl-wizard-btn primary" type="button" data-action="next">Finish Setup</button>
        <button class="ocl-wizard-btn ghost" type="button" data-action="skip">Skip — do later</button>
      </div>
    </div>`;
}

function renderComplete(service: OnboardingService, _callbacks: WizardCallbacks): string {
  const state = service.getState();
  const profileIcon: Record<string, string> = {
    frontend: "🎨", backend: "⚙️", fullstack: "🚀", data: "📊", security: "🛡️",
  };
  const icon = state.profile ? (profileIcon[state.profile] ?? "🚀") : "🚀";
  const total = ONBOARDING_STEPS.length;
  const done = state.completedSteps.length;

  return `
    <div class="ocl-wizard-step-content complete">
      <div class="ocl-wizard-complete-icon">🎉</div>
      <h2 class="ocl-wizard-heading">Setup Complete!</h2>
      <p class="ocl-wizard-subtitle">Your Oclushion environment is ready.</p>
      <div class="ocl-wizard-complete-stats">
        <div class="ocl-wizard-complete-stat">
          <span>${icon}</span>
          <span>${state.profile ? state.profile.charAt(0).toUpperCase() + state.profile.slice(1) : "Fullstack"}</span>
        </div>
        <div class="ocl-wizard-complete-stat">
          <span>${done}/${total}</span>
          <span>steps</span>
        </div>
      </div>
      <div class="ocl-wizard-actions">
        <button class="ocl-wizard-btn primary" type="button" data-action="close">Start coding →</button>
      </div>
    </div>`;
}

function attachEvents(
  container: HTMLElement,
  service: OnboardingService,
  callbacks: WizardCallbacks,
): void {
  container.querySelectorAll("[data-action]").forEach((el) => {
    el.addEventListener("click", (e) => {
      const action = (e.currentTarget as HTMLElement).getAttribute("data-action") as WizardAction | null;
      const currentStep = service.getState().currentStep;

      if (action === "next") {
        service.completeStep(currentStep);
        const idx = ONBOARDING_STEPS.indexOf(currentStep);
        if (idx >= 0 && idx < ONBOARDING_STEPS.length - 1) {
          service.goToStep(ONBOARDING_STEPS[idx + 1]!);
          callbacks.onStepAction(currentStep, "next");
        } else {
          service.goToStep("complete");
          callbacks.onStepAction(currentStep, "next");
        }
        return;
      }
      if (action === "close") {
        service.complete();
        callbacks.onAction("close");
        return;
      }
      if (action === "prev") {
        const idx = ONBOARDING_STEPS.indexOf(currentStep);
        if (idx > 0) {
          service.goToStep(ONBOARDING_STEPS[idx - 1]!);
          callbacks.onStepAction(currentStep, "prev");
        }
        return;
      }
      if (action === "skip") {
        service.skip();
        callbacks.onAction("skip");
        return;
      }
    });
  });

  container.querySelectorAll("[data-profile]").forEach((el) => {
    el.addEventListener("click", (e) => {
      const profile = (e.currentTarget as HTMLElement).getAttribute("data-profile") as WorkProfile | null;
      if (profile) {
        callbacks.onProfileSelect(profile);
      }
    });
  });
}

export function renderWizard(
  service: OnboardingService,
  callbacks: WizardCallbacks,
): HTMLElement {
  removeWizard();
  const html = wizardHTML(service, callbacks);
  const container = document.createElement("div");
  container.innerHTML = html;
  const wizard = container.firstElementChild as HTMLElement;
  document.body.appendChild(wizard);
  attachEvents(wizard, service, callbacks);
  return wizard;
}

export function refreshWizard(
  service: OnboardingService,
  callbacks: WizardCallbacks,
): void {
  const existing = document.getElementById(WIZARD_ID);
  if (existing) {
    existing.remove();
  }
  if (!service.getState().completed) {
    renderWizard(service, callbacks);
  }
}

export function removeWizard(): void {
  const existing = document.getElementById(WIZARD_ID);
  if (existing) {
    existing.remove();
  }
}
