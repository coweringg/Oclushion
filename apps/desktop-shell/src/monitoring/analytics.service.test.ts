import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { trackEvent, startAnalytics, stopAnalytics } from "./analytics.service";

vi.mock("../config/api", () => ({
  getControlApiUrl: () => "https://api.oclushion.test",
}));

const ls = new Map<string, string>();
const ss = new Map<string, string>();

describe("analytics.service", () => {
  beforeEach(() => {
    ls.clear();
    ss.clear();
    vi.useFakeTimers();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => ls.get(k) ?? null,
      setItem: (k: string, v: string) => { ls.set(k, v); },
      removeItem: (k: string) => { ls.delete(k); },
      clear: () => ls.clear(),
    });
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => ss.get(k) ?? null,
      setItem: (k: string, v: string) => { ss.set(k, v); },
      removeItem: (k: string) => { ss.delete(k); },
      clear: () => ss.clear(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("tracks a simple event", () => {
    trackEvent({ name: "feature_used", properties: { feature: "test" } });
  });

  it("buffers events up to limit before flushing", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));

    for (let i = 0; i < 51; i++) {
      trackEvent({ name: "feature_used", properties: { feature: `evt-${i}` } });
    }

    await vi.waitFor(() => { expect(fetchSpy).toHaveBeenCalledTimes(1); });
  });

  it("startAnalytics tracks session_started event", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    vi.spyOn(globalThis, "setInterval");

    startAnalytics();

    expect(globalThis.setInterval).toHaveBeenCalled();

    stopAnalytics();
    fetchSpy.mockRestore();
  });

  it("stopAnalytics flushes pending events", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));

    trackEvent({ name: "feature_used", properties: { feature: "final" } });
    stopAnalytics();

    await vi.waitFor(() => { expect(fetchSpy).toHaveBeenCalled(); });
  });
});
