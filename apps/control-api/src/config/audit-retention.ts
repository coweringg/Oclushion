export const RETENTION_TIERS: Record<string, number> = {
  free: 7,
  pro: 30,
  team: 90,
  business: 365,
  enterprise: 365,
};

export function getRetentionDays(plan: string): number {
  return RETENTION_TIERS[plan.toLowerCase()] ?? 30;
}
