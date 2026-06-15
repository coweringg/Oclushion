import type { AgentOrchestrator } from "../agents/agent-orchestrator";
import type { PackedRepositoryContext } from "../context.service";
import type { KanbanService } from "./kanban.service";
import type { KanbanTask } from "./kanban.types";

export class TaskHandoffService {
  public constructor(
    private readonly kanban: KanbanService,
    private readonly orchestrator: AgentOrchestrator,
  ) {}

  public async sendToAgents(input: {
    task: KanbanTask;
    repositoryContext: PackedRepositoryContext;
    privacyEnabled: boolean;
  }): Promise<KanbanTask> {
    const aiTask = await this.kanban.updateTask(input.task.id, {
      column: "ai-builder",
      assignedAgent: "builder",
    });
    const plan = await this.orchestrator.orchestrate({
      userRequest: `${aiTask.title}\n\n${aiTask.description}`,
      repositoryContext: input.repositoryContext,
      targetPaths: aiTask.relatedFiles,
      privacyEnabled: input.privacyEnabled,
    });
    return this.kanban.updateTask(aiTask.id, {
      column: "review",
      sessionId: plan.id,
      proposals: plan.tasks.flatMap((task) => task.proposals),
      creditsUsed: plan.tasks.reduce((sum, task) => sum + task.creditsUsed, 0),
    });
  }
}
