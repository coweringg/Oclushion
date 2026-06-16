import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import Stripe from "stripe";
import { z } from "zod";

import { requirePermission } from "../auth/rbac.middleware.js";
import { SSOService, type SSOConnection } from "../auth/sso.service.js";
import { CREDIT_PACKAGES, type CreditPackageId } from "../billing/pricing.config.js";
import { TrialService } from "../billing/trial.service.js";
import { EmailService } from "../email/email.service.js";
import type { ControlRepository, DesktopAuthUser } from "../storage/repository.js";
import { RepositoryConflictError } from "../storage/repository.js";
import { s } from "./schema-helpers.js";
import { KeySet } from "../auth/key-set.js";
import { inc, set } from "../metrics/metrics.js";
import {
  verifyTotpToken,
  generateTotpSecret,
  generateRecoveryCodes,
  verifyRecoveryCode,
  buildTotpUri,
} from "../auth/totp.service.js";
import { createMfaSetupTracker, type MfaSetupTracker } from "../auth/mfa-tracker.js";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const IP_MAX_ATTEMPTS = 20;
const IP_WINDOW_MS = 15 * 60 * 1000;

const loginAttempts = new Map<string, { count: number; firstAttempt: number; lockedUntil: number }>();
const ipAttempts = new Map<string, { emails: Set<string>; count: number; firstAttempt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of loginAttempts) {
    if (now > val.lockedUntil && now - val.firstAttempt > LOCKOUT_WINDOW_MS) loginAttempts.delete(key);
  }
  for (const [key, val] of ipAttempts) {
    if (now - val.firstAttempt > IP_WINDOW_MS) ipAttempts.delete(key);
  }
  set("oclushion_locked_accounts_total", getLockedAccountCount());
}, 60_000).unref();

function checkLoginLockout(email: string, ip: string): { allowed: boolean; reason?: string; retryAfter?: number } {
  const now = Date.now();
  const entry = loginAttempts.get(email);
  if (entry && now < entry.lockedUntil) {
    return { allowed: false, reason: "Account temporarily locked due to too many failed attempts.", retryAfter: Math.ceil((entry.lockedUntil - now) / 1000) };
  }
  if (entry && now - entry.firstAttempt > LOCKOUT_WINDOW_MS) {
    loginAttempts.delete(email);
  }
  const ipEntry = ipAttempts.get(ip);
  if (ipEntry && ipEntry.count >= IP_MAX_ATTEMPTS && now - ipEntry.firstAttempt < IP_WINDOW_MS) {
    return { allowed: false, reason: "Too many login attempts from this IP. Try again later.", retryAfter: Math.ceil((ipEntry.firstAttempt + IP_WINDOW_MS - now) / 1000) };
  }
  return { allowed: true };
}

function getLockedAccountCount(): number {
  const now = Date.now();
  let count = 0;
  for (const [, val] of loginAttempts) {
    if (now < val.lockedUntil) count++;
  }
  return count;
}

function recordLoginFailure(email: string, ip: string): void {
  const now = Date.now();
  let entry = loginAttempts.get(email);
  if (!entry || now - entry.firstAttempt > LOCKOUT_WINDOW_MS) {
    entry = { count: 0, firstAttempt: now, lockedUntil: 0 };
    loginAttempts.set(email, entry);
  }
  entry.count++;
  if (entry.count >= MAX_LOGIN_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_DURATION_MS;
  }
  let ipEntry = ipAttempts.get(ip);
  if (!ipEntry || now - ipEntry.firstAttempt > IP_WINDOW_MS) {
    ipEntry = { emails: new Set(), count: 0, firstAttempt: now };
    ipAttempts.set(ip, ipEntry);
  }
  ipEntry.emails.add(email);
  ipEntry.count++;
}

function recordLoginSuccess(email: string, ip: string): void {
  loginAttempts.delete(email);
  const ipEntry = ipAttempts.get(ip);
  if (ipEntry) {
    ipEntry.emails.delete(email);
    if (ipEntry.emails.size === 0) ipAttempts.delete(ip);
  }
}

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(512),
});
const registerSchema = loginSchema.extend({
  name: z.string().trim().min(1).max(120),
});

const auditBatchSchema = z.object({
  organizationId: z.uuid(),
  events: z.array(
    z.object({
      type: z.string().min(2).max(80),
      summary: z.string().min(1).max(500),
      timestamp: z.string().datetime(),
      metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
    }),
  ).max(100),
});
const checkoutSchema = z.object({
  packageId: z.enum(["credits_20k", "credits_100k"]).default("credits_20k"),
});
const spendCapSchema = z.object({
  dailySpendLimit: z.number().int().nonnegative().max(10_000_000),
});

