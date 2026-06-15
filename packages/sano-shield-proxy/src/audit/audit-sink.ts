import type { PolicyEffect, ProxyProvider, SensitiveEntityType } from "@oclushion/shared";

export type AuditEvent = {
  requestId: string;
  organizationId: string;
  apiKeyId: string;
  provider: ProxyProvider;
  decision: PolicyEffect;
  policyId: string;
  policyVersionId: string;
  detectionCounts: Partial<Record<SensitiveEntityType, number>>;
  status: "allowed" | "blocked" | "pending_approval" | "failed";
  eventType: string;
  upstreamStatus?: number;
  overheadMs: number;
  createdAt: Date;
};

export interface AuditSink {
  record(event: AuditEvent): Promise<void>;
}

export class NoopAuditSink implements AuditSink {
  public async record(_event: AuditEvent): Promise<void> {
    void _event;
  }
}

export type SqlQueryClient = {
  query(text: string, values: unknown[]): Promise<unknown>;
};

export class PostgresPlatformAuditSink implements AuditSink {
  public constructor(private readonly client: SqlQueryClient) {}

  public async record(event: AuditEvent): Promise<void> {
    await this.client.query(
      `INSERT INTO platform_audit_events
        (organization_id, api_key_id, request_id, module_name, event_type, decision,
         policy_id, policy_version_id, provider, upstream_status, detection_counts,
         status, latency_ms, metadata, occurred_at)
       VALUES ($1, $2, $3, 'gateway-protect', $4, $5, $6, $7, $8, $9,
               $10::jsonb, $11, $12, '{}'::jsonb, $13)`,
      [
        event.organizationId,
        event.apiKeyId,
        event.requestId,
        event.eventType,
        event.decision,
        event.policyId,
        event.policyVersionId,
        event.provider,
        event.upstreamStatus ?? null,
        JSON.stringify(event.detectionCounts),
        event.status,
        event.overheadMs,
        event.createdAt,
      ],
    );
  }
}
