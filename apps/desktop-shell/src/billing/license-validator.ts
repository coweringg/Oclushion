import { z } from "zod";
import type { EntitlementSource, EntitlementStatus, SubscriptionTier } from "./entitlements.types";

const licensePayloadSchema = z.object({
  sub: z.string().optional(),
  userId: z.string().optional(),
  plan: z.string().optional(),
  tier: z.string().optional(),
  status: z.enum(["active", "trialing", "canceled", "past_due"]).optional(),
  exp: z.number().optional(),
  expiresAt: z.string().optional(),
});

export type DecodedLicense = EntitlementSource & {
  signatureVerified: boolean;
};

export function decodeLicenseToken(token: string): DecodedLicense {
  const [, payload] = token.split(".");
  if (!payload) {
    throw new Error("Invalid license token.");
  }
  const parsed = licensePayloadSchema.safeParse(JSON.parse(decodeBase64Url(payload)));
  const decoded = parsed.success ? parsed.data : {};
  return {
    userId: decoded.sub ?? decoded.userId,
    plan: decoded.plan ?? decoded.tier,
    status: decoded.status,
    expiresAt: typeof decoded.exp === "number" ? new Date(decoded.exp * 1000).toISOString() : decoded.expiresAt,
    signatureVerified: false,
  };
}

export function normalizeTier(value: unknown): SubscriptionTier {
  if (typeof value !== "string") {
    return "free";
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "pro") {
    return "pro";
  }
  if (normalized === "team" || normalized === "teams" || normalized === "enterprise") {
    return "enterprise";
  }
  return "free";
}

function normalizeStatus(value: unknown): EntitlementStatus | undefined {
  if (value === "active" || value === "trialing" || value === "canceled" || value === "past_due") {
    return value;
  }
  return undefined;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/gu, "+").replace(/_/gu, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return atob(padded);
}
