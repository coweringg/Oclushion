import { describe, expect, it } from "vitest";

import {
  ConnectorScopeError,
  createOAuthStart,
  decryptSecret,
  encryptSecret,
  listConnectorCatalog,
  safeCompareStateHash,
  sanitizeConnectorResource,
  validateConnectorScopes,
} from "../src/index.js";

describe("Connectors framework", () => {
  it("exposes the initial enterprise connector catalog", () => {
    const catalog = listConnectorCatalog();

    expect(catalog.map((entry) => entry.id)).toEqual([
      "google-drive",
      "slack",
      "github",
      "notion",
    ]);
    expect(catalog.find((entry) => entry.id === "google-drive")?.defaultScopes).toContain(
      "https://www.googleapis.com/auth/drive.readonly",
    );
  });

  it("rejects OAuth scopes outside the minimum privilege allowlist", () => {
    expect(validateConnectorScopes("slack", ["search:read"])).toEqual(["search:read"]);
    expect(() => validateConnectorScopes("slack", ["admin"])).toThrow(ConnectorScopeError);
  });

  it("generates PKCE OAuth starts without leaking the verifier in the URL", async () => {
    const start = await createOAuthStart({
      provider: "google-drive",
      clientId: "sano-local-client",
      redirectUri: "http://127.0.0.1:3000/oauth/callback",
      organizationId: "11111111-1111-4111-8111-111111111111",
      requestedScopes: ["https://www.googleapis.com/auth/drive.readonly"],
      now: new Date("2026-05-28T00:00:00.000Z"),
    });

    expect(start.authorizationUrl).toContain("code_challenge=");
    expect(start.authorizationUrl).not.toContain(start.codeVerifier);
    expect(safeCompareStateHash(start.state, start.stateHash)).toBe(true);
    expect(start.expiresAt).toBe("2026-05-28T00:10:00.000Z");
  });

  it("encrypts OAuth secrets with AES-256-GCM", () => {
    const key = "connector-test-key";
    const encrypted = encryptSecret("refresh-token-value", key);

    expect(encrypted.ciphertext).not.toContain("refresh-token-value");
    expect(decryptSecret(encrypted, key)).toBe("refresh-token-value");
  });

  it("sanitizes cached connector resources before persistence", () => {
    const result = sanitizeConnectorResource({
      id: "doc-1",
      type: "document",
      title: "Finance",
      content: "Enviar a ana@empresa.com con tarjeta 4111 1111 1111 1111 y sk-secretissima123456",
      updatedAt: "2026-05-28T00:00:00.000Z",
    });

    expect(result.resource.sanitizedContent).toContain("[EMAIL_0]");
    expect(result.resource.sanitizedContent).toContain("[PAYMENT_CARD_0]");
    expect(result.resource.sanitizedContent).toContain("[API_KEY_0]");
    expect(result.resource.sanitizedContent).not.toContain("ana@empresa.com");
    expect(result.counts).toMatchObject({ email: 1, payment_card: 1, api_key: 1 });
  });
});
