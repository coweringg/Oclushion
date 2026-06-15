import type { KeyValueStore } from "../persistent-store";
import { logger } from "../utils/logger";
import { z } from "zod";
import type { KanbanColumn, KanbanTask, TaskPriority } from "./kanban.types";

type KanbanListener = (tasks: KanbanTask[]) => void;

const kanbanStorageKey = "oclushion.v2.kanban.tasks";

export class KanbanService {
  private tasks: KanbanTask[] = [];
  private readonly listeners = new Set<KanbanListener>();

  private constructor(private readonly store: KeyValueStore) {}

  public static async create(store: KeyValueStore): Promise<KanbanService> {
    const service = new KanbanService(store);
    await service.load();
    return service;
  }

  public list(): KanbanTask[] {
    return [...this.tasks].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  public async createTask(input: {
    title: string;
    description?: string;
    priority?: TaskPriority;
    relatedFiles?: string[];
  }): Promise<KanbanTask> {
    const now = new Date().toISOString();
    const task: KanbanTask = {
      id: `task-${Date.now()}-${crypto.getRandomValues(new Uint32Array(1))[0]}`,
      title: input.title,
      description: input.description ?? "",
      priority: input.priority ?? "medium",
      relatedFiles: input.relatedFiles ?? [],
      column: "todo",
      proposals: [],
      createdAt: now,
      updatedAt: now,
      creditsUsed: 0,
    };
    this.tasks = [task, ...this.tasks];
    await this.persist();
    return task;
  }

  public async moveTask(id: string, column: KanbanColumn): Promise<KanbanTask> {
    return this.updateTask(id, {
      column,
      completedAt: column === "done" ? new Date().toISOString() : undefined,
    });
  }

  public async updateTask(id: string, patch: Partial<KanbanTask>): Promise<KanbanTask> {
    const existing = this.tasks.find((task) => task.id === id);
    if (!existing) {
      throw new Error(`Kanban task not found: ${id}`);
    }
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    this.tasks = this.tasks.map((task) => (task.id === id ? updated : task));
    await this.persist();
    return updated;
  }

  public subscribe(listener: KanbanListener): () => void {
    this.listeners.add(listener);
    listener(this.list());
    return () => this.listeners.delete(listener);
  }

  private async load(): Promise<void> {
    const raw = await this.store.getItem(kanbanStorageKey);
    if (!raw) {
      this.tasks = [];
      return;
    }
    try {
      const parsed = z.array(z.unknown()).safeParse(JSON.parse(raw));
      this.tasks = parsed.success ? parsed.data.filter(isKanbanTask) : [];
    } catch (error) {
      logger.warn('KanbanService', 'Failed to parse kanban tasks from storage', error);
      await this.store.removeItem(kanbanStorageKey);
      this.tasks = [];
    }
  }

  private async persist(): Promise<void> {
    await this.store.setItem(kanbanStorageKey, JSON.stringify(this.tasks));
    const snapshot = this.list();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

function isKanbanTask(value: unknown): value is KanbanTask {
  if (!value || typeof value !== "object") {
    return false;
  }
  const task = value as Partial<KanbanTask>;
  return typeof task.id === "string" && typeof task.title === "string" && typeof task.column === "string";
}
