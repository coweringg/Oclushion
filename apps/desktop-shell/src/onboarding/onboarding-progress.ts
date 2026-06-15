import type { OnboardingService } from "./onboarding.service";
import { ONBOARDING_STEPS } from "./onboarding.service";

const PROGRESS_ROOT_ID = "onboarding-progress-root";

function progressStepHTML(
  step: string,
  index: number,
  isDone: boolean,
  isCurrent: boolean,
  label: string,
): string {
  return `
    <div class="onboarding-progress-step ${isDone ? "done" : ""} ${isCurrent ? "current" : ""}" data-step="${step}">
      <span class="onboarding-progress-bullet">${isDone ? "✓" : isCurrent ? "●" : "○"}</span>
      <span class="onboarding-progress-label">${label}</span>
    </div>`;
}

export function renderOnboardingProgress(service: OnboardingService): string {
  const state = service.getState();
  if (state.completed) return "";

  const visibleSteps = ONBOARDING_STEPS.slice(0, 4);
  const completedSet = new Set(state.completedSteps);

  const stepItems = visibleSteps
    .map((step, i) =>
      progressStepHTML(step, i, completedSet.has(step), state.currentStep === step, service.getStepLabel(step)),
    )
    .join("");

  const total = ONBOARDING_STEPS.length;
  const doneCount = state.completedSteps.length;

  return `
    <div id="${PROGRESS_ROOT_ID}" class="onboarding-progress-card">
      <div class="onboarding-progress-header">
        <strong>Getting Started</strong>
        <span class="onboarding-progress-count">${doneCount}/${total}</span>
      </div>
      <div class="onboarding-progress-bar">
        <div class="onboarding-progress-fill" style="width: ${(doneCount / total) * 100}%"></div>
      </div>
      <div class="onboarding-steps-list">
        ${stepItems}
        <div class="onboarding-progress-step more">
          <span class="onboarding-progress-bullet">⋯</span>
          <span class="onboarding-progress-label">${total - visibleSteps.length} more steps</span>
        </div>
      </div>
      <button id="onboarding-resume-btn" class="onboarding-resume-btn" type="button">
        ${state.currentStep === "welcome" ? "Start Tour" : "Continue"}
      </button>
    </div>`;
}

export function attachOnboardingProgressInteractions(
  service: OnboardingService,
  onAction: (action: "resume" | "skip") => void,
): void {
  const btn = document.querySelector<HTMLButtonElement>("#onboarding-resume-btn");
  if (btn) {
    btn.addEventListener("click", () => onAction("resume"));
  }
}

export function refreshOnboardingProgress(service: OnboardingService): void {
  const root = document.querySelector<HTMLElement>(`#${PROGRESS_ROOT_ID}`);
  if (!root) return;
  const parent = root.parentElement;
  if (!parent) return;
  const html = renderOnboardingProgress(service);
  if (html) {
    parent.innerHTML = html;
  }
}

export function autoDetectOnboardingStep(
  service: OnboardingService,
): () => void {
  const unsubs: Array<() => void> = [];

  const handleRepoOpen = () => {
    if (!service.getState().completedSteps.includes("open_project")) {
      service.completeStep("open_project");
    }
  };

  const handleApiConfig = () => {
    if (!service.getState().completedSteps.includes("connect_api")) {
      service.completeStep("connect_api");
    }
  };

  const handleFirstPrompt = () => {
    if (!service.getState().completedSteps.includes("first_prompt")) {
      service.completeStep("first_prompt");
    }
    const state = service.getState();
    const required: string[] = ["open_project", "connect_api", "first_prompt"];
    const allDone = required.every((s) => state.completedSteps.includes(s as any));
    if (allDone) {
      service.complete();
    }
  };

  const repoBtn = document.querySelector<HTMLElement>("#open-repository-button");
  if (repoBtn) {
    repoBtn.addEventListener("click", handleRepoOpen, { once: true });
    unsubs.push(() => repoBtn.removeEventListener("click", handleRepoOpen));
  }

  const apiSaveBtn = document.querySelector<HTMLElement>("#save-byok-button");
  if (apiSaveBtn) {
    apiSaveBtn.addEventListener("click", handleApiConfig, { once: true });
    unsubs.push(() => apiSaveBtn.removeEventListener("click", handleApiConfig));
  }

  const chatSendBtn = document.querySelector<HTMLElement>("#chat-send-button");
  if (chatSendBtn) {
    chatSendBtn.addEventListener("click", handleFirstPrompt, { once: true });
    unsubs.push(() => chatSendBtn.removeEventListener("click", handleFirstPrompt));
  }

  const chatInput = document.querySelector<HTMLElement>("#chat-input");
  if (chatInput) {
    const handleEnter = (e: Event) => {
      if ((e as KeyboardEvent).key === "Enter") {
        handleFirstPrompt();
      }
    };
    chatInput.addEventListener("keydown", handleEnter, { once: true });
    unsubs.push(() => chatInput.removeEventListener("keydown", handleEnter));
  }

  return () => unsubs.forEach((fn) => fn());
}
