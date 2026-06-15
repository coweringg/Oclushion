import { getControlApiUrl, type OclushionPlan, type OclushionSession } from "./auth.service";
import { logger } from "./utils/logger";
import { z } from "zod";
import type { KeyValueStore } from "./persistent-store";

export type AuditEventType =
  | "PROMPT_SENT"
  | "CODE_APPROVED"
  | "CODE_REJECTED"
  | "COMMAND_EXECUTED"
  | "FAST_APPLY_WRITTEN"
  | "CODE_ACCEPTED"
  | "CODE_REVERTED"
  | "GOD_MODE_ENABLED"
  | "GOD_MODE_DISABLED"
  | "DEPLOYMENT_STARTED"
  | "DEPLOYMENT_COMPLETED"
  | "DEPLOYMENT_ROLLED_BACK"
  | "VOICE_TRANSCRIBED"
  | "PROMPT_ENHANCED"
  | "PREVIEW_STARTED"
  | "MULTIPLAYER_JOINED";

export type AuditEvent = {
  id: string;
  type: AuditEventType;
  timestamp: string;
  actor: "developer" | "oclushion-ai" | "agent";
  workspaceId: string;
  plan: OclushionPlan;
  summary: string;
  metadata: Record<string, string | number | boolean | null>;
  syncStatus: "local_only" | "pending" | "synced" | "failed";
};

export type AuditEventInput = Omit<AuditEvent, "id" | "timestamp" | "syncStatus">;
export type AuditRemoteDispatcher = (events: AuditEvent[]) => Promise<void>;

export type AuditSnapshot = {
  events: AuditEvent[];
  lastDispatch: AuditDispatchResult | null;
};

export type AuditDispatchResult = {
  mode: "local_only" | "cloud_sync" | "enterprise_vault";
  dispatched: number;
  endpoint: string | null;
  status: "skipped" | "synced" | "failed";
};

const auditStorageKey = "oclushion.desktop.audit-events.v2";

type AuditListener = (snapshot: AuditSnapshot) => void;

export class AuditService {
  private events: AuditEvent[] = [];
  private lastDispatch: AuditDispatchResult | null = null;
  private readonly listeners = new Set<AuditListener>();
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly SYNC_INTERVAL_MS = 30_000;
  private readonly MAX_BATCH_SIZE = 100;

  private constructor(
    private readonly storage: KeyValueStore,
    private readonly remoteDispatcher: AuditRemoteDispatcher,
  ) {}

  public startAutoSync(dispatcher?: AuditRemoteDispatcher): void {
    if (this.syncTimer) return;
    const dispatch = dispatcher ?? this.remoteDispatcher;
    const tick = () => {
      void this.flushPendingEvents(dispatch);
      this.syncTimer = setTimeout(tick, this.SYNC_INTERVAL_MS);
    };
    this.syncTimer = setTimeout(tick, this.SYNC_INTERVAL_MS);
  }

  public stopAutoSync(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
  }

  public async flushOnLogout(dispatcher?: AuditRemoteDispatcher): Promise<void> {
    const dispatch = dispatcher ?? this.remoteDispatcher;
    this.stopAutoSync();
    await this.flushPendingEvents(dispatch);
  }

  private async flushPendingEvents(dispatcher: AuditRemoteDispatcher): Promise<void> {
    const pending = this.events.filter((event) => event.syncStatus === "pending");
    if (pending.length === 0) return;

    for (let i = 0; i < pending.length; i += this.MAX_BATCH_SIZE) {
      const batch = pending.slice(i, i + this.MAX_BATCH_SIZE);
      try {
        await dispatcher(batch);
        const batchIds = new Set(batch.map((e) => e.id));
        this.events = this.events.map((event) =>
          batchIds.has(event.id) ? { ...event, syncStatus: "synced" } : event,
        );
      } catch (error) {
        logger.warn('audit-sync', 'Failed to sync audit batch', error);
        const batchIds = new Set(batch.map((e) => e.id));
        this.events = this.events.map((event) =>
          batchIds.has(event.id) ? { ...event, syncStatus: "failed" } : event,
        );
        break;
      }
    }
    await this.persist();
    this.emit();
  }

  public static async create(
    storage: KeyValueStore,
    remoteDispatcher: AuditRemoteDispatcher = async () => Promise.resolve(),
  ): Promise<AuditService> {
    const service = new AuditService(storage, remoteDispatcher);
    service.events = await service.loadEvents();
    return service;
  }

