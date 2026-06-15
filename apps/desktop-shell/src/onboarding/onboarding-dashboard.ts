import type { OnboardingService } from "./onboarding.service";
import { ONBOARDING_STEPS, WORK_PROFILES } from "./onboarding.service";

const DASHBOARD_ID = "ocl-onboarding-dashboard";

function getProfileLabel(profile: string | null): string {
  if (!profile) return "General";
  const found = WORK_PROFILES.find((p) => p.id === profile);
  return found ? found.label : profile;
}

function getProfileIcon(profile: string | null): string {
  if (!profile) return "🚀";
  const found = WORK_PROFILES.find((p) => p.id === profile);
  return found ? found.icon : "🚀";
}

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt || !completedAt) return "< 1 min";
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "< 1 min";
  if (mins === 1) return "1 min";
  return `${mins} mins`;
}

const NEXT_STEPS = [
  { icon: "📂", title: "Open a project", desc: "Browse your files or clone a repo to get started" },
  { icon: "💬", title: "Chat with AI", desc: "Ask questions about your codebase" },
  { icon: "🧩", title: "Install skills", desc: "Browse the marketplace for more capabilities" },
  { icon: "⚙️", title: "Configure providers", desc: "Add API keys for OpenAI, Anthropic, or local models" },
];

export function showOnboardingDashboard(service: OnboardingService): void {
  const existing = document.getElementById(DASHBOARD_ID);
  if (existing) existing.remove();

  const state = service.getState();
  const profileLabel = getProfileLabel(state.profile);
  const profileIcon = getProfileIcon(state.profile);
  const duration = formatDuration(state.startedAt, state.completedAt);
  const totalSteps = ONBOARDING_STEPS.length;
  const completedSteps = state.completedSteps.length;

  const el = document.createElement("div");
  el.id = DASHBOARD_ID;
  el.className = "ocl-dashboard-overlay";
  el.innerHTML = `
    <div class="ocl-dashboard" role="dialog" aria-label="Setup complete">
      <div class="ocl-dashboard-header">
        <div class="ocl-dashboard-icon">🎉</div>
        <h1 class="ocl-dashboard-title">You're all set!</h1>
        <p class="ocl-dashboard-subtitle">Your Oclushion environment is ready to go.</p>
      </div>
      <div class="ocl-dashboard-stats">
        <div class="ocl-dashboard-stat">
          <span class="ocl-dashboard-stat-value">${profileIcon} ${profileLabel}</span>
          <span class="ocl-dashboard-stat-label">Profile</span>
        </div>
        <div class="ocl-dashboard-stat">
          <span class="ocl-dashboard-stat-value">${completedSteps}/${totalSteps}</span>
          <span class="ocl-dashboard-stat-label">Steps completed</span>
        </div>
        <div class="ocl-dashboard-stat">
          <span class="ocl-dashboard-stat-value">${duration}</span>
          <span class="ocl-dashboard-stat-label">Time to setup</span>
        </div>
      </div>
      <div class="ocl-dashboard-nextsteps">
        <h3>Next steps</h3>
        <div class="ocl-dashboard-grid">
          ${NEXT_STEPS.map((s) => `
            <div class="ocl-dashboard-card">
              <span class="ocl-dashboard-card-icon">${s.icon}</span>
              <strong>${s.title}</strong>
              <span class="ocl-dashboard-card-desc">${s.desc}</span>
            </div>
          `).join("")}
        </div>
      </div>
      <button class="ocl-dashboard-btn" type="button" id="ocl-dashboard-close">Get started →</button>
    </div>
  `;

  document.body.appendChild(el);

  el.querySelector("#ocl-dashboard-close")?.addEventListener("click", () => {
    el.remove();
  });

  el.addEventListener("click", (e) => {
    if (e.target === el) el.remove();
  });
}
