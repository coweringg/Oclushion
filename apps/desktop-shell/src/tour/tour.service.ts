import { logger } from "../utils/logger.js";
import type { TourConfig, TourStep, TourState } from "./tour.types.js";
import { readTourState, writeTourState, resetTourState } from "./tour.store.js";
import { createTooltip, destroyTooltip, createSpotlight, destroySpotlight, createOverlay, destroyOverlay } from "./tour.renderer.js";

export class TourService {
  private state: TourState;
  private config: TourConfig;
  private currentStepIndex = 0;
  private listeners = new Set<(event: { type: string; stepId?: string }) => void>();

  constructor(config: TourConfig) {
    this.config = config;
    this.state = readTourState(config.id, {
      isActive: false,
      currentStepIndex: 0,
      completed: false,
      skipped: false,
      version: 1,
    });
  }

  isActive(): boolean {
    return this.state.isActive;
  }

  hasCompleted(): boolean {
    return this.state.completed;
  }

  hasSkipped(): boolean {
    return this.state.skipped;
  }

  start(): void {
    if (this.state.completed && !this.config.allowRestart) return;
    if (this.state.isActive) return;

    this.currentStepIndex = 0;
    this.state = { ...this.state, isActive: true, completed: false, skipped: false, lastStartedAt: new Date().toISOString() };
    this.persist();
    createOverlay();
    this.renderStep();
  }

  stop(): void {
    this.state = { ...this.state, isActive: false };
    this.persist();
    this.cleanup();
  }

  skip(): void {
    this.state = { ...this.state, isActive: false, skipped: true };
    this.persist();
    this.cleanup();
    this.emit({ type: "tour:skipped", stepId: this.currentStep()?.id });
  }

  finish(): void {
    this.state = { ...this.state, isActive: false, completed: true, completedAt: new Date().toISOString() };
    this.persist();
    this.cleanup();
    this.emit({ type: "tour:completed", stepId: this.currentStep()?.id });
  }

  goToStep(index: number): void {
    if (index < 0 || index >= this.config.steps.length) return;
    this.currentStepIndex = index;
    this.renderStep();
  }

  next(): void {
    if (this.currentStepIndex < this.config.steps.length - 1) {
      this.currentStepIndex++;
      this.renderStep();
    } else {
      this.finish();
    }
  }

  prev(): void {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      this.renderStep();
    }
  }

  reset(): void {
    resetTourState(this.config.id);
    this.state = { isActive: false, currentStepIndex: 0, completed: false, skipped: false, version: 1 };
    this.currentStepIndex = 0;
    this.cleanup();
  }

  onChange(listener: (event: { type: string; stepId?: string }) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private currentStep(): TourStep | undefined {
    return this.config.steps[this.currentStepIndex];
  }

  private renderStep(): void {
    const step = this.currentStep();
    if (!step) return;

    const target = document.querySelector(step.target) as HTMLElement | null;
    if (target) {
      createSpotlight(target);
    }

    createTooltip(step, this.currentStepIndex, this.config.steps.length, {
      onStepClick: (_stepId, direction) => {
        if (direction === "prev") this.prev();
        else this.next();
      },
      onSkip: () => this.skip(),
      onFinish: () => this.finish(),
    });

    this.emit({ type: "tour:step_shown", stepId: step.id });

    if (step.onShow) {
      try {
        void step.onShow(target || (document.body as HTMLElement));
      } catch (err) {
        logger.warn("TourService", "Step onShow error:", err);
      }
    }
  }

  private cleanup(): void {
    destroyTooltip();
    destroySpotlight();
    destroyOverlay();
  }

  private persist(): void {
    writeTourState(this.config.id, this.state);
  }

  private emit(event: { type: string; stepId?: string }): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
      }
    }
  }
}
