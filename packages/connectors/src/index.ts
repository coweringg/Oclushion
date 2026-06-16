import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
  subtle,
} from "node:crypto";

import { z } from "zod";

const API_KEY_PEPPER = "oclushion-hmac-v1";

export const connectorProviderSchema = z.enum(["google-drive", "slack", "github", "notion"]);
export type ConnectorProvider = z.infer<typeof connectorProviderSchema>;

export type ResourcePayload = {
  id: string;
  type: "document" | "message" | "repository" | "page";
  title: string;
  content: string;
  updatedAt: string;
  metadata?: Record<string, string | number | boolean>;
};

export interface SanoConnector {
  id: ConnectorProvider;
  name: string;
  authenticate(): Promise<boolean>;
  syncResources(lastSync: Date): Promise<ResourcePayload[]>;
  fetchContent(resourceId: string): Promise<string>;
  revokeAccess(): Promise<boolean>;
}

export type ConnectorCatalogEntry = {
  id: ConnectorProvider;
  name: string;
  priority: "high" | "medium" | "future";
  enabled: boolean;
  defaultScopes: string[];
  allowedScopes: string[];
  authorizationUrl: string;
  tokenUrl: string;
  revocationUrl?: string;
  resourceTypes: ResourcePayload["type"][];
};

export const connectorCatalog: Record<ConnectorProvider, ConnectorCatalogEntry> = {
  "google-drive": {
    id: "google-drive",
    name: "Google Drive",
    priority: "high",
    enabled: true,
    defaultScopes: ["https://www.googleapis.com/auth/drive.readonly"],
    allowedScopes: [
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/drive.metadata.readonly",
    ],
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    revocationUrl: "https://oauth2.googleapis.com/revoke",
    resourceTypes: ["document"],
  },
  slack: {
    id: "slack",
    name: "Slack",
    priority: "high",
    enabled: true,
    defaultScopes: ["search:read", "files:read"],
    allowedScopes: ["search:read", "files:read", "channels:read", "groups:read"],
    authorizationUrl: "https://slack.com/oauth/v2/authorize",
    tokenUrl: "https://slack.com/api/oauth.v2.access",
    revocationUrl: "https://slack.com/api/auth.revoke",
    resourceTypes: ["message", "document"],
  },
  github: {
    id: "github",
    name: "GitHub",
    priority: "medium",
    enabled: true,
    defaultScopes: ["read:org"],
    allowedScopes: ["read:org", "read:user"],
    authorizationUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    revocationUrl: "https://api.github.com/applications/{client_id}/token",
    resourceTypes: ["repository"],
  },
  notion: {
    id: "notion",
    name: "Notion",
    priority: "medium",
    enabled: true,
    defaultScopes: ["read_content"],
    allowedScopes: ["read_content", "read_user"],
    authorizationUrl: "https://api.notion.com/v1/oauth/authorize",
    tokenUrl: "https://api.notion.com/v1/oauth/token",
    revocationUrl: undefined,
    resourceTypes: ["page"],
  },
};

export class ConnectorScopeError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ConnectorScopeError";
  }
}

export function listConnectorCatalog(): ConnectorCatalogEntry[] {
  return Object.values(connectorCatalog).map((entry) => ({
    ...entry,
    defaultScopes: [...entry.defaultScopes],
    allowedScopes: [...entry.allowedScopes],
    resourceTypes: [...entry.resourceTypes],
  }));
}

export function validateConnectorScopes(
  provider: ConnectorProvider,
  requestedScopes?: string[],
): string[] {
  const entry = connectorCatalog[provider];
  const scopes = requestedScopes?.length ? unique(requestedScopes) : [...entry.defaultScopes];
  const rejected = scopes.filter((scope) => !entry.allowedScopes.includes(scope));
  if (rejected.length > 0) {
    throw new ConnectorScopeError(
      `Connector ${provider} cannot request non-minimal scopes: ${rejected.join(", ")}`,
    );
  }
  return scopes;
}

export type OAuthStart = {
  state: string;
  stateHash: string;
  codeVerifier: string;
  codeChallenge: string;
  authorizationUrl: string;
  scopes: string[];
  expiresAt: string;
};

