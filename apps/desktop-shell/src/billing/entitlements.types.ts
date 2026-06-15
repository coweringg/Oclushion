import type { OclushionPlan } from "../auth.service";

export type SubscriptionTier = "free" | "pro" | "enterprise";

export type EntitlementFeature =
  | "maxDailyPrompts"
  | "hasVoiceDictation"
  | "hasFastApply"
  | "hasLivePreview"
  | "hasGodMode"
  | "hasMultiplayer"
  | "hasShipperAgent"
  | "hasAutoPromptEnhancer"
  | "hasMultiAgent"
  | "hasEnterpriseRegistry"
  | "hasEnterpriseSkills"
  | "hasEnterpriseAgents"
  | "hasEnterpriseHooks";

export type EntitlementStatus = "active" | "trialing" | "canceled" | "past_due";

export type UserEntitlements = {
  userId: string;
  tier: SubscriptionTier;
  status: EntitlementStatus;
  expiresAt: string;
  features: {
    maxDailyPrompts: number;
    hasVoiceDictation: boolean;
    hasFastApply: boolean;
    hasLivePreview: boolean;
    hasGodMode: boolean;
    hasMultiplayer: boolean;
    hasShipperAgent: boolean;
    hasAutoPromptEnhancer: boolean;
    hasMultiAgent: boolean;
    hasEnterpriseRegistry: boolean;
    hasEnterpriseSkills: boolean;
    hasEnterpriseAgents: boolean;
    hasEnterpriseHooks: boolean;
  };
};

export type EntitlementSource = {
  userId?: string;
  plan?: OclushionPlan | SubscriptionTier | string;
  status?: EntitlementStatus | string;
  expiresAt?: string;
};

export class PlanRestrictionError extends Error {
  public readonly code = "PLAN_RESTRICTION";

  public constructor(
    public readonly feature: EntitlementFeature,
    message: string,
  ) {
    super(message);
    this.name = "PlanRestrictionError";
  }
}

export class EntitlementsSyncError extends Error {
  public readonly code = "ENTITLEMENTS_SYNC";

  public constructor(
    public readonly statusCode: number,
    message: string,
    public readonly retryable: boolean = statusCode >= 500,
  ) {
    super(message);
    this.name = "EntitlementsSyncError";
  }
}
