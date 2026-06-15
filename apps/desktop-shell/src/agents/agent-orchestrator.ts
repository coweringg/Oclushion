import type { PackedRepositoryContext } from "../context.service";
import { emitTaskCompletedEvent, notifyTaskCompleted, type TaskCompletionPayload } from "../notifications/task-notifier";
import type { SafeDiffProposal } from "../safe-diff.service";
import { AgentRegistry } from "./agent-registry";
import { AgentRunner } from "./agent-runner";
import { FileOwnershipService } from "./file-ownership.service";
import type { AgentRole, AgentTask, AutonomyLevel, OrchestratorPlan, OrchestratorSnapshot } from "./types";
import type { TeamSyncService } from "../multiplayer/team-sync.service";

type OrchestratorListener = (snapshot: OrchestratorSnapshot) => void;

const defaultPipeline: AgentRole[] = ["architect", "builder", "reviewer", "security", "qa", "docs"];

export class AgentOrchestrator {
  private activePlan: OrchestratorPlan | null = null;
  private completedPlan: OrchestratorPlan | null = null;
  private readonly listeners = new Set<OrchestratorListener>();
  private liveTimer: ReturnType<typeof setInterval> | null = null;

  public constructor(
    public readonly registry: AgentRegistry,
    private readonly runner: AgentRunner,
    private readonly ownership: FileOwnershipService,
    private readonly teamSync?: TeamSyncService,
  ) {}

  public async orchestrate(input: {
    userRequest: string;
    repositoryContext: PackedRepositoryContext;
    targetPaths?: string[];
    privacyEnabled: boolean;
    autonomyLevel?: AutonomyLevel;
    onProposals?: (proposals: SafeDiffProposal[]) => void;
  }): Promise<OrchestratorPlan> {
    if (this.activePlan) {
      throw new Error("Only one multi-agent session can run at a time.");
    }
    const plan = this.createPlan(input.userRequest, input.repositoryContext, input.targetPaths ?? [], input.autonomyLevel ?? "copilot");
    this.activePlan = plan;
    this.startLiveTimer();
    this.emit();
    try {
      const tasks =
        plan.executionMode === "parallel"
          ? await this.executeParallel(plan.tasks, input.repositoryContext, input.privacyEnabled)
          : await this.executeSequential(plan.tasks, input.repositoryContext, input.privacyEnabled);
      plan.tasks = tasks;
      this.completedPlan = plan;
      input.onProposals?.(tasks.flatMap((task) => task.proposals));
      const payload = createTaskCompletionPayload(plan, tasks);
      emitTaskCompletedEvent(payload);
      await notifyTaskCompleted(payload);
      this.emit();
      return plan;
    } finally {
      this.ownership.releaseSession(plan.id);
      this.activePlan = null;
      this.stopLiveTimer();
      this.emit();
    }
  }

  public enableAgiMode(): void {
  }

  public disableAgiMode(): void {
  }

  public cancel(sessionId: string): void {
    if (this.activePlan?.id === sessionId) {
      this.activePlan.tasks = this.activePlan.tasks.map((task) =>
        task.status === "running" || task.status === "pending" ? { ...task, status: "cancelled" } : task,
      );
      this.ownership.releaseSession(sessionId);
      this.activePlan = null;
      this.stopLiveTimer();
      this.emit();
    }
  }

  public rewindTo(taskId: string, newInstruction?: string): void {
    const plan = this.activePlan ?? this.completedPlan;
    if (!plan) return;

    const taskIndex = plan.tasks.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) return;

    plan.tasks = plan.tasks.map((task, index) => {
      if (index > taskIndex && (task.status === "running" || task.status === "pending" || task.status === "completed")) {
        return { ...task, status: "cancelled" };
      }
      return task;
    });

    if (newInstruction) {
      const newRole = "architect"; // Default to architect for the fork
      const newTaskId = `${plan.id}-fork-${Date.now()}`;
      plan.tasks.push({
        id: newTaskId,
        sessionId: plan.id,
        agentRole: newRole,
        title: `Fork: ${newInstruction.slice(0, 80)}`,
        input: newInstruction,
        context: `Rewound from ${taskId}`,
        targetPaths: [],
        status: "pending",
        autonomyLevel: plan.autonomyLevel,
        proposals: [],
        creditsUsed: 0,
      });
    }

    if (this.completedPlan) {
      this.activePlan = this.completedPlan;
      this.completedPlan = null;
    }

