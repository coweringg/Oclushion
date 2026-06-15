import { describe, expect, it } from "vitest";

import { MemoryKeyValueStore } from "../persistent-store";
import { ChatSessionService } from "./chat-session.service";

describe("ChatSessionService", () => {
  it("persists sessions and messages without auto-deleting history", async () => {
    const store = new MemoryKeyValueStore();
    const service = await ChatSessionService.create(store, null);
    const session = await service.createSession("Implement terminal");

    await service.appendMessage(session.id, { role: "user", content: "Run tests" });
    await service.appendMessage(session.id, {
      role: "assistant",
      content: "Tests are running.",
      model: "gpt-5.4-mini",
      metadata: { tokens: 42 },
    });

    const loaded = await service.loadSession(session.id);
    expect(loaded.messages).toHaveLength(2);
    expect(loaded.messages[1]?.metadata).toEqual({ tokens: 42 });

    await service.renameSession(session.id, "Terminal work");
    expect((await service.loadSession(session.id)).title).toBe("Terminal work");
    expect((await service.listFlatSessions())[0]?.id).toBe(session.id);
  });

  it("soft-deletes sessions and creates agent-spawned chats with system context", async () => {
    const service = await ChatSessionService.create(new MemoryKeyValueStore(), null);
    const session = await service.createSession("Main");
    const spawned = await service.spawnAgentChat("Frontend Builder", "Implement the sidebar.");

    const loadedSpawned = await service.loadSession(spawned.id);
    expect(loadedSpawned.messages[0]).toMatchObject({
      role: "system",
      content: "Implement the sidebar.",
    });

    await service.deleteSession(session.id);
    expect((await service.listFlatSessions()).map((item) => item.id)).toEqual([spawned.id]);
    await expect(service.loadSession(session.id)).resolves.toMatchObject({ isArchived: true });
  });
});
