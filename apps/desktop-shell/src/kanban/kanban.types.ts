import type { AgentRole } from "../agents/types";
import type { SafeDiffProposal } from "../safe-diff.service";

export type KanbanColumn = "todo" | "in-progress" | "ai-builder" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "critical";

export type KanbanTask = {
  id: string;
  title: string;
  description: string;
  column: KanbanColumn;
  priority: TaskPriority;
  assignedAgent?: AgentRole;
  sessionId?: string;
  relatedFiles: string[];
  proposals: SafeDiffProposal[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  creditsUsed: number;
};

export const kanbanColumns: Array<{ id: KanbanColumn; title: string }> = [
  { id: "todo", title: "Todo" },
  { id: "in-progress", title: "In Progress" },
  { id: "ai-builder", title: "AI Builder" },
  { id: "review", title: "Review" },
  { id: "done", title: "Done" },
];
