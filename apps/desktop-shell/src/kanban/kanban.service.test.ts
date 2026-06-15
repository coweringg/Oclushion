import { describe, expect, it } from "vitest";

import { MemoryKeyValueStore } from "../persistent-store";
import { KanbanService } from "./kanban.service";

describe("KanbanService", () => {
  it("persists tasks and supports the AI Builder workflow column", async () => {
    const store = new MemoryKeyValueStore();
    const service = await KanbanService.create(store);

    const task = await service.createTask({
      title: "Harden auth",
      description: "Route through agents",
      priority: "high",
      relatedFiles: ["src/auth.ts"],
    });
    await service.moveTask(task.id, "ai-builder");

    const restored = await KanbanService.create(store);
    expect(restored.list()).toMatchObject([
      {
        id: task.id,
        title: "Harden auth",
        column: "ai-builder",
        priority: "high",
      },
    ]);
  });
});
