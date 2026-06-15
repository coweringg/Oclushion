import { describe, expect, it } from "vitest";

import { AuditService } from "./audit.service";
import { MemoryKeyValueStore } from "./persistent-store";

const promptEvent = {
  type: "PROMPT_SENT" as const,
  actor: "developer" as const,
  workspaceId: "mock://acme-platform",
  plan: "Pro" as const,
  summary: "Prompt sent to Claude",
  metadata: {
    model: "claude-opus-4-8",
    sanitized: true,
  },
};

describe("AuditService", () => {
  it("records events locally and persists them safely", async () => {
    const storage = new MemoryKeyValueStore();
    const service = await AuditService.create(storage);

    const event = service.record(promptEvent);

    expect(event.syncStatus).toBe("local_only");
    expect(service.list()).toHaveLength(1);
    expect(await storage.getItem("oclushion.desktop.audit-events.v2")).toContain("PROMPT_SENT");
  });

  it("does not dispatch remote batches for Free or Pro plans", async () => {
    let dispatched = 0;
    const service = await AuditService.create(new MemoryKeyValueStore(), async (events) => {
      dispatched += events.length;
    });

    service.record(promptEvent);
    const result = await service.dispatchForPlan("Pro");

    expect(result).toMatchObject({ mode: "local_only", dispatched: 0, status: "skipped" });
    expect(dispatched).toBe(0);
  });

  it("dispatches pending events for Team and Enterprise plans only", async () => {
    const batches: number[] = [];
    const service = await AuditService.create(new MemoryKeyValueStore(), async (events) => {
      batches.push(events.length);
    });

    service.record({ ...promptEvent, plan: "Team" });
    const teamResult = await service.dispatchForPlan("Team");

    service.record({ ...promptEvent, plan: "Enterprise" });
    const enterpriseResult = await service.dispatchForPlan("Enterprise");

    expect(teamResult).toMatchObject({ mode: "cloud_sync", dispatched: 1, status: "synced" });
    expect(enterpriseResult).toMatchObject({
      mode: "enterprise_vault",
      dispatched: 1,
      status: "synced",
    });
    expect(batches).toEqual([1, 1]);
    expect(service.list().every((event) => event.syncStatus === "synced")).toBe(true);
  });

  it("falls back to an empty log when persisted JSON is invalid", async () => {
    const storage = new MemoryKeyValueStore();
    await storage.setItem("oclushion.desktop.audit-events.v2", "{broken");

    const service = await AuditService.create(storage);

    expect(service.list()).toEqual([]);
    expect(await storage.getItem("oclushion.desktop.audit-events.v2")).toBeNull();
  });
});
