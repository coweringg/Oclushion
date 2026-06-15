import { compileSnapshot, type CompiledPolicySnapshot } from "@oclushion/policy-runtime";

export interface PolicySnapshotProvider {
  get(organizationId: string): Promise<CompiledPolicySnapshot | null>;
}

export class StaticPolicySnapshotProvider implements PolicySnapshotProvider {
  public constructor(private readonly snapshots: Map<string, CompiledPolicySnapshot>) {}

  public async get(organizationId: string): Promise<CompiledPolicySnapshot | null> {
    return this.snapshots.get(organizationId) ?? null;
  }
}

type CachedSnapshot = {
  snapshot: CompiledPolicySnapshot;
  refreshedAt: number;
};

export class ControlApiPolicySnapshotCache implements PolicySnapshotProvider {
  private readonly cached = new Map<string, CachedSnapshot>();
  private timer: NodeJS.Timeout | undefined;

  public constructor(
    private readonly controlApiUrl: string,
    private readonly internalToken: string,
    private readonly organizationIds: readonly string[],
    private readonly refreshMs: number,
    private readonly maxAgeMs: number,
  ) {}

  public async start(): Promise<void> {
    await this.refreshAll();
    this.timer = setInterval(() => {
      void this.refreshAll();
    }, this.refreshMs);
    this.timer.unref();
  }

  public async close(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  public async get(organizationId: string): Promise<CompiledPolicySnapshot | null> {
    const cached = this.cached.get(organizationId);
    if (!cached || Date.now() - cached.refreshedAt > this.maxAgeMs) {
      return null;
    }
    return cached.snapshot;
  }

  private async refreshAll(): Promise<void> {
    await Promise.all(this.organizationIds.map(async (id) => this.refresh(id)));
  }

  private async refresh(organizationId: string): Promise<void> {
    try {
      const base = this.controlApiUrl.replace(/\/+$/, "");
      const response = await fetch(
        `${base}/v1/internal/organizations/${organizationId}/modules/gateway-protect/snapshot`,
        { headers: { authorization: `Bearer ${this.internalToken}` } },
      );
      if (!response.ok) {
        return;
      }
      this.cached.set(organizationId, {
        snapshot: compileSnapshot(await response.json()),
        refreshedAt: Date.now(),
      });
    } catch {
    }
  }
}
