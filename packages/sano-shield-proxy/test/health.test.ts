import { afterEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";

const applications = new Set<ReturnType<typeof createApp>>();

afterEach(async () => {
  await Promise.all([...applications].map(async (application) => application.close()));
  applications.clear();
});

describe("proxy health endpoint", () => {
  it("reports service readiness without exposing application data", async () => {
    const app = createApp(undefined, { enableRateLimiting: false });
    applications.add(app);

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      service: "sano-proxy",
      status: "ok",
      version: "1.0.0",
    });
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
  }, 60_000);
});
