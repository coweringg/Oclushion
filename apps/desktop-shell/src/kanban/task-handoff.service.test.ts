import { describe, expect, it, vi } from "vitest";

import { TaskHandoffService } from "./task-handoff.service";

function createMockKanban() {
  return {
    updateTask: vi.fn().mockImplementation((_id: string, update: Record<string, unknown>) => {
      const base = { id: "t1", title: "Task", description: "Desc", relatedFiles: [] };
      return Promise.resolve({ ...base, ...update });
    }),
  };
}

function createMockOrchestrator() {
  return {
    orchestrate: vi.fn().mockResolvedValue({
      id: "plan-1",
      tasks: [{ proposals: [{ id: "p1", kind: "code", content: "x" }], creditsUsed: 5 }],
    }),
  };
}

describe("TaskHandoffService", () => {
  it("moves task to ai-builder then to review with plan results", async () => {
    const kanban = createMockKanban();
    const orchestrator = createMockOrchestrator();
    const service = new TaskHandoffService(kanban as never, orchestrator as never);

    const task = { id: "t1", title: "Task", description: "Desc", relatedFiles: [] } as never;
    const result = await service.sendToAgents({ task, repositoryContext: {} as never, privacyEnabled: false });

    expect(kanban.updateTask).toHaveBeenCalledTimes(2);
    expect(kanban.updateTask).toHaveBeenCalledWith("t1", { column: "ai-builder", assignedAgent: "builder" });
    expect(kanban.updateTask).toHaveBeenCalledWith("t1", {
      column: "review",
      sessionId: "plan-1",
      proposals: [{ id: "p1", kind: "code", content: "x" }],
      creditsUsed: 5,
    });
    expect(result.column).toBe("review");
  });

  it("passes user request combining title and description", async () => {
    const kanban = createMockKanban();
    const orchestrator = createMockOrchestrator();
    const service = new TaskHandoffService(kanban as never, orchestrator as never);

    const task = { id: "t1", title: "Fix bug", description: "Details here", relatedFiles: [] } as never;
    await service.sendToAgents({ task, repositoryContext: {} as never, privacyEnabled: true });

    expect(orchestrator.orchestrate).toHaveBeenCalledWith(
      expect.objectContaining({ userRequest: "Task\n\nDesc", privacyEnabled: true }),
    );
  });
});
