import { createHash } from "node:crypto";

import type { GatewayPrincipal } from "@oclushion/shared";

export interface ClientApiKeyResolver {
  resolve(apiKey: string, requiredScope: string): Promise<GatewayPrincipal | null>;
}

export type ApiKeySqlClient = {
  query(
    text: string,
    values: unknown[],
  ): Promise<{
    rowCount: number | null;
    rows: Array<{ id: string; organization_id: string; scopes: string[] }>;
  }>;
};

export class PostgresClientApiKeyResolver implements ClientApiKeyResolver {
  public constructor(private readonly client: ApiKeySqlClient) {}

  public async resolve(apiKey: string, requiredScope: string): Promise<GatewayPrincipal | null> {
    if (!isSupportedGatewayApiKey(apiKey)) {
      return null;
    }

    const keyHash = createHash("sha256").update(apiKey).digest("hex");
    const result = await this.client.query(
      `UPDATE client_api_keys
       SET last_used_at = NOW()
       WHERE key_hash = $1
         AND revoked_at IS NULL
         AND organization_id IS NOT NULL
         AND (expires_at IS NULL OR expires_at > NOW())
         AND $2 = ANY(scopes)
       RETURNING id, organization_id, scopes`,
      [keyHash, requiredScope],
    );

    const row = result.rows[0];
    return (result.rowCount ?? 0) === 1 && row
      ? {
          apiKeyId: row.id,
          organizationId: row.organization_id,
          scopes: row.scopes,
        }
      : null;
  }
}

function isSupportedGatewayApiKey(apiKey: string): boolean {
  if (apiKey.length < 32 || apiKey.length > 512) {
    return false;
  }
  let body: string;
  if (apiKey.startsWith("oclushion_live_")) {
    body = apiKey.slice("oclushion_live_".length);
  } else if (apiKey.startsWith("sano_live_")) {
    body = apiKey.slice("sano_live_".length);
  } else {
    return false;
  }
  return body.length > 0 && /^[a-f0-9_-]+$/i.test(body);
}