const desktopRoutes: FastifyPluginAsync<{
  repository: ControlRepository;
  sessionSecret: string;
  keySet?: KeySet;
  mfaTracker?: MfaSetupTracker;
}> = async (app, options) => {
  const mfaTracker = options.mfaTracker ?? createMfaSetupTracker();
  app.register(async (authApp) => {
    authApp.post("/v1/auth/register", { schema: s(["Auth"], "Register a new user account", "authRegister") }, async (request, reply) => {
    const body = registerSchema.parse(request.body);
    if (!isPasswordStrong(body.password)) {
      return reply.code(400).send({
        error: "Weak password. Must contain: uppercase, lowercase, number, and special character.",
      });
    }
    const password = hashPassword(body.password);
    try {
      const user = await options.repository.createDesktopAuthUser({
        email: body.email,
        displayName: body.name,
        passwordHash: password.hash,
        passwordSalt: password.salt,
        passwordIterations: password.iterations,
      });
      return reply.code(201).send(createSessionResponse(user, options.sessionSecret, options.keySet));
    } catch (error) {
      if (error instanceof RepositoryConflictError) {
        return reply.code(409).send({ error: error.message });
      }
      throw error;
    }
  });

  authApp.post("/v1/auth/login", { schema: s(["Auth"], "Login with email and password", "authLogin") }, async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const clientIp = request.ip;
    const lockout = checkLoginLockout(body.email, clientIp);
    if (!lockout.allowed) {
      return reply.code(429).send({ error: lockout.reason, retryAfter: lockout.retryAfter });
    }
    const user = await options.repository.getDesktopAuthUserByEmail({ email: body.email }).catch(() => null);
    inc("oclushion_login_attempts_total");
    if (!user || !verifyPassword(body.password, user)) {
      recordLoginFailure(body.email, clientIp);
      inc("oclushion_login_failure_total");
      return reply.code(401).send({ error: "Invalid credentials." });
    }
    recordLoginSuccess(body.email, clientIp);
    inc("oclushion_login_success_total");
    if (user.totpEnabledAt) {
      inc("oclushion_mfa_challenges_total");
      const mfaToken = signMfaChallengeToken(user, options.sessionSecret, options.keySet);
      return { mfaRequired: true, mfaToken };
    }
    return createSessionResponse(user, options.sessionSecret, options.keySet);
  });
  }, { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } });

  const mfaChallengeSchema = z.object({
    mfaToken: z.string().min(1),
    code: z.string().min(1).max(20),
  });

  app.post("/v1/auth/mfa/challenge", { schema: s(["Auth"], "Complete MFA challenge with TOTP or recovery code", "mfaChallenge") }, async (request, reply) => {
    const body = mfaChallengeSchema.parse(request.body);
    const payload = verifyMfaChallengeToken(body.mfaToken, options.sessionSecret, options.keySet);
    if (!payload) {
      return reply.code(401).send({ error: "Invalid or expired MFA challenge token." });
    }
    const user = await options.repository.getDesktopAuthUser({ userId: payload.sub });
    if (!user.totpEnabledAt || !user.totpSecret) {
      return reply.code(400).send({ error: "MFA is not enabled for this account." });
    }
    if (verifyTotpToken(body.code, user.totpSecret)) {
      inc("oclushion_mfa_success_total");
      return createSessionResponse(user, options.sessionSecret, options.keySet);
    }
    const recoveryResult = user.totpRecoveryCodes
      ? verifyRecoveryCode(body.code, user.totpRecoveryCodes)
      : { valid: false, index: -1 };
    if (recoveryResult.valid) {
      inc("oclushion_mfa_recovery_used_total");
      await options.repository.consumeMfaRecoveryCode({ userId: user.userId, codeIndex: recoveryResult.index });
      return createSessionResponse(user, options.sessionSecret, options.keySet);
    }
    inc("oclushion_mfa_failure_total");
    return reply.code(401).send({ error: "Invalid MFA code." });
  });

  const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(request as unknown as Record<string, unknown>).session) {
      return reply.code(401).send({ error: "Valid Oclushion desktop session required." });
    }
  };

  app.post("/v1/auth/mfa/setup", { preHandler: [requireAuth], schema: s(["Auth"], "Generate MFA setup secret and recovery codes", "mfaSetup") }, async (request, reply) => {
    const session = (request as unknown as Record<string, unknown>).session as { sub: string; email: string };
    const user = await options.repository.getDesktopAuthUser({ userId: session.sub });
    if (user.totpEnabledAt) {
      return reply.code(409).send({ error: "MFA is already enabled for this account." });
    }
    if (await mfaTracker.isInProgress(user.userId)) {
      return reply.code(409).send({ error: "MFA setup is already in progress for this account." });
    }
    await mfaTracker.markInProgress(user.userId);
    const secret = generateTotpSecret();
    const recovery = generateRecoveryCodes();
    const uri = buildTotpUri(secret.base32, user.email);
    return {
      secret: secret.base32,
      uri,
      recoveryCodes: recovery.plain,
    };
  });

  app.post("/v1/auth/mfa/verify", { preHandler: [requireAuth], schema: s(["Auth"], "Verify TOTP code and enable MFA", "mfaVerify") }, async (request, reply) => {
    const body = z.object({ code: z.string().length(6), secret: z.string().min(16) }).parse(request.body);
    const session = (request as unknown as Record<string, unknown>).session as { sub: string; email: string };
    if (!verifyTotpToken(body.code, body.secret)) {
      return reply.code(400).send({ error: "Invalid TOTP code. Please try again." });
    }
    const user = await options.repository.getDesktopAuthUser({ userId: session.sub });
    const recovery = generateRecoveryCodes();
    await options.repository.enableMfa({
      userId: user.userId,
      totpSecret: body.secret,
      recoveryCodes: recovery.hashed,
    });
    return { enabled: true, recoveryCodes: recovery.plain };
  });

  app.post("/v1/auth/mfa/disable", { preHandler: [requireAuth], schema: s(["Auth"], "Disable MFA for the current user", "mfaDisable") }, async (request, reply) => {
    const session = (request as unknown as Record<string, unknown>).session as { sub: string };
    const user = await options.repository.getDesktopAuthUser({ userId: session.sub });
    if (!user.totpEnabledAt) {
      return reply.code(400).send({ error: "MFA is not enabled for this account." });
    }
    await options.repository.disableMfa({ userId: user.userId });
    return { disabled: true };
  });

  app.get("/v1/desktop/credits/balance", { preHandler: [requireAuth, requirePermission("billing:read")], schema: s(["Billing"], "Get credit balance for desktop", "desktopGetCreditBalance") }, async (request, _reply) => {
    const session = (request as unknown as Record<string, unknown>).session as { organizationId: string };
    return options.repository.getCreditBalance({ organizationId: session.organizationId });
  });

  app.get("/v1/desktop/spend-cap", { preHandler: [requireAuth, requirePermission("billing:read")], schema: s(["Billing"], "Get daily spend cap", "desktopGetSpendCap") }, async (request, _reply) => {
    const session = (request as unknown as Record<string, unknown>).session as { organizationId: string };
    return options.repository.getSpendCap({ organizationId: session.organizationId });
  });

  app.put("/v1/desktop/spend-cap", { preHandler: [requireAuth, requirePermission("billing:manage")], schema: s(["Billing"], "Update daily spend cap", "desktopUpdateSpendCap") }, async (request, _reply) => {
    const session = (request as unknown as Record<string, unknown>).session as { organizationId: string };
    const body = spendCapSchema.parse(request.body);
    return options.repository.updateSpendCap({
      organizationId: session.organizationId,
      dailySpendLimit: body.dailySpendLimit,
    });
  });

  app.post("/v1/billing/create-checkout-session", { preHandler: [requireAuth, requirePermission("billing:manage")], schema: s(["Billing"], "Create Stripe checkout session", "createCheckoutSession") }, async (request, reply) => {
    const session = (request as unknown as Record<string, unknown>).session as { sub: string; organizationId: string };
    const body = checkoutSchema.parse(request.body ?? {});
    const creditPackage = CREDIT_PACKAGES[body.packageId as CreditPackageId];
    const stripe = getStripeClient();
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: process.env.OCLUSHION_BILLING_SUCCESS_URL ?? "https://oclushion.com/billing/success",
      cancel_url: process.env.OCLUSHION_BILLING_CANCEL_URL ?? "https://oclushion.com/billing/cancel",
      client_reference_id: session.organizationId,
      metadata: {
        organizationId: session.organizationId,
        userId: session.sub,
        packageId: creditPackage.id,
        credits: String(creditPackage.credits),
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: creditPackage.currency,
            unit_amount: creditPackage.amountCents,
            product_data: {
              name: creditPackage.label,
              description: "Oclushion managed AI credits",
            },
          },
        },
      ],
    });
    return reply.code(201).send({ url: checkout.url });
  });

  app.register(async (webhookApp) => {
    webhookApp.addContentTypeParser(
      "application/json",
      { parseAs: "buffer" },
      (_request, body, done) => done(null, body),
    );
    webhookApp.post("/v1/billing/webhook", { schema: s(["Billing"], "Stripe webhook handler", "stripeWebhook") }, async (request, reply) => {
      const signature = request.headers["stripe-signature"];
      if (typeof signature !== "string") {
        return reply.code(400).send({ error: "Missing Stripe signature." });
      }
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        return reply.code(500).send({ error: "Stripe webhook secret is not configured." });
      }
      const rawBody = request.body instanceof Buffer ? request.body : Buffer.from("");
      const event = getStripeClient().webhooks.constructEvent(rawBody, signature, webhookSecret);
      if (event.type === "checkout.session.completed") {
        const checkout = event.data.object as Stripe.Checkout.Session;
        const organizationId = checkout.metadata?.organizationId;
        const userId = checkout.metadata?.userId;
        const credits = Number.parseInt(checkout.metadata?.credits ?? "0", 10);
        if (organizationId && Number.isInteger(credits) && credits > 0) {
          await options.repository.grantCredits({
            organizationId,
            userId: userId || undefined,
            credits,
            provider: "stripe",
            idempotencyKey: `stripe:${checkout.id}`,
            metadata: {
              checkoutSessionId: checkout.id,
              packageId: checkout.metadata?.packageId ?? "unknown",
            },
          });
        }
      }
      return reply.code(200).send({ received: true });
    });
  });

  const ssoService = new SSOService(options.repository);

  app.post("/v1/auth/sso/authorize", { schema: s(["SSO"], "Begin SSO authorization flow", "ssoAuthorize") }, async (request, reply) => {
    const body = z.object({ domain: z.string().min(1).max(255) }).parse(request.body);
    const row = await options.repository.getSSOConnectionByDomain({ domain: body.domain });
    if (!row) {
      return reply.code(404).send({ error: "No SSO connection found for this domain." });
    }
    if (!ssoService.isEnabled()) {
      return reply.code(501).send({ error: "SSO is not configured on this server." });
    }
    const connection: SSOConnection = { ...row, provider: row.provider as SSOConnection["provider"] };
    const { redirectUrl, flowId } = await ssoService.initiateFlow(connection);
    return reply.send({ redirectUrl, flowId });
  });

  app.get("/v1/auth/sso/callback", { schema: s(["SSO"], "Handle SSO OIDC callback", "ssoCallback") }, async (request, reply) => {
    const query = z.object({ code: z.string(), state: z.string().optional() }).parse(request.query);
    const profile = await ssoService.getProfileFromCode(query.code);
    const flowId = query.state;
    const orgId = (flowId ? ssoService.getFlowOrgId(flowId) : null) ?? profile.organizationId ?? "";
    if (!orgId) {
      return reply.code(400).send({ error: "Could not determine organization." });
    }
    void await ssoService.provisionUser(profile, orgId);
    await options.repository.upsertOrganizationMember({
      organizationId: orgId,
      email: profile.email,
      role: "developer",
      displayName: [profile.firstName, profile.lastName].filter(Boolean).join(" ") || undefined,
    });
    const user = await options.repository.getDesktopAuthUserByEmail({ email: profile.email });
    const token = signSessionToken(user, options.sessionSecret, options.keySet);
    const serialized = serializeUser(user);
    ssoService.completeFlow(flowId ?? "", orgId, token, serialized);
    if (request.headers.accept?.includes("text/html")) {
      return reply.type("text/html").send(
        `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Oclushion SSO</title></head><body style="font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f5f5f5"><div style="text-align:center;background:#fff;padding:48px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.1)"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><h1 style="margin-top:16px;font-size:24px">Signed in successfully</h1><p style="color:#666;font-size:14px">You can close this browser tab and return to Oclushion.</p></div></body></html>`,
      );
    }
    return reply.send({ token, user: serialized });
  });

  app.get("/v1/auth/sso/poll", { schema: s(["SSO"], "Poll for SSO completion", "ssoPoll") }, async (request, reply) => {
    const query = z.object({ flowId: z.string().uuid() }).parse(request.query);
    const result = ssoService.pollFlow(query.flowId);
    return reply.send(result);
  });

  app.get("/v1/orgs/:organizationId/sso", { preHandler: [requireAuth, requirePermission("org:manage")], schema: s(["SSO"], "List SSO connections", "listSsoConnections") }, async (request, reply) => {
    const session = getSession(request);
    const params = z.object({ organizationId: z.uuid() }).parse(request.params);
    if (session.organizationId !== params.organizationId) {
      return reply.code(403).send({ error: "Not a member of this organization." });
    }
    const connections = await options.repository.listSSOConnections({ organizationId: params.organizationId });
    return reply.send({ connections });
  });

  app.post("/v1/orgs/:organizationId/sso", { preHandler: [requireAuth, requirePermission("org:manage")], schema: s(["SSO"], "Create or update SSO connection", "upsertSsoConnection") }, async (request, reply) => {
    const session = getSession(request);
    const params = z.object({ organizationId: z.uuid() }).parse(request.params);
    if (session.organizationId !== params.organizationId) {
      return reply.code(403).send({ error: "Not a member of this organization." });
    }
    const body = z.object({
      provider: z.enum(["okta", "entra_id", "google_workspace", "generic_oidc", "generic_saml"]),
      domain: z.string().min(1).max(255),
      idpMetadata: z.record(z.string(), z.unknown()).optional(),
      clientId: z.string().optional(),
      clientSecret: z.string().optional(),
      roleMappings: z.array(z.object({ idpGroup: z.string(), oclushionRole: z.string() })).optional(),
    }).parse(request.body);
    await options.repository.upsertSSOConnection({
      organizationId: params.organizationId,
      provider: body.provider,
      domain: body.domain,
      idpMetadata: body.idpMetadata,
      clientId: body.clientId,
      clientSecret: body.clientSecret,
      roleMappings: body.roleMappings,
    });
    return reply.code(201).send({ ok: true });
  });

  app.delete("/v1/orgs/:organizationId/sso/:connectionId", { preHandler: [requireAuth, requirePermission("org:manage")], schema: s(["SSO"], "Delete SSO connection", "deleteSsoConnection") }, async (request, reply) => {
    const session = getSession(request);
    const params = z.object({ organizationId: z.uuid(), connectionId: z.uuid() }).parse(request.params);
    if (session.organizationId !== params.organizationId) {
      return reply.code(403).send({ error: "Not a member of this organization." });
    }
    await options.repository.deleteSSOConnection({
      organizationId: params.organizationId,
      connectionId: params.connectionId,
    });
    return reply.code(204).send();
  });

  app.post("/v1/orgs/:organizationId/scim/tokens", { preHandler: [requireAuth, requirePermission("org:manage")], schema: s(["SCIM"], "Create SCIM token", "createScimToken") }, async (request, reply) => {
    const session = getSession(request);
    const params = z.object({ organizationId: z.uuid() }).parse(request.params);
    if (session.organizationId !== params.organizationId) {
      return reply.code(403).send({ error: "Not a member of this organization." });
    }
    const body = z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      expiresAt: z.string().datetime().optional(),
    }).parse(request.body);
    const { randomBytes, createHash } = await import("node:crypto");
    const raw = randomBytes(32).toString("hex");
    const token = `scim_${raw}`;
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const tokenPrefix = token.slice(0, 12);
    const result = await options.repository.createScimToken({
      organizationId: params.organizationId,
      tokenHash,
      tokenPrefix,
      name: body.name,
      description: body.description,
      expiresAt: body.expiresAt,
    });
    return reply.code(201).send({ id: result.id, token, tokenPrefix });
  });

  app.get("/v1/orgs/:organizationId/scim/tokens", { preHandler: [requireAuth, requirePermission("org:manage")], schema: s(["SCIM"], "List SCIM tokens", "listScimTokens") }, async (request, reply) => {
    const session = getSession(request);
    const params = z.object({ organizationId: z.uuid() }).parse(request.params);
    if (session.organizationId !== params.organizationId) {
      return reply.code(403).send({ error: "Not a member of this organization." });
    }
    const tokens = await options.repository.listScimTokens({ organizationId: params.organizationId });
    return reply.send({ tokens });
  });

  app.delete("/v1/orgs/:organizationId/scim/tokens/:tokenId", { preHandler: [requireAuth, requirePermission("org:manage")], schema: s(["SCIM"], "Revoke SCIM token", "revokeScimToken") }, async (request, reply) => {
    const session = getSession(request);
    const params = z.object({ organizationId: z.uuid(), tokenId: z.uuid() }).parse(request.params);
    if (session.organizationId !== params.organizationId) {
      return reply.code(403).send({ error: "Not a member of this organization." });
    }
    await options.repository.revokeScimToken({ organizationId: params.organizationId, tokenId: params.tokenId });
    return reply.code(204).send();
  });

  app.get("/v1/desktop/policies/snapshot", { preHandler: [requireAuth, requirePermission("org:read")], schema: s(["Policies"], "Get bound policy snapshots for desktop", "desktopGetPolicySnapshot") }, async (request, reply) => {
    const session = (request as unknown as Record<string, unknown>).session as { organizationId: string };
    const snapshots = await options.repository.listBoundPublishedSnapshots({
      organizationId: session.organizationId,
    });
    return reply.send({ snapshots });
  });

  app.get("/v1/desktop/audit-events/export", { preHandler: [requireAuth, requirePermission("audit:export")], schema: s(["Audit"], "Export audit events as JSON or CSV", "exportAuditEvents") }, async (request, reply) => {
    const session = (request as unknown as Record<string, unknown>).session as { organizationId: string };
    const query = z.object({
      format: z.enum(["json", "csv"]).default("json"),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
    }).parse(request.query);

    const events = await options.repository.exportAuditEvents({
      organizationId: session.organizationId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });

    if (query.format === "csv") {
      const header = "id,event_type,status,decision,actor_id,occurred_at,summary";
      const rows = events.map((e) =>
        `"${e.id}","${e.eventType}","${e.status}","${e.decision ?? ""}","${e.actorId ?? ""}","${e.occurredAt}","${e.summary.replace(/"/g, '""')}"`,
      );
      reply.header("Content-Type", "text/csv");
      reply.header("Content-Disposition", `attachment; filename="audit-${session.organizationId}-${Date.now()}.csv"`);
      return [header, ...rows].join("\n");
    }

    return reply.send({ events });
  });

  app.post("/v1/desktop/audit-webhook", { preHandler: [requireAuth, requirePermission("audit:export")], schema: s(["Audit"], "Configure audit webhook", "configureAuditWebhook") }, async (request, reply) => {
    const session = (request as unknown as Record<string, unknown>).session as { organizationId: string };
    const body = z.object({
      url: z.string().url(),
      secret: z.string().min(16).max(256),
      eventTypes: z.array(z.string()).default([]),
    }).parse(request.body);

    await options.repository.upsertAuditWebhook({
      organizationId: session.organizationId,
      url: body.url,
      secret: body.secret,
      eventTypes: body.eventTypes,
    });

    return reply.code(201).send({ ok: true });
  });

  app.post("/v1/desktop/audit-events/batch", { preHandler: [requireAuth, requirePermission("audit:read")], schema: s(["Audit"], "Submit batch of audit events from desktop", "batchAuditEvents") }, async (request, reply) => {
    const session = (request as unknown as Record<string, unknown>).session as { sub: string; organizationId: string };
    const body = auditBatchSchema.parse(request.body);
    if (body.organizationId !== session.organizationId) {
      return reply.code(403).send({ error: "Session organization mismatch." });
    }
    await options.repository.recordDesktopAuditEvents({
      organizationId: body.organizationId,
      actorId: session.sub,
      events: body.events,
    });
    return reply.code(202).send({ accepted: body.events.length });
  });

  type Session = { sub: string; email: string; organizationId: string; role: string };
  const getSession = (request: FastifyRequest) => (request as unknown as { session: Session }).session;

  app.get("/v1/orgs", { preHandler: [requireAuth, requirePermission("org:read")], schema: s(["Organizations"], "Get current user's organizations", "getMyOrganizations") }, async (request, reply) => {
    const session = getSession(request);
    const members = await options.repository.listOrganizationMembers({ organizationId: session.organizationId });
    const billing = await options.repository.getBillingAccount({ organizationId: session.organizationId });
    return reply.send({ organizations: [{
      id: session.organizationId,
      myRole: session.role,
      memberCount: members.length,
      plan: billing.plan,
    }] });
  });

  app.put("/v1/orgs/:organizationId", { preHandler: [requireAuth, requirePermission("org:manage")], schema: s(["Organizations"], "Update organization", "updateOrganization") }, async (request, reply) => {
    const session = getSession(request);
    const params = z.object({ organizationId: z.uuid() }).parse(request.params);
    const body = z.object({
      name: z.string().min(2).max(120),
      slug: z.string().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    }).parse(request.body);

    const org = await options.repository.ensureOrganization({
      organizationId: params.organizationId,
      name: body.name,
      slug: body.slug,
      ownerEmail: session.email,
    });

    return reply.send({ organization: org });
  });

  app.post("/v1/orgs", { preHandler: [requireAuth], schema: s(["Organizations"], "Create new organization", "createOrganization") }, async (request, reply) => {
    const session = getSession(request);
    const body = z.object({
      name: z.string().min(2).max(120),
      slug: z.string().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    }).parse(request.body);

    const org = await options.repository.createOrganization({
      name: body.name,
      slug: body.slug,
      ownerEmail: session.email,
    });

    await options.repository.upsertOrganizationMember({
      organizationId: org.id,
      email: session.email,
      role: "owner",
    });

    return reply.code(201).send({ organization: org });
  });

  app.get("/v1/orgs/:organizationId", { preHandler: [requireAuth, requirePermission("org:read")], schema: s(["Organizations"], "Get organization details", "getOrganization") }, async (request, reply) => {
    const session = getSession(request);
    const params = z.object({ organizationId: z.uuid() }).parse(request.params);
    const members = await options.repository.listOrganizationMembers({ organizationId: params.organizationId });
    const membership = members.find((m) => m.userId === session.sub);
    if (!membership) {
      return reply.code(403).send({ error: "Not a member of this organization" });
    }
    const billing = await options.repository.getBillingAccount({ organizationId: params.organizationId });
    return reply.send({
      id: params.organizationId,
      memberCount: members.length,
      myRole: membership.role,
      plan: billing.plan,
    });
  });

  app.get("/v1/orgs/:organizationId/members", { preHandler: [requireAuth, requirePermission("org:read")], schema: s(["Organizations"], "List organization members", "listOrganizationMembers") }, async (request, reply) => {
    const session = getSession(request);
    const params = z.object({ organizationId: z.uuid() }).parse(request.params);
    if (session.organizationId !== params.organizationId) {
      return reply.code(403).send({ error: "Not a member of this organization" });
    }
    const members = await options.repository.listOrganizationMembers({ organizationId: params.organizationId });
    return reply.send({ members });
  });

  app.post("/v1/orgs/:organizationId/members", { preHandler: [requireAuth, requirePermission("member:invite")], schema: s(["Organizations"], "Add organization member", "addOrganizationMember") }, async (request, reply) => {
    const params = z.object({ organizationId: z.uuid() }).parse(request.params);
    const body = z.object({
      email: z.email(),
      role: z.enum(["owner", "admin", "member", "viewer", "security_officer", "auditor", "developer"]).default("developer"),
    }).parse(request.body);

    const member = await options.repository.upsertOrganizationMember({
      organizationId: params.organizationId,
      email: body.email,
      role: toControlApiRole(body.role),
    });

    return reply.code(201).send({ member });
  });

  app.put("/v1/orgs/:organizationId/members/:userId", { preHandler: [requireAuth, requirePermission("member:update_role")], schema: s(["Organizations"], "Update member role", "updateMemberRole") }, async (request, reply) => {
    const session = getSession(request);
    const params = z.object({
      organizationId: z.uuid(),
      userId: z.uuid(),
    }).parse(request.params);
    const body = z.object({
      role: z.enum(["owner", "admin", "member", "viewer", "security_officer", "auditor", "developer"]),
    }).parse(request.body);

    const members = await options.repository.listOrganizationMembers({ organizationId: params.organizationId });

    const target = members.find((m) => m.userId === params.userId);
    if (!target) {
      return reply.code(404).send({ error: "Member not found" });
    }

    if (body.role !== "owner" && params.userId === session.sub) {
      const owners = members.filter((m) => m.role === "owner");
      if (owners.length <= 1) {
        return reply.code(400).send({ error: "Cannot demote the last owner" });
      }
    }

    const member = await options.repository.upsertOrganizationMember({
      organizationId: params.organizationId,
      email: target.email,
      role: toControlApiRole(body.role),
    });

    return reply.send({ member });
  });

  app.delete("/v1/orgs/:organizationId/members/:userId", { preHandler: [requireAuth, requirePermission("member:remove")], schema: s(["Organizations"], "Remove organization member", "removeOrganizationMember") }, async (request, reply) => {
    const session = getSession(request);
    const params = z.object({
      organizationId: z.uuid(),
      userId: z.uuid(),
    }).parse(request.params);

    const members = await options.repository.listOrganizationMembers({ organizationId: params.organizationId });
    if (params.userId === session.sub) {
      const owners = members.filter((m) => m.role === "owner");
      if (owners.length <= 1) {
        return reply.code(400).send({ error: "Cannot remove the last owner" });
      }
    }

    await options.repository.disableOrganizationMember({ organizationId: params.organizationId, userId: params.userId });
    return reply.code(204).send();
  });

  app.post("/v1/orgs/:organizationId/invitations", { preHandler: [requireAuth, requirePermission("member:invite")], schema: s(["Organizations"], "Create invitation", "createInvitation") }, async (request, reply) => {
    const session = getSession(request);
    const params = z.object({ organizationId: z.uuid() }).parse(request.params);
    const body = z.object({ email: z.email(), role: z.string().default("developer") }).parse(request.body);

    const invitation = await options.repository.createInvitation({
      organizationId: params.organizationId,
      email: body.email,
      role: toControlApiRole(body.role),
      invitedBy: session.sub,
    });

    try {
      const org = await options.repository.getOrganization({ organizationId: params.organizationId });
      const emailService = new EmailService();
      await emailService.sendOrgInvitation({
        invitationId: invitation.id,
        email: body.email,
        invitationCode: invitation.invitationCode,
        inviterName: session.email,
        inviterEmail: session.email,
        orgName: org.name,
      });
    } catch (err) {
      console.error("Failed to send invitation email:", err);
    }

    return reply.code(201).send({ invitation });
  });

  app.post("/v1/orgs/invitations/:code/accept", { preHandler: [requireAuth], schema: s(["Organizations"], "Accept invitation", "acceptInvitation") }, async (request, reply) => {
    const session = getSession(request);
    const params = z.object({ code: z.string().uuid() }).parse(request.params);

    const invitation = await options.repository.validateInvitation({ code: params.code });
    if (!invitation) {
      return reply.code(404).send({ error: "Invalid or expired invitation" });
    }

    await options.repository.upsertOrganizationMember({
      organizationId: invitation.organizationId,
      email: session.email,
      role: invitation.role as "owner" | "admin" | "security_officer" | "auditor" | "developer" | "viewer",
    });

    await options.repository.markInvitationAccepted({ id: invitation.id, acceptedBy: session.sub });

    const members = await options.repository.listOrganizationMembers({ organizationId: invitation.organizationId });
    return reply.send({ organizationId: invitation.organizationId, members });
  });

  app.post("/v1/orgs/:organizationId/pairing-code", { preHandler: [requireAuth, requirePermission("member:invite")], schema: s(["Organizations"], "Generate pairing code", "createPairingCode") }, async (request, reply) => {
    const session = getSession(request);
    const params = z.object({ organizationId: z.uuid() }).parse(request.params);

    const pairingCode = await options.repository.createPairingCode({
      organizationId: params.organizationId,
      createdBy: session.sub,
    });

    return reply.code(201).send({
      code: pairingCode.code,
      expiresAt: pairingCode.expiresAt,
      expiresIn: "1 hour",
    });
  });

  app.post("/v1/orgs/pair", { preHandler: [requireAuth], schema: s(["Organizations"], "Join organization via pairing code", "pairOrganization") }, async (request, reply) => {
    const session = getSession(request);
    const body = z.object({ code: z.string().min(1).max(100) }).parse(request.body);

    const pairing = await options.repository.validatePairingCode({ code: body.code });
    if (!pairing) {
      return reply.code(404).send({ error: "Invalid or expired pairing code" });
    }

    await options.repository.upsertOrganizationMember({
      organizationId: pairing.organizationId,
      email: session.email,
      role: "developer",
    });

    const members = await options.repository.listOrganizationMembers({ organizationId: pairing.organizationId });
    return reply.send({ organizationId: pairing.organizationId, members });
  });

  app.post("/v1/orgs/:organizationId/trial/start", { preHandler: [requireAuth, requirePermission("org:manage")], schema: s(["Organizations"], "Start free trial", "startTrial") }, async (request, reply) => {
    const params = z.object({ organizationId: z.uuid() }).parse(request.params);

    const trialService = new TrialService(options.repository);
    await trialService.startTrial(params.organizationId);
    const status = await trialService.checkTrialStatus(params.organizationId);

    return reply.code(201).send({ trial: status });
  });

  app.get("/v1/orgs/:organizationId/trial", { preHandler: [requireAuth, requirePermission("org:read")], schema: s(["Organizations"], "Check trial status", "checkTrialStatus") }, async (request, reply) => {
    const params = z.object({ organizationId: z.uuid() }).parse(request.params);

    const trialService = new TrialService(options.repository);
    const status = await trialService.checkTrialStatus(params.organizationId);

    return reply.send({ trial: status });
  });
};

