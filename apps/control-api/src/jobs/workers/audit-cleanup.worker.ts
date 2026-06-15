import type { Job } from "bullmq";
import type { ControlRepository } from "../../storage/repository.js";
import { getRetentionDays } from "../../config/audit-retention.js";
import type { JobPayloads } from "../queue.service.js";

export function createAuditCleanupHandler(repository: ControlRepository) {
  return async (job: Job<JobPayloads["audit:cleanup"]>): Promise<{ status: string; orgsProcessed: number }> => {
    const retentionDays = job.data.retentionDays ?? 90;
    console.log(`[AuditCleanup] Running cleanup with ${retentionDays}d retention`);
    try {
      const orgs = await repository.listOrganizations();
      let processed = 0;
      for (const org of orgs) {
        const days = org.auditRetentionDays ?? getRetentionDays(org.plan);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        await repository.deleteAuditEventsOlderThan({ organizationId: org.id, cutoffDate });
        processed++;
        await job.updateProgress(Math.round((processed / orgs.length) * 100));
      }
      return { status: "completed", orgsProcessed: processed };
    } catch (error) {
      console.error("[AuditCleanup] Failed:", error);
      return { status: "failed", orgsProcessed: 0 };
    }
  };
}