  public record(input: AuditEventInput): AuditEvent {
    const syncStatus = isCloudPlan(input.plan) ? "pending" : "local_only";
    const event: AuditEvent = {
      ...input,
      id: createAuditId(),
      timestamp: new Date().toISOString(),
      syncStatus,
    };
    this.events = [event, ...this.events].slice(0, 250);
    void this.persist();
    this.emit();
    return event;
  }

  public list(): AuditEvent[] {
    return [...this.events];
  }

  public snapshot(): AuditSnapshot {
    return {
      events: this.list(),
      lastDispatch: this.lastDispatch,
    };
  }

  public async dispatchForPlan(plan: OclushionPlan): Promise<AuditDispatchResult> {
    if (!isCloudPlan(plan)) {
      this.lastDispatch = {
        mode: "local_only",
        dispatched: 0,
        endpoint: null,
        status: "skipped",
      };
      this.emit();
      return this.lastDispatch;
    }

    const pending = this.events.filter((event) => event.syncStatus === "pending");
    if (!pending.length) {
      this.lastDispatch = {
        mode: plan === "Enterprise" ? "enterprise_vault" : "cloud_sync",
        dispatched: 0,
        endpoint: getAuditEndpoint(),
        status: "synced",
      };
      this.emit();
      return this.lastDispatch;
    }

    try {
      await this.remoteDispatcher(pending);
      const pendingIds = new Set(pending.map((event) => event.id));
      this.events = this.events.map((event) =>
        pendingIds.has(event.id) ? { ...event, syncStatus: "synced" } : event,
      );
      this.lastDispatch = {
        mode: plan === "Enterprise" ? "enterprise_vault" : "cloud_sync",
        dispatched: pending.length,
        endpoint: getAuditEndpoint(),
        status: "synced",
      };
    } catch (error) {
      logger.warn('AuditService', 'Failed to dispatch audit events', error);
      const pendingIds = new Set(pending.map((event) => event.id));
      this.events = this.events.map((event) =>
        pendingIds.has(event.id) ? { ...event, syncStatus: "failed" } : event,
      );
      this.lastDispatch = {
        mode: plan === "Enterprise" ? "enterprise_vault" : "cloud_sync",
        dispatched: 0,
        endpoint: getAuditEndpoint(),
        status: "failed",
      };
    }
    await this.persist();
    this.emit();
    return this.lastDispatch;
  }

  public subscribe(listener: AuditListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  private async loadEvents(): Promise<AuditEvent[]> {
    const raw = await this.storage.getItem(auditStorageKey);
    if (!raw) {
      return [];
    }

    try {
      const parsedRaw = z.array(z.unknown()).safeParse(JSON.parse(raw));
      if (!parsedRaw.success) {
        return [];
      }
      return parsedRaw.data.filter(isAuditEvent).slice(0, 250);
    } catch (error) {
      logger.warn('AuditService', 'Failed to parse audit events from storage', error);
      await this.storage.removeItem(auditStorageKey);
      return [];
    }
  }

  private async persist(): Promise<void> {
    await this.storage.setItem(auditStorageKey, JSON.stringify(this.events));
  }

  private emit(): void {
    const snapshot = this.snapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

export function createControlApiAuditDispatcher(sessionProvider: () => OclushionSession | null) {
  return async (events: AuditEvent[]) => {
    const session = sessionProvider();
    if (!session) {
      throw new Error("Cannot sync audit events without an authenticated Control API session.");
    }
    const response = await fetch(getAuditEndpoint(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        organizationId: session.user.organizationId,
        events,
      }),
    });
    if (!response.ok) {
      throw new Error(`Control API audit sync failed with HTTP ${response.status}`);
    }
  };
}

export function getAuditSyncMode(plan: OclushionPlan): AuditDispatchResult["mode"] {
  if (plan === "Enterprise") {
    return "enterprise_vault";
  }
  if (plan === "Team") {
    return "cloud_sync";
  }
  return "local_only";
}

export function getAuditEndpoint(): string {
  return `${getControlApiUrl()}/v1/desktop/audit-events/batch`;
}

function isCloudPlan(plan: OclushionPlan): boolean {
  return plan === "Team" || plan === "Enterprise";
}

function isAuditEvent(value: unknown): value is AuditEvent {
  if (!value || typeof value !== "object") {
    return false;
  }
  const event = value as Partial<AuditEvent>;
  return (
    typeof event.id === "string" &&
    typeof event.timestamp === "string" &&
    typeof event.summary === "string" &&
    typeof event.workspaceId === "string" &&
    typeof event.plan === "string" &&
    typeof event.type === "string"
  );
}

function createAuditId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `audit-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