export default desktopRoutes;

function getStripeClient(): Stripe {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("STRIPE_SECRET_KEY is not configured.");
    }
    return createMockStripeClient();
  }
  return new Stripe(apiKey, { apiVersion: "2026-05-27.dahlia" });
}

function createMockStripeClient(): Stripe {
  const mockCreateCheckoutSession = async () => ({
    id: `cs_test_${randomBytes(16).toString("hex")}`,
    url: `https://checkout.stripe.com/c/pay/${randomBytes(8).toString("hex")}`,
    object: "checkout.session" as const,
    mode: "payment" as const,
    payment_status: "unpaid" as const,
    status: "open" as const,
    amount_total: 0,
    currency: "usd",
    customer: null,
    customer_email: null,
    client_reference_id: null,
    metadata: {},
    success_url: "",
    cancel_url: "",
    created: Math.floor(Date.now() / 1000),
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    livemode: false,
    locale: null,
    payment_intent: null,
    setup_intent: null,
    submit_type: null,
    subscription: null,
    total_details: { amount_discount: 0, amount_shipping: 0, amount_tax: 0 },
  });

  const mockConstructEvent = () => ({
    id: "evt_test_mock",
    object: "event" as const,
    api_version: "2026-05-27.dahlia",
    created: Math.floor(Date.now() / 1000),
    data: { object: {} },
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    type: "checkout.session.completed",
  });

  return {
    checkout: { sessions: { create: mockCreateCheckoutSession } },
    webhooks: { constructEvent: mockConstructEvent },
  } as unknown as Stripe;
}

