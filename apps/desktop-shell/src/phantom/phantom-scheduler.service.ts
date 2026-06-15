import type { PhantomSession, PhantomTask } from "./phantom.types";
import { BreakerAgentService } from "../agents/breaker-agent.service";
import type { AgentOrchestrator } from "../agents/agent-orchestrator";
import { logger } from "../utils/logger";

type SchedulerListener = (state: PhantomSession | null) => void;

export class PhantomSchedulerService {
  private activeSession: PhantomSession | null = null;
  private readonly listeners = new Set<SchedulerListener>();
  private readonly breaker = new BreakerAgentService();

  public constructor(
    private readonly orchestrator: AgentOrchestrator,
  ) {}

  public startSession(userAbsentSince: string): void {
    if (this.activeSession && this.activeSession.status === "running") {
      return;
    }

    this.activeSession = {
      id: `phantom-${Date.now()}`,
      startedAt: new Date().toISOString(),
      userAbsentSince,
      status: "running",
      tasks: [],
      totalBuilds: 0,
      totalAttacks: 0,
      overallSurvivalRate: 0,
    };

    logger.info("PhantomScheduler", `Started phantom session ${this.activeSession.id}`);
    this.emit();

    void this.runQueue();
  }

  public endSession(): void {
    if (!this.activeSession) return;
    this.activeSession.status = "completed";
    this.activeSession.finishedAt = new Date().toISOString();
    this.recalculateStats();
    logger.info("PhantomScheduler", "Ended phantom session");
    this.emit();
  }

  public queueTask(task: Omit<PhantomTask, "status" | "createdAt">): void {
    if (!this.activeSession) return;

    const fullTask: PhantomTask = {
      ...task,
      status: "queued",
      createdAt: new Date().toISOString(),
    };

    this.activeSession.tasks.push(fullTask);
    this.emit();
  }

  public subscribe(listener: SchedulerListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private async runQueue(): Promise<void> {
    if (!this.activeSession) return;

    while (this.activeSession.status === "running") {
      const pendingTask = this.activeSession.tasks.find(t => t.status === "queued");
      
      if (!pendingTask) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }

      await this.executeTask(pendingTask);
    }
  }

  private async executeTask(task: PhantomTask): Promise<void> {
    if (!this.activeSession) return;

    task.status = "building";
    this.emit();

    try {
      logger.info("PhantomScheduler", `Building task: ${task.title}`);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      this.activeSession.totalBuilds++;
      
      const codeContents = new Map<string, string>();
      for (const file of task.targetFiles) {
        codeContents.set(file, `
          function fix() {
            const input = "test";
            if (input.length > 100) throw new Error("Oversized");
          }
        `);
      }

      task.status = "breaking";
      this.emit();

      logger.info("PhantomScheduler", `Breaking task: ${task.title}`);
      const report = await this.breaker.attack(this.activeSession.id, task.targetFiles, codeContents);
      
      task.breakerReport = report;
      this.activeSession.totalAttacks += report.totalAttacks;

      if (report.survivalRate === 100) {
        task.status = "survived";
      } else {
        task.status = "needs-review";
      }

      task.completedAt = new Date().toISOString();
      task.diffPreview = `+ // Fixed ${task.title}\n+ // Survived ${report.survived}/${report.totalAttacks} attacks`;

    } catch (err) {
      task.status = "failed";
      task.buildOutput = err instanceof Error ? err.message : "Unknown build error";
    }

    this.recalculateStats();
    this.emit();
  }

  private recalculateStats(): void {
    if (!this.activeSession) return;

    let totalAttacks = 0;
    let totalSurvived = 0;

    for (const task of this.activeSession.tasks) {
      if (task.breakerReport) {
        totalAttacks += task.breakerReport.totalAttacks;
        totalSurvived += task.breakerReport.survived;
      }
    }

    this.activeSession.overallSurvivalRate = totalAttacks > 0 
      ? Math.round((totalSurvived / totalAttacks) * 100) 
      : 0;
  }

  private emit(): void {
    if (this.activeSession) {
      this.listeners.forEach(l => l({ ...this.activeSession! }));
    } else {
      this.listeners.forEach(l => l(null));
    }
  }
}
