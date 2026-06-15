import { describe, expect, it } from "vitest";

import { MultiplayerService } from "./multiplayer.service";

describe("MultiplayerService", () => {
  it("binds files to a Yjs room and tracks room metadata", async () => {
    const service = new MultiplayerService({
      id: "u1",
      name: "Juan",
      color: "#7c3aed",
      type: "human",
      role: "full-write",
    });

    await service.joinRoom({ roomId: "room-1", serverUrl: "ws://localhost:1234" });
    const text = service.bindFileToDoc("src/app.tsx");
    text.insert(0, "export const App = () => null;");

    expect(service.snapshot()?.activeFilePaths).toContain("src/app.tsx");
    expect(service.getDoc().getText("src/app.tsx").toString()).toContain("App");
    service.disconnect();
    expect(service.snapshot()).toBeNull();
  });
});
