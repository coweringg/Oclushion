import { createHash, createHmac, randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { PostgresClientApiKeyResolver } from "../src/auth/client-api-key-verifier.js";

const TEST_PEPPER = "oclushion-hmac-v1";

function buildV1StoredHash(apiKey: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = createHash("sha256").update(salt + apiKey + TEST_PEPPER).digest("hex");
  return `v1:${salt}:${hash}`;
}

function buildLegacyStoredHash(apiKey: string): string {
  return createHmac("sha256", TEST_PEPPER).update(apiKey).digest("hex");
}

const TEST_KEY_ID = "e74c10c2-3b54-405e-a806-59979d16b526";
const TEST_ORG_ID = "ae22b1a6-e1fd-43f5-a43d-a0a133db41df";

describe("client API key resolver", () => {
  it("accepts v1-formatted new API keys", async () => {
    const apiKey = "oclushion_live_abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
    const prefix = apiKey.slice(0, 18);
    const storedHash = buildV1StoredHash(apiKey);
    const selectCalls: unknown[][] = [];
    const resolver = new PostgresClientApiKeyResolver({
      query: async (sql, values) => {
        if (sql.includes("SELECT")) {
          selectCalls.push(values);
          if (values[0] === prefix && values[1] === "proxy:invoke") {
            return {
              rowCount: 1,
              rows: [
                {
                  id: TEST_KEY_ID,
                  organization_id: TEST_ORG_ID,
                  scopes: ["proxy:invoke"],
                  key_hash: storedHash,
                },
              ],
            };
          }
        }
        return { rowCount: 0, rows: [] };
      },
    });

    await expect(resolver.resolve(apiKey, "proxy:invoke")).resolves.toEqual({
      apiKeyId: TEST_KEY_ID,
      organizationId: TEST_ORG_ID,
      scopes: ["proxy:invoke"],
    });
    expect(selectCalls).toHaveLength(1);
    expect(selectCalls[0]).toEqual([prefix, "proxy:invoke"]);
  });

  it("accepts legacy HMAC-formatted API keys during migration", async () => {
    const apiKey = "sano_live_abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
    const prefix = apiKey.slice(0, 18);
    const storedHash = buildLegacyStoredHash(apiKey);
    const resolver = new PostgresClientApiKeyResolver({
      query: async (sql, values) => {
        if (sql.includes("SELECT") && values[0] === prefix && values[1] === "proxy:invoke") {
          return {
            rowCount: 1,
            rows: [
              {
                id: TEST_KEY_ID,
                organization_id: TEST_ORG_ID,
                scopes: ["proxy:invoke"],
                key_hash: storedHash,
              },
            ],
          };
        }
        return { rowCount: 0, rows: [] };
      },
    });

    await expect(resolver.resolve(apiKey, "proxy:invoke")).resolves.toMatchObject({
      organizationId: TEST_ORG_ID,
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

  it("rejects credentials when stored hash does not match", async () => {
    const apiKey = "oclushion_live_abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
    const resolver = new PostgresClientApiKeyResolver({
      query: async (_sql, values) => {
        if (values[0] === apiKey.slice(0, 18)) {
          return {
            rowCount: 1,
            rows: [
              {
                id: TEST_KEY_ID,
                organization_id: TEST_ORG_ID,
                scopes: ["proxy:invoke"],
                key_hash: "0000000000000000000000000000000000000000000000000000000000000000",
              },
            ],
          };
        }
        return { rowCount: 0, rows: [] };
      },
    });

    await expect(resolver.resolve(apiKey, "proxy:invoke")).resolves.toBeNull();
  });

  it("rejects v1 key_hash with wrong number of parts", async () => {
    const apiKey = "oclushion_live_abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
    const resolver = new PostgresClientApiKeyResolver({
      query: async (_sql, values) => {
        if (values[0] === apiKey.slice(0, 18)) {
          return {
            rowCount: 1,
            rows: [
              {
                id: TEST_KEY_ID,
                organization_id: TEST_ORG_ID,
                scopes: ["proxy:invoke"],
                key_hash: "v1:abc",
              },
            ],
          };
        }
        return { rowCount: 0, rows: [] };
      },
    });

    await expect(resolver.resolve(apiKey, "proxy:invoke")).resolves.toBeNull();
  });
});