    this.emit();
  }

  public snapshot(): OrchestratorSnapshot {
    const plan = this.activePlan ?? this.completedPlan;
    const tasks = plan?.tasks ?? [];
    return {
      activePlan: this.activePlan,
      tasks,
      locks: this.ownership.getSnapshot(),
      totalCreditsUsed: tasks.reduce((sum, task) => sum + task.creditsUsed, 0),
    };
  }

  public subscribe(listener: OrchestratorListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  private createPlan(
    userRequest: string,
    repositoryContext: PackedRepositoryContext,
    targetPaths: string[],
    autonomyLevel: AutonomyLevel,
  ): OrchestratorPlan {
    const critical = /(auth|billing|stripe|security|secret|permission|migration)/iu.test(userRequest);
    const forceSequential = autonomyLevel === "agi";
    const roles = critical ? defaultPipeline : (["architect", "builder", "qa", "reviewer", "docs"] as AgentRole[]);
    const sessionId = `agent-session-${Date.now()}`;
    return {
      id: sessionId,
      userRequest,
      executionMode: (critical || forceSequential) ? "sequential" : "parallel",
      autonomyLevel,
      createdAt: new Date().toISOString(),
      tasks: roles.map((role, index) => ({
        id: `${sessionId}-${role}`,
        sessionId,
        agentRole: role,
        title: `${this.registry.get(role).name}: ${userRequest.slice(0, 80)}`,
        input: userRequest,
        context: `Packed ${repositoryContext.files.length} files / ${repositoryContext.usedTokens} tokens`,
        targetPaths: targetPaths.length ? targetPaths : defaultPathsForRole(role),
        status: "pending",
        autonomyLevel,
        proposals: [],
        creditsUsed: 0,
      })),
    };
  }

  private async executeSequential(
    tasks: AgentTask[],
    repositoryContext: PackedRepositoryContext,
    privacyEnabled: boolean,
  ): Promise<AgentTask[]> {
    const completed: AgentTask[] = [];
    for (const task of tasks) {
      completed.push(await this.executeTask(task, repositoryContext, privacyEnabled));
      this.activePlan = this.activePlan ? { ...this.activePlan, tasks: [...completed, ...tasks.slice(completed.length)] } : null;
      this.emit();
    }
    return completed;
  }

  private async executeParallel(
    tasks: AgentTask[],
    repositoryContext: PackedRepositoryContext,
    privacyEnabled: boolean,
  ): Promise<AgentTask[]> {
    const results: AgentTask[] = [];
    for (let index = 0; index < tasks.length; index += 3) {
      const batch = tasks.slice(index, index + 3);
      const settled = await Promise.allSettled(
        batch.map((task) => this.executeTask(task, repositoryContext, privacyEnabled)),
      );
      results.push(
        ...settled.map((result, resultIndex) =>
          result.status === "fulfilled"
            ? result.value
            : {
                ...batch[resultIndex]!,
                status: "failed" as const,
                error: result.reason instanceof Error ? result.reason.message : "Agent failed.",
                completedAt: new Date().toISOString(),
              },
        ),
      );
      this.activePlan = this.activePlan ? { ...this.activePlan, tasks: [...results, ...tasks.slice(results.length)] } : null;
      this.emit();
    }
    return results;
  }

  private async executeTask(
    task: AgentTask,
    repositoryContext: PackedRepositoryContext,
    privacyEnabled: boolean,
  ): Promise<AgentTask> {
    const agent = this.registry.get(task.agentRole);
    if (!this.ownership.acquire(task.targetPaths, task.agentRole, task.sessionId)) {
      return { ...task, status: "failed", error: "File ownership conflict or protected path." };
    }

    const conflict = this.teamSync?.announceIntent(
      agent.id,
      agent.name,
      task.targetPaths,
      task.input.slice(0, 200),
    );
    if (conflict && conflict.severity === "critical") {
      this.ownership.release(task.agentRole, task.sessionId);
      return {
        ...task,
        status: "failed",
        error: `Critical conflict detected on ${conflict.conflictingFiles.join(", ")}. Another agent is modifying these files. Wait for resolution.`,
      };
    }

    const running = { ...task, status: "running" as const, startedAt: new Date().toISOString() };
    this.updateTask(running);
    this.emit();
    try {
      const result = await this.runner.run({ agent, task: running, repositoryContext, privacyEnabled });

      this.teamSync?.completeIntent(agent.id, agent.name, task.targetPaths);

      return result;
    } finally {
      this.ownership.release(task.agentRole, task.sessionId);
    }
  }

  private updateTask(task: AgentTask): void {
    if (!this.activePlan) {
      return;
    }
    this.activePlan = {
      ...this.activePlan,
      tasks: this.activePlan.tasks.map((candidate) => (candidate.id === task.id ? task : candidate)),
    };
  }

  private startLiveTimer(): void {
    if (this.liveTimer) {
      return;
    }
    this.liveTimer = setInterval(() => {
      if (!this.activePlan) {
        this.stopLiveTimer();
        return;
      }
      const now = Date.now();
      this.activePlan = {
        ...this.activePlan,
        tasks: this.activePlan.tasks.map((task) =>
          task.status === "running" && task.startedAt
            ? { ...task, elapsedMs: Math.max(0, now - new Date(task.startedAt).getTime()) }
            : task,
        ),
      };
      this.emit();
    }, 1_000);
  }

  private stopLiveTimer(): void {
    if (!this.liveTimer) {
      return;
    }
    clearInterval(this.liveTimer);
    this.liveTimer = null;
  }

  private emit(): void {
    const snapshot = this.snapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

function createTaskCompletionPayload(plan: OrchestratorPlan, tasks: AgentTask[]): TaskCompletionPayload {
  const failed = tasks.filter((task) => task.status === "failed" || task.status === "cancelled").length;
  const completed = tasks.filter((task) => task.status === "completed").length;
  const status: TaskCompletionPayload["status"] =
    failed === 0 ? "success" : completed > 0 ? "partial" : "error";
  return {
    taskTitle: plan.userRequest.slice(0, 96),
    agentRole: plan.executionMode === "sequential" ? "Sequential Agent Pipeline" : "Parallel Agent Pipeline",
    durationSeconds: Math.max(0, (Date.now() - new Date(plan.createdAt).getTime()) / 1000),
    status,
  };
}

function defaultPathsForRole(role: AgentRole): string[] {
  if (role === "qa") {
    return ["***.test.ts"];
  }
  if (role === "docs" || role === "architect") {
    return ["docs*.md"];
  }
  return [`agent-zones/${role}/*`];
}