async function pkceChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const hash = await subtle.digest("SHA-256", encoder.encode(codeVerifier));
  return Buffer.from(hash).toString("base64url");
}

export async function createOAuthStart(input: {
  provider: ConnectorProvider;
  clientId: string;
  redirectUri: string;
  organizationId: string;
  requestedScopes?: string[];
  ttlSeconds?: number;
  now?: Date;
}): Promise<OAuthStart> {
  const entry = connectorCatalog[input.provider];
  const scopes = validateConnectorScopes(input.provider, input.requestedScopes);
  const state = randomBytes(32).toString("base64url");
  const codeVerifier = randomBytes(48).toString("base64url");
  const codeChallenge = await pkceChallenge(codeVerifier);
  const stateHash = hashState(state);
  const expiresAt = new Date(
    (input.now?.getTime() ?? Date.now()) + (input.ttlSeconds ?? 600) * 1000,
  ).toISOString();
  const url = new URL(entry.authorizationUrl);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("scope", scopes.join(input.provider === "slack" ? "," : " "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");

  return {
    state,
    stateHash,
    codeVerifier,
    codeChallenge,
    authorizationUrl: url.toString(),
    scopes,
    expiresAt,
  };
}

export function hashState(state: string): string {
  return createHmac("sha256", process.env.API_KEY_HASH_PEPPER ?? API_KEY_PEPPER).update(state).digest("hex");
}

export function safeCompareStateHash(state: string, expectedHash: string): boolean {
  const supplied = Buffer.from(hashState(state), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export type EncryptedSecret = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

export function encryptSecret(plaintext: string, keyMaterial: string): EncryptedSecret {
  const key = deriveVaultKey(keyMaterial);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: ciphertext.toString("base64url"),
    iv: iv.toString("base64url"),
    authTag: authTag.toString("base64url"),
  };
}

export function decryptSecret(secret: EncryptedSecret, keyMaterial: string): string {
  const key = deriveVaultKey(keyMaterial);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(secret.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(secret.authTag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(secret.ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function createRevocationRequest(input: {
  provider: ConnectorProvider;
  token: string;
  clientId?: string;
}): { url: string; method: "POST"; body: URLSearchParams } | null {
  const entry = connectorCatalog[input.provider];
  if (!entry.revocationUrl) {
    return null;
  }
  const body = new URLSearchParams();
  body.set("token", input.token);
  if (input.clientId) {
    body.set("client_id", input.clientId);
  }
  return { url: entry.revocationUrl, method: "POST", body };
}

export function sanitizeConnectorResource(resource: ResourcePayload): {
  resource: Omit<ResourcePayload, "content"> & { sanitizedContent: string };
  counts: Record<string, number>;
} {
  const counts: Record<string, number> = {};
  const seen: Record<string, number> = {};
  const emailReplaced = resource.content.replace(
    /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi,
    () => {
      const type = "email";
      const index = seen[type] ?? 0;
      seen[type] = index + 1;
      counts[type] = (counts[type] ?? 0) + 1;
      return `[${type.toUpperCase()}_${index}]`;
    },
  );
  const apiKeyReplaced = emailReplaced.replace(
    /(sk-[A-Za-z0-9_-]{16,})/gi,
    () => {
      const type = "api_key";
      const index = seen[type] ?? 0;
      seen[type] = index + 1;
      counts[type] = (counts[type] ?? 0) + 1;
      return `[${type.toUpperCase()}_${index}]`;
    },
  );
  const sanitizedContent = apiKeyReplaced.replace(
    /(?<!\d)\d(?:[ -]?\d){12,18}(?!\d)/g,
    () => {
      const type = "payment_card";
      const index = seen[type] ?? 0;
      seen[type] = index + 1;
      counts[type] = (counts[type] ?? 0) + 1;
      return `[${type.toUpperCase()}_${index}]`;
    },
  );

  return {
    resource: {
      ...resource,
      sanitizedContent,
    },
    counts,
  };
}

function deriveVaultKey(keyMaterial: string): Buffer {
  const maybeBase64 = Buffer.from(keyMaterial, "base64");
  if (maybeBase64.length === 32) {
    return maybeBase64;
  }
  return createHmac("sha256", process.env.API_KEY_HASH_PEPPER ?? API_KEY_PEPPER).update(keyMaterial).digest();
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
