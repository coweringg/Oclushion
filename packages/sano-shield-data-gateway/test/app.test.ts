import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";

const token = "data-gateway-test-token-that-is-long-enough";
const organizationId = "11111111-1111-4111-8111-111111111111";
const queryResults: Record<string, unknown>[] = [
  {
    name: "Ana",
    email: "ana@empresa.com",
    salary: 120000,
    credit_card: "4111111111111111",
  },
];

class FakePool {
  public queries: Array<{ text: string; values?: unknown[] }> = [];

  async query<T extends Record<string, unknown>>(text: string, values?: unknown[]) {
    this.queries.push({ text, values });
    if (text.startsWith("SELECT 1")) {
      return { rows: [{ ok: 1 } as unknown as T], fields: [] };
    }
    if (text.startsWith("SELECT name")) {
      return {
        rows: queryResults as T[],
        fields: [
          { name: "name" },
          { name: "email" },
          { name: "salary" },
          { name: "credit_card" },
        ],
      };
    }
    return { rows: [], fields: [] };
  }
}

const apps: Array<ReturnType<typeof createApp>> = [];

beforeEach(() => {
  apps.length = 0;
});

afterEach(async () => {
  await Promise.all(apps.map((app) => app.close()));
});

describe("data gateway app", () => {
  it("sanitizes PostgreSQL rows and persists audit/token metadata", async () => {
    const sourcePool = new FakePool();
    const controlPool = new FakePool();
    const app = createApp({
      environment: {
        DATA_GATEWAY_TOKEN: token,
        DATA_PROTECT_ENCRYPTION_KEY: Buffer.from("0123456789abcdef0123456789abcdef").toString("base64"),
        DATA_GATEWAY_ENABLE_RATE_LIMITING: false,
        DATA_GATEWAY_RATE_LIMIT_MAX: 120,
      },
      sourcePool: sourcePool as never,
      controlPool: controlPool as never,
    });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/v1/query",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        organizationId,
        sql: "SELECT name, email, salary, credit_card FROM employees LIMIT 1000",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      decision: "ALLOW",
      columns: ["name", "email", "credit_card"],
      rows: [
        {
          name: "Ana",
          email: "a***@empresa.com",
          credit_card: expect.stringMatching(/^SANO_DATA_TOKEN_/u),
        },
      ],
    });
    expect(sourcePool.queries[0]?.text).toContain("LIMIT 100");
    expect(controlPool.queries.some((query) => query.text.includes("data_token_vault"))).toBe(true);
    expect(controlPool.queries.some((query) => query.text.includes("platform_audit_events"))).toBe(true);
    expect(JSON.stringify(controlPool.queries)).not.toContain("4111111111111111");
  }, 30_000);

  it("blocks unsafe SQL and records a blocked audit event", async () => {
    const sourcePool = new FakePool();
    const controlPool = new FakePool();
    const app = createApp({
      environment: {
        DATA_GATEWAY_TOKEN: token,
        DATA_PROTECT_ENCRYPTION_KEY: Buffer.from("0123456789abcdef0123456789abcdef").toString("base64"),
        DATA_GATEWAY_ENABLE_RATE_LIMITING: false,
        DATA_GATEWAY_RATE_LIMIT_MAX: 120,
      },
      sourcePool: sourcePool as never,
      controlPool: controlPool as never,
    });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/v1/query",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        organizationId,
        sql: "SELECT * FROM employees",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ decision: "BLOCK" });
    expect(sourcePool.queries).toEqual([]);
    expect(controlPool.queries.some((query) => query.text.includes("platform_audit_events"))).toBe(true);
  });

  it("requires a gateway bearer token", async () => {
    const app = createApp({
      environment: {
        DATA_GATEWAY_TOKEN: token,
        DATA_PROTECT_ENCRYPTION_KEY: Buffer.from("0123456789abcdef0123456789abcdef").toString("base64"),
        DATA_GATEWAY_ENABLE_RATE_LIMITING: false,
        DATA_GATEWAY_RATE_LIMIT_MAX: 120,
      },
      sourcePool: new FakePool() as never,
      controlPool: new FakePool() as never,
    });
    apps.push(app);

    expect((await app.inject({ method: "POST", url: "/v1/query", payload: {} })).statusCode).toBe(401);
  });
});
