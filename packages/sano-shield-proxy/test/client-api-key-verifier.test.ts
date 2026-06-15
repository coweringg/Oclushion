import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { PostgresClientApiKeyResolver } from "../src/auth/client-api-key-verifier.js";

describe("client API key resolver", () => {
  it("hashes client credentials and returns a tenant-aware principal", async () => {
    const apiKey = "oclushion_live_abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
    const expectedHash = createHash("sha256").update(apiKey).digest("hex");
    const calls: unknown[][] = [];
    const resolver = new PostgresClientApiKeyResolver({
      query: async (_sql, values) => {
        calls.push(values);
        return {
          rowCount: values[0] === expectedHash && values[1] === "proxy:invoke" ? 1 : 0,
          rows:
            values[0] === expectedHash && values[1] === "proxy:invoke"
              ? [
                  {
                    id: "e74c10c2-3b54-405e-a806-59979d16b526",
                    organization_id: "ae22b1a6-e1fd-43f5-a43d-a0a133db41df",
                    scopes: ["proxy:invoke"],
                  },
                ]
              : [],
        };
      },
    });

    await expect(resolver.resolve(apiKey, "proxy:invoke")).resolves.toEqual({
      apiKeyId: "e74c10c2-3b54-405e-a806-59979d16b526",
      organizationId: "ae22b1a6-e1fd-43f5-a43d-a0a133db41df",
      scopes: ["proxy:invoke"],
    });
    expect(calls).toEqual([[expectedHash, "proxy:invoke"]]);
  });

  it("accepts legacy Sano Shield client credentials during migration", async () => {
    const apiKey = "sano_live_abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
    const expectedHash = createHash("sha256").update(apiKey).digest("hex");
    const resolver = new PostgresClientApiKeyResolver({
      query: async (_sql, values) => ({
        rowCount: values[0] === expectedHash && values[1] === "proxy:invoke" ? 1 : 0,
        rows:
          values[0] === expectedHash && values[1] === "proxy:invoke"
            ? [
                {
                  id: "e74c10c2-3b54-405e-a806-59979d16b526",
                  organization_id: "ae22b1a6-e1fd-43f5-a43d-a0a133db41df",
                  scopes: ["proxy:invoke"],
                },
              ]
            : [],
      }),
    });

    await expect(resolver.resolve(apiKey, "proxy:invoke")).resolves.toMatchObject({
      organizationId: "ae22b1a6-e1fd-43f5-a43d-a0a133db41df",
    });
  });

  it("rejects malformed client credentials without querying storage", async () => {
    let queried = false;
    const resolver = new PostgresClientApiKeyResolver({
      query: async () => {
        queried = true;
        return { rowCount: 1, rows: [] };
      },
    });

    await expect(resolver.resolve("invalid", "proxy:invoke")).resolves.toBeNull();
    expect(queried).toBe(false);
  });
});
