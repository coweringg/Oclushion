import { test, expect } from "@playwright/test";

test.describe("Marketplace", () => {
  const API_BASE = process.env.CONTROL_API_URL ?? "http://127.0.0.1:8082";

  test("GET /v1/marketplace/catalog returns skill list", async () => {
    const res = await fetch(`${API_BASE}/v1/marketplace/catalog`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.skills)).toBeTruthy();
  });

  test("GET /v1/marketplace/skills/:id returns skill detail", async () => {
    const list = await fetch(`${API_BASE}/v1/marketplace/catalog`);
    const listBody = await list.json();
    const skills = listBody.skills ?? [];
    if (skills.length > 0) {
      const res = await fetch(`${API_BASE}/v1/marketplace/skills/${skills[0].id}`);
      expect(res.status).toBe(200);
    }
  });
});
