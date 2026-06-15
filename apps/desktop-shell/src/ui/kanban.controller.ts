import { BaseController, type ControllerContext } from "./controller";

export type KanbanControllerActions = {
  open(): void;
  createTask(): Promise<void>;
  sendToAi(taskId: string): Promise<void>;
};

export class KanbanController extends BaseController {
  public constructor(
    context: ControllerContext,
    private readonly actions: KanbanControllerActions,
  ) {
    super(context);
  }

  public mount(): void {
    this.listen("#kanban-nav-button", "click", () => {
      this.actions.open();
    });
    this.listen("#kanban-new-task-button", "click", () => {
      void this.actions.createTask();
    });
    this.listen("button[data-kanban-ai-task]", "click", (_event, button) => {
      const taskId = button.dataset.kanbanAiTask;
      if (taskId) {
        void this.actions.sendToAi(taskId);
      }
    });
  }
}
