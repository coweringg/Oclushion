import { describe, expect, it } from "vitest";

import { AppStateManager, createInitialAppState } from "./app-state";

describe("AppStateManager", () => {
  it("publishes immutable snapshots to subscribers", () => {
    const manager = new AppStateManager(createInitialAppState());
    const seen: string[] = [];
    manager.subscribe((state) => {
      seen.push(state.currentWorkspace ?? "none");
    });

    manager.setState({ currentWorkspace: "C:/repo" });
    const snapshot = manager.getState();
    snapshot.chatHistory.push({
      id: "local-mutation",
      role: "user",
      content: "should not leak",
      createdAt: new Date().toISOString(),
    });

    expect(seen).toEqual(["none", "C:/repo"]);
    expect(manager.getState().chatHistory).toHaveLength(0);
  });
});
