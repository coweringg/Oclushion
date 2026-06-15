import type { ControlRepository } from "../storage/repository.js"

export class TrialService {
  private readonly repository: ControlRepository

  constructor(repository: ControlRepository) {
    this.repository = repository
  }

  async startTrial(orgId: string): Promise<void> {
    await this.repository.startTrial({ organizationId: orgId })
  }

  async checkTrialStatus(orgId: string): Promise<{
    active: boolean
    expired?: boolean
    daysLeft?: number
    message?: string
    maxMembers?: number
  }> {
    return this.repository.getTrialStatus({ organizationId: orgId })
  }

  async convertTrialToPaid(orgId: string, plan: string): Promise<void> {
    await this.repository.convertTrialToPaid({ organizationId: orgId, plan })
  }

  async processExpiringTrials(emailService: { sendTrialExpiring: (input: {
    organizationId: string; organizationName: string; adminEmails: string[]; daysLeft: number
  }) => Promise<void> }): Promise<void> {
    const expiring = await this.repository.listExpiringTrials({ withinDays: 3 })

    for (const row of expiring) {
      const members = await this.repository.listOrganizationMembers({
        organizationId: row.organizationId,
      })
      const adminEmails = members
        .filter((m) => ["owner", "admin"].includes(m.role))
        .map((m) => m.email)

      const daysLeft = Math.ceil(
        (new Date(row.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      )

      await emailService.sendTrialExpiring({
        organizationId: row.organizationId,
        organizationName: row.organizationName,
        adminEmails,
        daysLeft,
      })
    }
  }
}