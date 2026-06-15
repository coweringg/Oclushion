import { randomUUID } from "node:crypto";
import { WorkOS } from "@workos-inc/node";
import type { ControlRepository } from "../storage/repository.js";

export type SSOProvider = "okta" | "entra_id" | "google_workspace" | "generic_oidc" | "generic_saml";

export type SSOConnection = {
  id: string;
  organizationId: string;
  provider: SSOProvider;
  domain: string;
  idpMetadata: Record<string, unknown> | null;
  clientId: string | null;
  enabled: boolean;
  roleMappings: Array<{ idpGroup: string; oclushionRole: string }>;
};

export type SSOProfile = {
  idpId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  organizationId?: string;
  idpProvider: string;
  groups?: string[];
};

type SSOFlowEntry = {
  status: "pending";
  organizationId: string;
  createdAt: number;
} | {
  status: "completed";
  organizationId: string;
  token: string;
  user: Record<string, unknown>;
  createdAt: number;
};

const FLOW_TTL_MS = 5 * 60 * 1000;

export class SSOService {
  private readonly client: WorkOS | null;
  private readonly flows = new Map<string, SSOFlowEntry>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  public constructor(
    private readonly repository: ControlRepository,
  ) {
    const apiKey = process.env.WORKOS_API_KEY ?? null;
    this.client = apiKey ? new WorkOS(apiKey) : null;
    if (this.client) this.startCleanup();
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [id, entry] of this.flows) {
        if (now - entry.createdAt > FLOW_TTL_MS) this.flows.delete(id);
      }
    }, 60_000);
  }

  public isEnabled(): boolean {
    return this.client !== null;
  }

  public async initiateFlow(connection: SSOConnection): Promise<{ redirectUrl: string; flowId: string }> {
    if (!this.client) throw new Error("SSO is not configured. Set WORKOS_API_KEY.");
    const baseUrl = process.env.CONTROL_API_URL ?? "http://localhost:3000";
    const flowId = randomUUID();
    const redirectUrl = this.client.sso.getAuthorizationUrl({
      connection: connection.id,
      clientId: process.env.WORKOS_CLIENT_ID ?? "",
      redirectUri: `${baseUrl}/v1/auth/sso/callback`,
      state: flowId,
    });
    this.flows.set(flowId, { status: "pending", organizationId: connection.organizationId, createdAt: Date.now() });
    return { redirectUrl, flowId };
  }

  public completeFlow(flowId: string, orgId: string, token: string, user: Record<string, unknown>): void {
    this.flows.set(flowId, { status: "completed", organizationId: orgId, token, user, createdAt: Date.now() });
  }

  public getFlowOrgId(flowId: string): string | null {
    const entry = this.flows.get(flowId);
    return entry ? entry.organizationId : null;
  }

  public pollFlow(flowId: string): { status: "pending" } | { status: "completed"; token: string; user: Record<string, unknown> } {
    const entry = this.flows.get(flowId);
    if (!entry || entry.status === "pending") return { status: "pending" };
    this.flows.delete(flowId);
    return { status: "completed", token: entry.token, user: entry.user };
  }

  public async getProfileFromCode(code: string): Promise<SSOProfile> {
    if (!this.client) throw new Error("SSO is not configured. Set WORKOS_API_KEY.");
    const clientId = process.env.WORKOS_CLIENT_ID ?? "";
    const { profile } = await this.client.sso.getProfileAndToken({ code, clientId });
    return {
      idpId: profile.id,
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      organizationId: profile.organizationId,
      idpProvider: "workos",
      groups: (profile.rawAttributes as Record<string, string[]>)?.groups ?? [],
    };
  }

  public async provisionUser(profile: SSOProfile, orgId: string): Promise<string> {
    const existing = await this.repository.getDesktopAuthUserByEmail({ email: profile.email }).catch(() => null);
    if (existing) return existing.userId;
    const user = await this.repository.createDesktopAuthUser({
      email: profile.email,
      displayName: [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.email,
      passwordHash: "",
      passwordSalt: "",
      passwordIterations: 0,
      idpId: profile.idpId,
      idpProvider: profile.idpProvider,
      authMethod: "sso",
    });
    return user.userId;
  }
}
