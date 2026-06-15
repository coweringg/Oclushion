import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { InstallationProgressService } from "./installation-progress.service";

describe("InstallationProgressService", () => {
  let service: InstallationProgressService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new InstallationProgressService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with null snapshot", () => {
    expect(service.getSnapshot()).toBeNull();
    expect(service.isInstalling()).toBe(false);
  });

  it("subscribes to progress changes", () => {
    const listener = vi.fn();
    const unsub = service.subscribe(listener);

    expect(listener).toHaveBeenCalledWith(null);

    service.startBatch("Installing skills", [{ id: "s1", name: "Skill 1", version: "1.0.0" }]);
    expect(listener).toHaveBeenCalledTimes(2);

    unsub();
  });

  it("starts a batch installation", () => {
    service.startBatch("Installing skills", [
      { id: "s1", name: "Skill 1", version: "1.0.0" },
      { id: "s2", name: "Skill 2", version: "2.0.0" },
    ]);

    const snapshot = service.getSnapshot();
    expect(snapshot).not.toBeNull();
    expect(snapshot!.title).toBe("Installing skills");
    expect(snapshot!.tasks).toHaveLength(2);
    expect(snapshot!.status).toBe("installing");
    expect(snapshot!.tasks[0]?.name).toBe("Skill 1");
    expect(snapshot!.tasks[1]?.name).toBe("Skill 2");
  });

  it("isInstalling returns true during installation", () => {
    service.startBatch("Installing", [{ id: "s1", name: "Skill 1", version: "1.0.0" }]);
    expect(service.isInstalling()).toBe(true);
  });

  it("updates task progress", () => {
    service.startBatch("Installing", [{ id: "s1", name: "Skill 1", version: "1.0.0" }]);
    service.updateTask("s1", "downloading", "active", 50);

    const snapshot = service.getSnapshot();
    expect(snapshot!.tasks[0]?.step).toBe("downloading");
    expect(snapshot!.tasks[0]?.status).toBe("active");
    expect(snapshot!.tasks[0]?.progress).toBe(50);
  });

  it("calculates total progress correctly", () => {
    service.startBatch("Installing", [{ id: "s1", name: "Skill 1", version: "1.0.0" }]);

    service.updateTask("s1", "downloading", "active", 50);
    expect(service.getSnapshot()!.totalProgress).toBe(20);

    service.updateTask("s1", "downloading", "completed", 100);
    expect(service.getSnapshot()!.totalProgress).toBe(40);

    service.updateTask("s1", "verifying", "active", 50);
    expect(service.getSnapshot()!.totalProgress).toBe(50);

    service.updateTask("s1", "verifying", "completed", 100);
    expect(service.getSnapshot()!.totalProgress).toBe(60);

    service.updateTask("s1", "writing", "active", 50);
    expect(service.getSnapshot()!.totalProgress).toBe(75);

    service.updateTask("s1", "writing", "completed", 100);
    expect(service.getSnapshot()!.totalProgress).toBe(90);

    service.updateTask("s1", "activating", "completed", 100);
    expect(service.getSnapshot()!.totalProgress).toBe(100);
  });

  it("completes batch successfully", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    service.startBatch("Installing", [{ id: "s1", name: "Skill 1", version: "1.0.0" }]);
    service.updateTask("s1", "downloading", "active", 50);

    service.completeBatch(true);

    const snapshot = service.getSnapshot();
    expect(snapshot!.status).toBe("completed");
    expect(snapshot!.completedAt).toBeDefined();
    expect(snapshot!.tasks[0]?.status).toBe("completed");
    expect(snapshot!.tasks[0]?.progress).toBe(100);

    vi.advanceTimersByTime(3000);
    expect(service.getSnapshot()).toBeNull();
  });

  it("completes batch with failure", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    service.startBatch("Installing", [{ id: "s1", name: "Skill 1", version: "1.0.0" }]);
    service.updateTask("s1", "downloading", "active", 50);

    service.completeBatch(false);

    const snapshot = service.getSnapshot();
    expect(snapshot!.status).toBe("failed");
    expect(snapshot!.tasks[0]?.status).toBe("active");
    expect(snapshot!.tasks[0]?.progress).toBe(50);

    vi.advanceTimersByTime(3000);
    expect(service.getSnapshot()).toBeNull();
  });

  it("cancels installation", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    service.startBatch("Installing", [
      { id: "s1", name: "Skill 1", version: "1.0.0" },
      { id: "s2", name: "Skill 2", version: "2.0.0" },
    ]);
    service.updateTask("s1", "downloading", "active", 50);

    service.cancel();

    const snapshot = service.getSnapshot();
    expect(snapshot!.status).toBe("cancelled");
    expect(snapshot!.tasks[0]?.status).toBe("cancelled");
    expect(snapshot!.tasks[1]?.status).toBe("cancelled");

    vi.advanceTimersByTime(2000);
    expect(service.getSnapshot()).toBeNull();
  });

  it("does not update task after completion", () => {
    service.startBatch("Installing", [{ id: "s1", name: "Skill 1", version: "1.0.0" }]);
    service.completeBatch(true);

    service.updateTask("s1", "writing", "active", 50);
    const snapshot = service.getSnapshot();
    expect(snapshot!.tasks[0]?.status).toBe("completed");
  });

  it("ignores update for unknown task", () => {
    service.startBatch("Installing", [{ id: "s1", name: "Skill 1", version: "1.0.0" }]);
    service.updateTask("unknown", "downloading", "active", 50);

    const snapshot = service.getSnapshot();
    expect(snapshot!.tasks[0]?.status).toBe("pending");
  });

  it("provides abort signal", () => {
    const signal = service.getAbortSignal();
    expect(signal).toBeNull();

    service.startBatch("Installing", [{ id: "s1", name: "Skill 1", version: "1.0.0" }]);
    const signalAfterStart = service.getAbortSignal();
    expect(signalAfterStart).not.toBeNull();
    expect(signalAfterStart!.aborted).toBe(false);
  });

  it("multiple tasks calculate progress correctly", () => {
    service.startBatch("Installing", [
      { id: "s1", name: "Skill 1", version: "1.0.0" },
      { id: "s2", name: "Skill 2", version: "2.0.0" },
    ]);

    service.updateTask("s1", "downloading", "completed", 100);
    expect(service.getSnapshot()!.totalProgress).toBe(20);

    service.updateTask("s2", "downloading", "completed", 100);
    expect(service.getSnapshot()!.totalProgress).toBe(40);

    service.updateTask("s1", "verifying", "completed", 100);
    service.updateTask("s2", "verifying", "completed", 100);
    expect(service.getSnapshot()!.totalProgress).toBe(60);

    service.updateTask("s1", "writing", "completed", 100);
    service.updateTask("s2", "writing", "completed", 100);
    expect(service.getSnapshot()!.totalProgress).toBe(90);

    service.updateTask("s1", "activating", "completed", 100);
    service.updateTask("s2", "activating", "completed", 100);
    expect(service.getSnapshot()!.totalProgress).toBe(100);
  });
});
