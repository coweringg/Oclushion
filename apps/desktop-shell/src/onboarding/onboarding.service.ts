import { logger } from "../utils/logger";
import { z } from "zod";

const ONBOARDING_KEY = "ocl_onboarding_v2";

export type WorkProfile = "frontend" | "backend" | "fullstack" | "data" | "security";

export const WORK_PROFILES: { id: WorkProfile; label: string; description: string; icon: string }[] = [
  { id: "frontend", label: "Frontend", description: "React, Next.js, Tailwind, animations", icon: "🎨" },
  { id: "backend", label: "Backend", description: "Node.js, APIs, databases, microservices", icon: "⚙️" },
  { id: "fullstack", label: "Fullstack", description: "Everything frontend + backend", icon: "🚀" },
  { id: "data", label: "Data", description: "Python, SQL, ETL, notebooks, ML", icon: "📊" },
  { id: "security", label: "Security", description: "Audit, pentesting, compliance, OWASP", icon: "🛡️" },
];

export type OnboardingStep =
  | "welcome"
  | "choose_profile"
  | "connect_api"
  | "install_skillpack"
  | "tour_chat"
  | "tour_editor"
  | "tour_agents"
  | "open_project"
  | "first_prompt"
  | "configure_mcp"
  | "complete";

export const ONBOARDING_STEPS: OnboardingStep[] = [
  "welcome",
  "choose_profile",
  "connect_api",
  "install_skillpack",
  "tour_chat",
  "tour_editor",
  "tour_agents",
  "open_project",
  "first_prompt",
  "configure_mcp",
  "complete",
];

export type OnboardingState = {
  completed: boolean;
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  profile: WorkProfile | null;
  startedAt: string | null;
  completedAt: string | null;
};

export type OnboardingEvent =
  | { type: "onboarding:started" }
  | { type: "onboarding:step_completed"; step: OnboardingStep }
  | { type: "onboarding:completed" }
  | { type: "onboarding:skipped" }
  | { type: "onboarding:profile_selected"; profile: WorkProfile };

export type OnboardingListener = (event: OnboardingEvent) => void;

export class OnboardingService {
  private state: OnboardingState = {
    completed: false,
    currentStep: "welcome",
    completedSteps: [],
    profile: null,
    startedAt: null,
    completedAt: null,
  };
  private listeners = new Set<OnboardingListener>();

  constructor() {
    this.load();
  }

  isComplete(): boolean {
    return this.state.completed;
  }

  getState(): OnboardingState {
    return { ...this.state, completedSteps: [...this.state.completedSteps] };
  }

  shouldShow(): boolean {
    return !this.state.completed;
  }

  getProfile(): WorkProfile | null {
    return this.state.profile;
  }

  setProfile(profile: WorkProfile): void {
    this.state.profile = profile;
    this.emit({ type: "onboarding:profile_selected", profile });
  }

  start(): void {
    this.state.currentStep = "welcome";
    this.state.startedAt = new Date().toISOString();
    this.save();
    this.emit({ type: "onboarding:started" });
  }

  goToStep(step: OnboardingStep): void {
    this.state.currentStep = step;
  }

  completeStep(step: OnboardingStep): void {
    if (!this.state.completedSteps.includes(step)) {
      this.state.completedSteps.push(step);
    }
    this.emit({ type: "onboarding:step_completed", step });
  }

  complete(): void {
    this.state.completed = true;
    this.state.currentStep = "complete";
    this.state.completedAt = new Date().toISOString();
    this.save();
    this.emit({ type: "onboarding:completed" });
  }

  skip(): void {
    this.state.completed = true;
    this.state.currentStep = "complete";
    this.state.completedAt = new Date().toISOString();
    this.save();
    this.emit({ type: "onboarding:skipped" });
  }

  getProgress(): { current: number; total: number } {
    if (this.state.completed) return { current: ONBOARDING_STEPS.length, total: ONBOARDING_STEPS.length };
    const currentIndex = ONBOARDING_STEPS.indexOf(this.state.currentStep);
    return { current: Math.max(0, currentIndex) + 1, total: ONBOARDING_STEPS.length };
  }

  getStepLabel(step: OnboardingStep): string {
    const labels: Record<OnboardingStep, string> = {
      welcome: "Welcome",
      choose_profile: "Choose Your Profile",
      connect_api: "Connect API",
      install_skillpack: "Install Skill Pack",
      tour_chat: "Tour: AI Chat",
      tour_editor: "Tour: Editor",
      tour_agents: "Tour: Agents",
      open_project: "Open Project",
      first_prompt: "First Prompt",
      configure_mcp: "Configure MCP (Optional)",
      complete: "Complete",
    };
    return labels[step];
  }

  subscribe(listener: OnboardingListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  destroy(): void {
    this.listeners.clear();
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(ONBOARDING_KEY);
      if (!raw) return;
      const parsed = z.record(z.string(), z.unknown()).safeParse(JSON.parse(raw));
      if (!parsed.success) return;
      const saved = parsed.data as Partial<OnboardingState>;
      if (saved.completed) {
        this.state.completed = true;
        this.state.currentStep = "complete";
        this.state.completedAt = saved.completedAt ?? null;
      }
      if (saved.profile) {
        this.state.profile = saved.profile;
      }
    } catch (error) {
      logger.debug("Onboarding", "Failed to load state", error);
    }
  }

  private save(): void {
    try {
      localStorage.setItem(
        ONBOARDING_KEY,
        JSON.stringify({
          completed: this.state.completed,
          profile: this.state.profile,
          completedAt: this.state.completedAt,
        }),
      );
    } catch (error) {
      logger.debug("Onboarding", "localStorage not available", error);
    }
  }

  private emit(event: OnboardingEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