function verifyPassword(password: string, user: DesktopAuthUser): boolean {
  const actual = pbkdf2Sync(
    password,
    Buffer.from(user.passwordSalt, "hex"),
    user.passwordIterations,
    64,
    "sha512",
  );
  const expected = Buffer.from(user.passwordHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function hashPassword(password: string): { hash: string; salt: string; iterations: number } {
  const salt = randomBytes(16).toString("hex");
  const iterations = 210000;
  return {
    hash: pbkdf2Sync(password, Buffer.from(salt, "hex"), iterations, 64, "sha512").toString("hex"),
    salt,
    iterations,
  };
}

function createSessionResponse(user: DesktopAuthUser, sessionSecret: string, keySet?: KeySet) {
  const token = signSessionToken(user, sessionSecret, keySet);
  return { token, user: serializeUser(user) };
}

function serializeUser(user: DesktopAuthUser) {
  return {
    id: user.userId,
    email: user.email,
    name: user.displayName ?? user.email,
    plan: titlePlan(user.plan),
    organizationId: user.organizationId,
    planRenewalDate: user.planRenewalDate,
  };
}

function signSessionToken(user: DesktopAuthUser, secret: string, keySet?: KeySet): string {
  const now = Math.floor(Date.now() / 1000);
  const ks = keySet ?? KeySet.fromSecret(secret);
  const header = encodeBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT", kid: ks.current.kid }));
  const payload = encodeBase64Url(
    JSON.stringify({
      jti: generateJwtId(),
      sub: user.userId,
      email: user.email,
      organizationId: user.organizationId,
      role: user.role,
      iss: "oclushion-control-api",
      aud: "oclushion-desktop",
      iat: now,
      nbf: now,
      exp: now + 8 * 60 * 60,
    }),
  );
  const signature = ks.sign(`${header}.${payload}`);
  return `${header}.${payload}.${signature}`;
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function titlePlan(plan: string): "Free" | "Pro" | "Team" | "Enterprise" {
  if (plan === "enterprise") {
    return "Enterprise";
  }
  if (plan === "team") {
    return "Team";
  }
  if (plan === "pro") {
    return "Pro";
  }
  return "Free";
}

function toControlApiRole(role: string): "owner" | "admin" | "security_officer" | "auditor" | "developer" | "viewer" {
  if (role === "member") return "developer";
  return role as "owner" | "admin" | "security_officer" | "auditor" | "developer" | "viewer";
}

function isPasswordStrong(password: string): boolean {
  if (password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[^A-Za-z0-9]/.test(password)) return false;
  return true;
}

function generateJwtId(): string {
  return randomBytes(16).toString("hex");
}

function signMfaChallengeToken(user: DesktopAuthUser, secret: string, keySet?: KeySet): string {
  const now = Math.floor(Date.now() / 1000);
  const ks = keySet ?? KeySet.fromSecret(secret);
  const header = encodeBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT", kid: ks.current.kid }));
  const payload = encodeBase64Url(
    JSON.stringify({
      jti: generateJwtId(),
      sub: user.userId,
      purpose: "mfa-challenge",
      iss: "oclushion-control-api",
      aud: "oclushion-desktop",
      iat: now,
      nbf: now,
      exp: now + 5 * 60,
    }),
  );
  const signature = ks.sign(`${header}.${payload}`);
  return `${header}.${payload}.${signature}`;
}

function verifyMfaChallengeToken(token: string, secret: string, keySet?: KeySet): { sub: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;
    if (!header || !payload || !signature) return null;
    const ks = keySet ?? KeySet.fromSecret(secret);
    if (!ks.verify(header, payload, signature)) return null;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (decoded.purpose !== "mfa-challenge") return null;
    const now = Math.floor(Date.now() / 1000);
    if (now > decoded.exp) return null;
    return { sub: decoded.sub };
  } catch {
    return null;
  }
}
