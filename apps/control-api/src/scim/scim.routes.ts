import { createHash } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ControlRepository } from "../storage/repository.js";
import { SCIMService } from "./scim.service.js";
import {
  SCIM_USER_SCHEMA_URI,
  SCIM_GROUP_SCHEMA_URI,
  SCIM_ENTERPRISE_USER_SCHEMA_URI,
  SCIM_ERROR_SCHEMA,
  SCIM_PATCH_OP_SCHEMA,
  type SCIMCreateUserRequest,
  type SCIMCreateGroupRequest,
  type SCIMPatchRequest,
} from "./scim.types.js";

const scimRoutes: FastifyPluginAsync<{ repository: ControlRepository }> = async (app, options) => {
  const scim = new SCIMService(options.repository);

  const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

  const requireOrg = async (request: { headers: Record<string, string | string[] | undefined> }): Promise<string> => {
    const auth = request.headers.authorization;
    if (typeof auth === "string" && auth.startsWith("Bearer ")) {
      const token = auth.slice(7);
      const scimToken = await options.repository.validateScimToken({ tokenHash: hashToken(token) }).catch(() => null);
      if (scimToken) {
        await options.repository.touchScimToken({ tokenHash: hashToken(token) }).catch(() => {});
        return scimToken.organization_id;
      }
    }
    const orgId = request.headers["x-organization-id"];
    if (typeof orgId === "string" && orgId) {
      return orgId;
    }
    throw { statusCode: 401, message: "Valid SCIM token or X-Organization-ID header required." };
  };

  const scimError = (reply: any, status: number, detail: string, scimType?: string) => {
    return reply.code(status).send({
      schemas: [SCIM_ERROR_SCHEMA],
      status: String(status),
      detail,
      scimType,
    });
  };

  app.get("/ServiceProviderConfig", async (_request, reply) => {
    return reply.send({
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
      patch: { supported: true },
      bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
      filter: { supported: false, maxResults: 200 },
      changePassword: { supported: false },
      sort: { supported: false },
      etag: { supported: false },
      authenticationSchemes: [
        {
          type: "oauthbearertoken",
          name: "OAuth Bearer Token",
          description: "Bearer token in Authorization header",
        },
      ],
      meta: {
        location: "/scim/v2/ServiceProviderConfig",
        resourceType: "ServiceProviderConfig",
        created: "2026-01-01T00:00:00Z",
        lastModified: "2026-01-01T00:00:00Z",
      },
    });
  });

  app.get("/Schemas", async (_request, reply) => {
    return reply.send({
      schemas: [SCIM_ERROR_SCHEMA],
      totalResults: 3,
      itemsPerPage: 3,
      startIndex: 1,
      Resources: [
        {
          id: SCIM_USER_SCHEMA_URI,
          name: "User",
          description: "User Account",
          attributes: [
            { name: "userName", type: "string", required: true, caseExact: false, mutability: "readWrite", returned: "default", uniqueness: "server" },
            { name: "name", type: "complex", mutability: "readWrite", returned: "default", subAttributes: [
              { name: "formatted", type: "string", mutability: "readWrite", returned: "default" },
              { name: "givenName", type: "string", mutability: "readWrite", returned: "default" },
              { name: "familyName", type: "string", mutability: "readWrite", returned: "default" },
            ]},
            { name: "displayName", type: "string", mutability: "readWrite", returned: "default" },
            { name: "emails", type: "complex", multiValued: true, mutability: "readWrite", returned: "default", subAttributes: [
              { name: "value", type: "string", required: true, mutability: "readWrite", returned: "default" },
              { name: "primary", type: "boolean", mutability: "readWrite", returned: "default" },
            ]},
            { name: "active", type: "boolean", mutability: "readWrite", returned: "default" },
          ],
        },
        {
          id: SCIM_GROUP_SCHEMA_URI,
          name: "Group",
          description: "Group",
          attributes: [
            { name: "displayName", type: "string", required: true, mutability: "readWrite", returned: "default" },
            { name: "members", type: "complex", multiValued: true, mutability: "readWrite", returned: "default", subAttributes: [
              { name: "value", type: "string", required: true, mutability: "immutable", returned: "default" },
              { name: "display", type: "string", mutability: "readWrite", returned: "default" },
            ]},
          ],
        },
        {
          id: SCIM_ENTERPRISE_USER_SCHEMA_URI,
          name: "EnterpriseUser",
          description: "Enterprise User Extension",
          attributes: [
            { name: "employeeNumber", type: "string", mutability: "readWrite", returned: "default" },
            { name: "department", type: "string", mutability: "readWrite", returned: "default" },
            { name: "manager", type: "complex", mutability: "readWrite", returned: "default", subAttributes: [
              { name: "value", type: "string", mutability: "readWrite", returned: "default" },
              { name: "displayName", type: "string", mutability: "readWrite", returned: "default" },
            ]},
          ],
        },
      ],
    });
  });

  app.get("/Users", async (request, reply) => {
    try {
      const orgId = await requireOrg(request);
      const query = z.object({
        startIndex: z.coerce.number().int().min(1).default(1),
        count: z.coerce.number().int().min(1).max(200).default(100),
      }).parse(request.query);
      const result = await scim.listUsers(orgId, query.startIndex, query.count);
      return reply.send(result);
    } catch (error: any) {
      if (error.statusCode) return scimError(reply, error.statusCode, error.message);
      return scimError(reply, 500, "Internal error");
    }
  });

  app.post("/Users", async (request, reply) => {
    try {
      const orgId = await requireOrg(request);
      const body = request.body as SCIMCreateUserRequest;
      if (!body?.schemas?.includes(SCIM_USER_SCHEMA_URI) || !body.userName) {
        return scimError(reply, 400, "Invalid SCIM User schema", "invalidValue");
      }
      const user = await scim.createUser(body, orgId);
      return reply.code(201).send(user);
    } catch (error: any) {
      return scimError(reply, 500, error.message ?? "Internal error");
    }
  });

  app.get("/Users/:id", async (request, reply) => {
    try {
      const orgId = await requireOrg(request);
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const user = await scim.getUser(id, orgId);
      if (!user) return scimError(reply, 404, "User not found");
      return reply.send(user);
    } catch (error: any) {
      if (error.statusCode) return scimError(reply, error.statusCode, error.message);
      return scimError(reply, 500, "Internal error");
    }
  });

  app.put("/Users/:id", async (request, reply) => {
    try {
      const orgId = await requireOrg(request);
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = request.body as SCIMCreateUserRequest;
      if (!body?.schemas?.includes(SCIM_USER_SCHEMA_URI) || !body.userName) {
        return scimError(reply, 400, "Invalid SCIM User schema", "invalidValue");
      }
      const user = await scim.getUser(id, orgId);
      if (!user) return scimError(reply, 404, "User not found");
      const updated = await scim.patchUser(id, orgId, {
        schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
        Operations: [{ op: "replace", path: "displayName", value: body.displayName ?? body.userName }],
      });
      return reply.send(updated);
    } catch (error: any) {
      if (error.statusCode) return scimError(reply, error.statusCode, error.message);
      return scimError(reply, 500, "Internal error");
    }
  });

  app.patch("/Users/:id", async (request, reply) => {
    try {
      const orgId = await requireOrg(request);
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = request.body as SCIMPatchRequest;
      if (!body?.schemas?.includes(SCIM_PATCH_OP_SCHEMA)) {
        return scimError(reply, 400, "Invalid PATCH operation schema", "invalidValue");
      }
      const user = await scim.patchUser(id, orgId, body);
      return reply.send(user);
    } catch (error: any) {
      if (error.message === "User not found") return scimError(reply, 404, "User not found");
      return scimError(reply, 500, error.message ?? "Internal error");
    }
  });

  app.delete("/Users/:id", async (request, reply) => {
    try {
      const orgId = await requireOrg(request);
      const { id } = z.object({ id: z.string() }).parse(request.params);
      await scim.deleteUser(id, orgId);
      return reply.code(204).send();
    } catch (error: any) {
      return scimError(reply, 500, error.message ?? "Internal error");
    }
  });

  app.get("/Groups", async (request, reply) => {
    try {
      const orgId = await requireOrg(request);
      const result = await scim.listGroups(orgId);
      return reply.send(result);
    } catch (_error: any) {
      return scimError(reply, 500, "Internal error");
    }
  });

  app.post("/Groups", async (request, reply) => {
    try {
      const orgId = await requireOrg(request);
      const body = request.body as SCIMCreateGroupRequest;
      if (!body?.schemas?.includes(SCIM_GROUP_SCHEMA_URI) || !body.displayName) {
        return scimError(reply, 400, "Invalid SCIM Group schema", "invalidValue");
      }
      const group = await scim.createGroup(body, orgId);
      return reply.code(201).send(group);
    } catch (error: any) {
      return scimError(reply, 500, error.message ?? "Internal error");
    }
  });

  app.delete("/Groups/:id", async (request, reply) => {
    try {
      const orgId = await requireOrg(request);
      const { id } = z.object({ id: z.string() }).parse(request.params);
      await scim.deleteGroup(id, orgId);
      return reply.code(204).send();
    } catch (error: any) {
      return scimError(reply, 500, error.message ?? "Internal error");
    }
  });
};

export default scimRoutes;
