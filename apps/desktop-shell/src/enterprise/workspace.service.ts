import { z } from "zod";
import { logger } from "../utils/logger";

const WORKSPACES_KEY = "ocl_workspaces";
const ACTIVE_WORKSPACE_KEY = "ocl_active_workspace";

const workspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  rootPath: z.string(),
  createdAt: z.string(),
  lastOpenedAt: z.string().optional(),
  settings: z.object({
    llmProvider: z.string().optional(),
    llmModel: z.string().optional(),
    ollamaBaseUrl: z.string().optional(),
    activeSkillpacks: z.array(z.string()).optional(),
    mcpEnabled: z.boolean().optional(),
  }),
});

export type WorkspaceSettings = {
  llmProvider?: string;
  llmModel?: string;
  ollamaBaseUrl?: string;
  activeSkillpacks?: string[];
  mcpEnabled?: boolean;
};

export type Workspace = {
  id: string;
  name: string;
  rootPath: string;
  createdAt: string;
  lastOpenedAt?: string;
  settings: WorkspaceSettings;
};

export class WorkspaceService {
  private workspaces: Workspace[] = [];
  private activeWorkspaceId: string | null = null;

  public constructor() {
    this.load();
  }

  public list(): Workspace[] {
    return [...this.workspaces];
  }

  public getActive(): Workspace | null {
    if (!this.activeWorkspaceId) return null;
    const found = this.workspaces.find((w) => w.id === this.activeWorkspaceId);
    return found ?? null;
  }

  public get(id: string): Workspace | null {
    const found = this.workspaces.find((w) => w.id === id);
    return found ?? null;
  }

  public add(input: Omit<Workspace, "id" | "createdAt">): Workspace {
    const newWorkspace: Workspace = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      name: input.name,
      rootPath: input.rootPath,
      lastOpenedAt: input.lastOpenedAt,
      settings: input.settings,
    };
    this.workspaces.push(newWorkspace);
    this.save();
    return newWorkspace;
  }

  public update(id: string, updates: Partial<Workspace>): Workspace | null {
    const index = this.workspaces.findIndex((w) => w.id === id);
    if (index === -1) return null;
    this.workspaces[index] = { ...this.workspaces[index], ...updates, id };
    this.save();
    return this.workspaces[index];
  }

  public remove(id: string): boolean {
    const index = this.workspaces.findIndex((w) => w.id === id);
    if (index === -1) return false;
    this.workspaces.splice(index, 1);
    if (this.activeWorkspaceId === id) {
      this.activeWorkspaceId = this.workspaces[0]?.id ?? null;
    }
    this.save();
    return true;
  }

  public setActive(id: string): boolean {
    const workspace = this.get(id);
    if (!workspace) return false;
    this.activeWorkspaceId = id;
    workspace.lastOpenedAt = new Date().toISOString();
    this.save();
    return true;
  }

  private load(): void {
    try {
      const raw = globalThis.localStorage?.getItem(WORKSPACES_KEY);
      if (raw) {
        const parsed = z.array(workspaceSchema).safeParse(JSON.parse(raw));
        if (parsed.success) {
          this.workspaces = parsed.data;
        }
      }
      this.activeWorkspaceId = globalThis.localStorage?.getItem(ACTIVE_WORKSPACE_KEY) ?? null;
    } catch (error) {
      logger.debug("WorkspaceService", "Failed to load workspaces", error);
    }
  }

  private save(): void {
    try {
      globalThis.localStorage?.setItem(WORKSPACES_KEY, JSON.stringify(this.workspaces));
      if (this.activeWorkspaceId) {
        globalThis.localStorage?.setItem(ACTIVE_WORKSPACE_KEY, this.activeWorkspaceId);
      } else {
        globalThis.localStorage?.removeItem(ACTIVE_WORKSPACE_KEY);
      }
    } catch (error) {
      logger.debug("WorkspaceService", "Failed to save workspaces", error);
    }
  }
}