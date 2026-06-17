import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { KeySet } from "./key-set.js";

type OrganizationRole = "owner" | "admin" | "security_officer" | "auditor" | "developer" | "viewer";
type Permission =
  | "org:read"
  | "org:manage"
  | "org:delete"
  | "member:invite"
  | "member:remove"
  | "member:update_role"
  | "billing:read"
  | "billing:manage"
  | "policy:read"
  | "policy:write"
  | "skill:upload"
  | "skill:approve"
  | "agent:configure"
  | "agent:execute"
  | "repo:scan"
  | "gateway:admin"
  | "audit:read"
  | "audit:export"
  | "god_mode:enable";

const ROLE_PERMISSIONS: Record<OrganizationRole, Permission[]> = {
  owner: [
    "org:read", "org:manage", "org:delete",
    "member:invite", "member:remove", "member:update_role",
    "billing:read", "billing:manage",
    "policy:read", "policy:write",
    "skill:upload", "skill:approve",
    "agent:configure",
    "agent:execute",
    "repo:scan",
    "gateway:admin",
    "audit:read",
    "audit:export",
    "god_mode:enable",
  ],
  admin: [
    "org:read", "org:manage",
    "member:invite", "member:remove", "member:update_role",
    "billing:read", "billing:manage",
    "policy:read", "policy:write",
    "skill:upload", "skill:approve",
    "agent:configure",
    "agent:execute",
    "repo:scan",
    "gateway:admin",
    "audit:read",
    "audit:export",
  ],
  security_officer: [
    "org:read",
    "policy:read", "policy:write",
    "audit:read",
    "god_mode:enable",
  ],
  auditor: ["org:read", "audit:read", "policy:read"],
  developer: ["org:read", "skill:upload", "agent:execute", "repo:scan"],
  viewer: ["org:read"],
};

export function requirePermission(...permissions: Permission[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const userRole = (request as unknown as Record<string, unknown>).userRole as OrganizationRole;

    if (!userRole) {
      return reply.code(401).send({ error: "Authentication required" });
    }

    const allowedPermissions = ROLE_PERMISSIONS[userRole] ?? [];
    const hasPermission = permissions.every((p) => allowedPermissions.includes(p));

    if (!hasPermission) {
      return reply.code(403).send({
        error: "Insufficient permissions",
        required: permissions,
        role: userRole,
      });
    }
  };
}

const ROLE_HIERARCHY: Record<OrganizationRole, number> = {
  owner: 5,
  admin: 4,
  security_officer: 3,
  auditor: 2,
  developer: 1,
  viewer: 0,
};

export function requireMinimumRole(minimumRole: OrganizationRole) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const userRole = (request as unknown as Record<string, unknown>).userRole as OrganizationRole;

    if (!userRole) {
      return reply.code(401).send({ error: "Authentication required" });
    }

    const userLevel = ROLE_HIERARCHY[userRole] ?? -1;
    const requiredLevel = ROLE_HIERARCHY[minimumRole] ?? -1;

    if (userLevel < requiredLevel) {
      return reply.code(403).send({
        error: `Requires at least ${minimumRole} role`,
        role: userRole,
      });
    }
  };
}

export type RbacPluginOptions = {
  sessionSecret: string;
  keySet?: KeySet;
  repository?: { getDesktopAuthUser(input: { userId: string }): Promise<{ role: string; organizationId: string }> };
};

export async function rbacPlugin(fastify: FastifyInstance, opts: RbacPluginOptions) {
  fastify.decorateRequest("userRole", null);
  fastify.decorateRequest("organizationId", null);
  fastify.decorateRequest("session", null);

  fastify.addHook("onRoute", (routeOptions) => {
    routeOptions.config = { ...routeOptions.config, rateLimit: { max: 120, timeWindow: "1 minute" } };
  });

  fastify.addHook("preHandler", async (request) => {
    const auth = request.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return;

    const parts = auth.slice(7).split(".");
    if (parts.length !== 3) return;

    const header = parts[0];
    const payload = parts[1];
    const signature = parts[2];
    if (!header || !payload || !signature) return;

    const ks = opts.keySet ?? KeySet.fromSecret(opts.sessionSecret);
    if (!ks.verify(header, payload, signature)) return;

    try {
      const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      if (parsed.exp < Math.floor(Date.now() / 1000)) return;
      if (!parsed.sub) return;

      (request as unknown as Record<string, unknown>).session = parsed;
      (request as unknown as Record<string, unknown>).organizationId = parsed.organizationId ?? null;

      if (opts.repository && parsed.sub) {
        try {
          const dbUser = await opts.repository.getDesktopAuthUser({ userId: parsed.sub });
          (request as unknown as Record<string, unknown>).userRole = dbUser.role ?? null;
          if (dbUser.organizationId) {
            (request as unknown as Record<string, unknown>).organizationId = dbUser.organizationId;
          }
        } catch {
          (request as unknown as Record<string, unknown>).userRole = parsed.role ?? null;
        }
      } else {
        (request as unknown as Record<string, unknown>).userRole = parsed.role ?? null;
      }
    } catch {
    }
  });
}
