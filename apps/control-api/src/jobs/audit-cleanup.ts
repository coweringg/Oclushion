import { getRetentionDays } from "../config/audit-retention.js";
import type { ControlRepository } from "../storage/repository.js";

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

export function startAuditCleanup(repository: ControlRepository): void {
  if (cleanupTimer) return;

  const run = async () => {
    try {
      const orgs = await repository.listOrganizations();
      for (const org of orgs) {
        const retentionDays = org.auditRetentionDays ?? getRetentionDays(org.plan);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        await repository.deleteAuditEventsOlderThan({
          organizationId: org.id,
          cutoffDate,
        });
      }
    } catch (error) {
      console.error("[audit-cleanup] Failed to run cleanup:", error);
    }
  };

  void run();
  cleanupTimer = setInterval(run, 60 * 60 * 1000);
}

export function stopAuditCleanup(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
