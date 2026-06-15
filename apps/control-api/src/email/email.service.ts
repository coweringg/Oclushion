type EmailProvider = {
  send(input: { to: string; subject: string; html: string }): Promise<void>
}

class ResendProvider implements EmailProvider {
  private readonly apiKey: string

  constructor() {
    this.apiKey = process.env.RESEND_API_KEY ?? ""
    if (!this.apiKey) {
      console.warn("RESEND_API_KEY is not configured. Emails will be logged instead of sent.")
    }
  }

  async send(input: { to: string; subject: string; html: string }): Promise<void> {
    if (!this.apiKey) {
      console.log("[email mock]", input)
      return
    }
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "Oclushion <team@oclushion.com>", ...input }),
    })
    if (!response.ok) {
      throw new Error(`Resend API error: ${response.status} ${await response.text()}`)
    }
  }
}

class SendGridProvider implements EmailProvider {
  private readonly apiKey: string

  constructor() {
    this.apiKey = process.env.SENDGRID_API_KEY ?? ""
  }

  async send(input: { to: string; subject: string; html: string }): Promise<void> {
    if (!this.apiKey) {
      console.log("[email mock]", input)
      return
    }
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: input.to }] }],
        from: { email: "team@oclushion.com", name: "Oclushion" },
        subject: input.subject,
        content: [{ type: "text/html", value: input.html }],
      }),
    })
    if (!response.ok) {
      throw new Error(`SendGrid API error: ${response.status} ${await response.text()}`)
    }
  }
}

export class EmailService {
  private readonly provider: EmailProvider
  private readonly webAppUrl: string

  constructor() {
    const providerName = process.env.EMAIL_PROVIDER ?? "resend"
    this.provider = providerName === "sendgrid" ? new SendGridProvider() : new ResendProvider()
    this.webAppUrl = process.env.OCLUSHION_WEB_APP_URL ?? "https://oclushion.com"
  }

  async sendOrgInvitation(input: {
    invitationId: string
    email: string
    invitationCode: string
    inviterName: string
    inviterEmail: string
    orgName: string
  }): Promise<void> {
    await this.provider.send({
      to: input.email,
      subject: `${input.inviterName ?? input.inviterEmail} invited you to ${input.orgName} on Oclushion`,
      html: `
        <h1>You've been invited to <strong>${input.orgName}</strong></h1>
        <p>${input.inviterName ?? input.inviterEmail} invited you to join their team on Oclushion.</p>
        <p style="text-align:center;margin:32px 0">
          <a href="${this.webAppUrl}/accept-invitation/${input.invitationCode}"
             style="background:#000;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
            Accept Invitation
          </a>
        </p>
        <p>This invitation expires in 7 days.</p>
        <p style="color:#888;font-size:12px">
          Don't have Oclushion?
          <a href="${this.webAppUrl}/download">Download the desktop app here</a>
        </p>
      `,
    })
  }

  async sendTrialExpiring(input: {
    organizationId: string
    organizationName: string
    adminEmails: string[]
    daysLeft: number
  }): Promise<void> {
    for (const email of input.adminEmails) {
      await this.provider.send({
        to: email,
        subject: `Your Oclushion trial for ${input.organizationName} ends in ${input.daysLeft} days`,
        html: `
          <h1>Your trial is ending</h1>
          <p>Your 14-day trial for <strong>${input.organizationName}</strong> ends in ${input.daysLeft} days.</p>
          <p style="text-align:center;margin:32px 0">
            <a href="${this.webAppUrl}/billing/upgrade?org=${input.organizationId}"
               style="background:#000;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
              Upgrade Now
            </a>
          </p>
          <p style="color:#888;font-size:12px">
            Keep your team's access to all Oclushion Enterprise features.
          </p>
        `,
      })
    }
  }

  async sendPairingCode(input: {
    email: string
    code: string
    organizationName: string
  }): Promise<void> {
    await this.provider.send({
      to: input.email,
      subject: `Your Oclushion pairing code for ${input.organizationName}`,
      html: `
        <h1>Your pairing code</h1>
        <p>Use this code to connect your desktop shell to <strong>${input.organizationName}</strong>:</p>
        <p style="text-align:center;font-size:32px;font-weight:bold;letter-spacing:4px;margin:24px 0">
          ${input.code}
        </p>
        <p>This code expires in 1 hour.</p>
        <p style="color:#888;font-size:12px">
          Open Oclushion → Settings → Organization → Enter pairing code
        </p>
      `,
    })
  }
}