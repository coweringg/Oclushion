import type {
  InstallationTask,
  InstallationProgress,
  InstallationStep,
  InstallationTaskStatus,
} from "./marketplace.types";

type ProgressListener = (progress: InstallationProgress | null) => void;

const STEP_ORDER: InstallationStep[] = ["downloading", "verifying", "writing", "activating"];

const STEP_WEIGHTS: Record<InstallationStep, number> = {
  downloading: 40,
  verifying: 20,
  writing: 30,
  activating: 10,
};

export class InstallationProgressService {
  private current: InstallationProgress | null = null;
  private listeners = new Set<ProgressListener>();
  private abortController: AbortController | null = null;

  public subscribe(listener: ProgressListener): () => void {
    this.listeners.add(listener);
    listener(this.current);
    return () => this.listeners.delete(listener);
  }

  public getSnapshot(): InstallationProgress | null {
    return this.current;
  }

  public isInstalling(): boolean {
    return this.current !== null && this.current.status === "installing";
  }

  public startBatch(title: string, skills: Array<{ id: string; name: string; version: string }>): string {
    const id = `install_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.abortController = new AbortController();

    this.current = {
      id,
      title,
      tasks: skills.map((skill) => ({
        id: skill.id,
        name: skill.name,
        version: skill.version,
        step: "downloading",
        status: "pending",
        progress: 0,
      })),
      totalProgress: 0,
      status: "installing",
      startedAt: new Date().toISOString(),
    };

    this.emit();
    return id;
  }

  public updateTask(
    taskId: string,
    step: InstallationStep,
    status: InstallationTaskStatus,
    progress?: number,
    error?: string,
  ): void {
    if (!this.current || this.current.status !== "installing") return;

    const task = this.current.tasks.find((t) => t.id === taskId);
    if (!task) return;

    task.step = step;
    task.status = status;
    if (progress !== undefined) {
      task.progress = progress;
    }
    if (error !== undefined) {
      task.error = error;
    }

    this.current.totalProgress = this.calculateTotalProgress();
    this.emit();
  }

  public completeBatch(success: boolean): void {
    if (!this.current) return;

    this.current.status = success ? "completed" : "failed";
    this.current.completedAt = new Date().toISOString();
    this.current.totalProgress = success ? 100 : this.current.totalProgress;

    if (success) {
      for (const task of this.current.tasks) {
        if (task.status !== "failed") {
          task.status = "completed";
          task.progress = 100;
        }
      }
    }

    this.emit();

    setTimeout(() => {
      this.current = null;
      this.abortController = null;
      this.emit();
    }, 2000);
  }

  public cancel(): void {
    if (!this.current || this.current.status !== "installing") return;

    this.abortController?.abort();
    this.current.status = "cancelled";

    for (const task of this.current.tasks) {
      if (task.status === "pending" || task.status === "active") {
        task.status = "cancelled";
      }
    }

    this.emit();

    setTimeout(() => {
      this.current = null;
      this.abortController = null;
      this.emit();
    }, 1000);
  }

  public getAbortSignal(): AbortSignal | null {
    return this.abortController?.signal ?? null;
  }

  private calculateTotalProgress(): number {
    if (!this.current) return 0;

    let totalWeight = 0;
    let completedWeight = 0;

    for (const task of this.current.tasks) {
      const stepIndex = STEP_ORDER.indexOf(task.step);
      const previousStepsWeight = STEP_ORDER.slice(0, stepIndex).reduce(
        (sum, s) => sum + STEP_WEIGHTS[s],
        0,
      );
      const currentStepWeight = STEP_WEIGHTS[task.step] * (task.progress / 100);
      completedWeight += previousStepsWeight + currentStepWeight;
      totalWeight += 100;
    }

    return totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
  }

  private emit(): void {
    this.listeners.forEach((l) => l(this.current));
  }
}
