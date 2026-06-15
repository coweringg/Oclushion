import { z } from "zod";
import type { OclushionSession } from "../auth.service";
import { getControlApiUrl, getStoredSession } from "../auth.service";
import { secureKeysService, type SecureKeysService } from "../llm/secure-keys.service";
import { logger } from "../utils/logger";
import type { EntitlementFeature, EntitlementSource, SubscriptionTier, UserEntitlements } from "./entitlements.types";
import { EntitlementsSyncError, PlanRestrictionError } from "./entitlements.types";
import { decodeLicenseToken, normalizeTier } from "./license-validator";

const serverAccessResultSchema = z.object({
  allowed: z.boolean(),
  reason: z.enum(["server_unavailable", "plan_expired", "feature_not_included"]).optional(),
  expiresAt: z.string().optional(),
});

export type ServerAccessResult = {
  allowed: boolean;
  reason?: "server_unavailable" | "plan_expired" | "feature_not_included";
  expiresAt?: string;
};

type EntitlementsStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const LEGACY_STORAGE_KEY = "oclushion.entitlements.license";

export class EntitlementsService {
  private currentEntitlements: UserEntitlements;

  public constructor(
    private readonly storage: EntitlementsStore | null = safeLocalStorage(),
    private readonly secureKeys: SecureKeysService = secureKeysService,
  ) {
    this.currentEntitlements = createEntitlements({ plan: "free", userId: "anonymous" });
  }

  public getCurrent(): UserEntitlements {
    return this.currentEntitlements;
  }

  public async loadSavedLicense(): Promise<UserEntitlements> {
    const token = await this.secureKeys.loadKey("license", "active");
    if (token) {
      const decoded = decodeLicenseToken(token);
      this.currentEntitlements = createEntitlements(decoded);
      return this.currentEntitlements;
    }

    const legacyKey = this.storage?.getItem(LEGACY_STORAGE_KEY);
    if (legacyKey) {
      await this.secureKeys.saveKey("license", "active", legacyKey);
      this.storage?.removeItem(LEGACY_STORAGE_KEY);
      return this.syncSubscription(legacyKey);
    }

    this.currentEntitlements = createEntitlements({ plan: "free", userId: "anonymous" });
    return this.currentEntitlements;
  }

  public updateFromSession(session: OclushionSession | null): UserEntitlements {
    this.currentEntitlements = createEntitlements(
      session
        ? {
            userId: session.user.id,
            plan: session.user.plan,
            status: "active",
            expiresAt: session.user.planRenewalDate,
          }
        : { plan: "free", userId: "anonymous" },
    );
    return this.currentEntitlements;
  }

  public async syncSubscription(licenseKey: string, bearerToken?: string): Promise<UserEntitlements> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(`${getControlApiUrl()}/v1/billing/entitlements`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
        },
        body: JSON.stringify({ licenseKey }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new EntitlementsSyncError(response.status, `Entitlements sync failed with HTTP ${response.status}`);
      }
      const payload = await response.json();
      this.currentEntitlements = normalizeEntitlementsPayload(payload);
      await this.secureKeys.saveKey("license", "active", licenseKey);
      return this.currentEntitlements;
    } finally {
      clearTimeout(timeout);
    }
  }

  public checkAccess(feature: EntitlementFeature): boolean {
    const value = this.currentEntitlements.features[feature];
    return typeof value === "number" ? value > 0 : value;
  }

  public async validateAccess(feature: EntitlementFeature): Promise<boolean> {
    if (!this.checkAccess(feature)) {
      return false;
    }
    try {
      const serverResult = await this.validateWithServer(feature);
      return serverResult.allowed;
    } catch {
      return false;
    }
  }

  public assertAccess(feature: EntitlementFeature, label: string = feature): void {
    const value = this.currentEntitlements.features[feature];
    if (!(typeof value === "number" ? value > 0 : value)) {
      throw new PlanRestrictionError(
        feature,
        `PLAN_RESTRICTION: ${label} is only available on Pro/Enterprise plans.`,
      );
    }
  }

  private async validateWithServer(feature: EntitlementFeature): Promise<ServerAccessResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    const session = getStoredSession();

    try {
      const response = await fetch(`${getControlApiUrl()}/v1/billing/check-access`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
        },
        body: JSON.stringify({ feature }),
        signal: controller.signal,
      });

      if (!response.ok) {
        return { allowed: false, reason: "server_unavailable" };
      }

      const accessParsed = serverAccessResultSchema.safeParse(await response.json());
      return accessParsed.success ? accessParsed.data : { allowed: false, reason: "server_unavailable" };
    } catch {
      return { allowed: false, reason: "server_unavailable" };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createEntitlements(source: EntitlementSource): UserEntitlements {
  const tier = normalizeTier(source.plan);
  return {
    userId: source.userId ?? "anonymous",
    tier,
    status: source.status === "trialing" || source.status === "canceled" || source.status === "past_due" ? source.status : "active",
    expiresAt: source.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    features: featureMatrix(tier),
  };
}

function normalizeEntitlementsPayload(payload: unknown): UserEntitlements {
  if (!payload || typeof payload !== "object") {
    throw new Error("Entitlements API returned an invalid payload.");
  }
  const value = payload as Partial<UserEntitlements> & EntitlementSource;
  if (value.features && typeof value.features === "object") {
    const tier = normalizeTier(value.tier ?? value.plan);
    const defaults = featureMatrix(tier);
    return {
      userId: value.userId ?? "anonymous",
      tier,
      status: value.status === "trialing" || value.status === "canceled" || value.status === "past_due" ? value.status : "active",
      expiresAt: value.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      features: { ...defaults, ...value.features },
    };
  }
  return createEntitlements(value);
}

function featureMatrix(tier: SubscriptionTier): UserEntitlements["features"] {
  if (tier === "enterprise") {
    return {
      maxDailyPrompts: Number.MAX_SAFE_INTEGER,
      hasVoiceDictation: true,
      hasFastApply: true,
      hasLivePreview: true,
      hasGodMode: true,
      hasMultiplayer: true,
      hasShipperAgent: true,
      hasAutoPromptEnhancer: true,
      hasMultiAgent: true,
      hasEnterpriseRegistry: true,
      hasEnterpriseSkills: true,
      hasEnterpriseAgents: true,
      hasEnterpriseHooks: true,
    };
  }
  if (tier === "pro") {
    return {
      maxDailyPrompts: Number.MAX_SAFE_INTEGER,
      hasVoiceDictation: true,
      hasFastApply: true,
      hasLivePreview: true,
      hasGodMode: true,
      hasMultiplayer: false,
      hasShipperAgent: false,
      hasAutoPromptEnhancer: true,
      hasMultiAgent: true,
      hasEnterpriseRegistry: false,
      hasEnterpriseSkills: false,
      hasEnterpriseAgents: false,
      hasEnterpriseHooks: false,
    };
  }
  return {
    maxDailyPrompts: 25,
    hasVoiceDictation: false,
    hasFastApply: false,
    hasLivePreview: false,
    hasGodMode: false,
    hasMultiplayer: false,
    hasShipperAgent: false,
    hasAutoPromptEnhancer: false,
    hasMultiAgent: false,
    hasEnterpriseRegistry: false,
    hasEnterpriseSkills: false,
    hasEnterpriseAgents: false,
    hasEnterpriseHooks: false,
  };
}

function safeLocalStorage(): EntitlementsStore | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch (error) {
    logger.debug('Entitlements', 'localStorage not available', error);
    return null;
  }
}
