import type { ProjectMemoryService } from "../memory/project-memory.service";
import type { AgentTask, OrchestratorPlan } from "./types";
import { logger } from "../utils/logger";

import type { HiveMemoryService } from "../memory/hive-memory.service";

export type LessonEntry = {
  taskId: string;
  agentRole: string;
  targetPaths: string[];
  outcome: "success" | "failure";
  lesson: string;
  createdAt: string;
};

export class SelfImprovingService {
  private lessons: LessonEntry[] = [];
  public currentProjectName: string = "current-project";

  public constructor(
    private readonly memoryService: ProjectMemoryService,
    private readonly hiveMemory: HiveMemoryService,
  ) {}

  public async evaluateCompletedPlan(plan: OrchestratorPlan): Promise<LessonEntry[]> {
    const newLessons: LessonEntry[] = [];

    for (const task of plan.tasks) {
      if (task.status === "completed") {
        const lesson = this.extractSuccessLesson(task);
        if (lesson) {
          newLessons.push(lesson);
          await this.persistLesson(lesson);
        }
      }

      if (task.status === "failed" && task.error) {
        const lesson = this.extractFailureLesson(task);
        newLessons.push(lesson);
        await this.persistLesson(lesson);
      }
    }

    this.lessons.push(...newLessons);
    logger.info("SelfImproving", `Extracted ${newLessons.length} lessons from plan: ${plan.id}`);
    return newLessons;
  }

  public async getRelevantLessons(targetPaths: string[], agentRole: string): Promise<string[]> {
    const results = await this.memoryService.search(`lesson ${agentRole} ${targetPaths.join(" ")}`);
    return results
      .filter(entry => entry.type === "lesson")
      .slice(0, 5)
      .map(entry => entry.content);
  }

  public getLocalLessons(): LessonEntry[] {
    return [...this.lessons];
  }

  private extractSuccessLesson(task: AgentTask): LessonEntry | null {
    if (!task.output || task.output.length < 20) {
      return null;
    }

    const pathSummary = task.targetPaths.slice(0, 3).join(", ");
    const content = `[${task.agentRole}] successfully modified ${pathSummary}. Approach: ${task.input.slice(0, 150)}`;

    return {
      taskId: task.id,
      agentRole: task.agentRole,
      targetPaths: task.targetPaths,
      outcome: "success",
      lesson: content,
      createdAt: new Date().toISOString(),
    };
  }

  private extractFailureLesson(task: AgentTask): LessonEntry {
    const pathSummary = task.targetPaths.slice(0, 3).join(", ");
    const errorSnippet = (task.error ?? "unknown error").slice(0, 200);
    const content = `[${task.agentRole}] failed on ${pathSummary}. Error: ${errorSnippet}. Avoid this pattern next time.`;

    return {
      taskId: task.id,
      agentRole: task.agentRole,
      targetPaths: task.targetPaths,
      outcome: "failure",
      lesson: content,
      createdAt: new Date().toISOString(),
    };
  }

  private async persistLesson(lesson: LessonEntry): Promise<void> {
    const confidence = lesson.outcome === "failure" ? 0.95 : 0.75;
    
    await this.memoryService.add({
      type: "lesson",
      content: lesson.lesson,
      tags: ["self-improving", lesson.agentRole, lesson.outcome, ...lesson.targetPaths.slice(0, 3)],
      source: "agent",
      confidence,
    });

    if (confidence > 0.8) {
      this.hiveMemory.publish({
        sourceProject: this.currentProjectName,
        author: `@agent.${lesson.agentRole}`,
        keywords: lesson.targetPaths.map(p => p.split("/").pop() || p),
        lesson: lesson.lesson,
      });
    }
  }
}
