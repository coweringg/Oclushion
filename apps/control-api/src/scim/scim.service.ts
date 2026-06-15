import type { ControlRepository, DesktopAuthUser } from "../storage/repository.js";
import type {
  SCIMUser,
  SCIMGroup,
  SCIMCreateUserRequest,
  SCIMCreateGroupRequest,
  SCIMListResponse,
  SCIMPatchRequest,
} from "./scim.types.js";
import { SCIM_USER_SCHEMA_URI, SCIM_GROUP_SCHEMA_URI, SCIM_LIST_RESPONSE_SCHEMA } from "./scim.types.js";

export class SCIMService {
  public constructor(private readonly repository: ControlRepository) {}

  public async listUsers(
    orgId: string,
    startIndex: number,
    count: number,
  ): Promise<SCIMListResponse> {
    const members = await this.repository.listOrganizationMembers({ organizationId: orgId });
    const total = members.length;
    const page = members.slice(startIndex - 1, startIndex - 1 + count);
    const Resources: SCIMUser[] = [];
    for (const member of page) {
      const user = await this.repository.getDesktopAuthUserByEmail({ email: member.email }).catch(() => null);
      if (!user) continue;
      Resources.push(this.toSCIMUser(user, orgId));
    }
    return {
      schemas: [SCIM_LIST_RESPONSE_SCHEMA],
      totalResults: total,
      startIndex,
      itemsPerPage: count,
      Resources,
    };
  }

  public async getUser(userId: string, orgId: string): Promise<SCIMUser | null> {
    const user = await this.repository.getDesktopAuthUser({ userId }).catch(() => null);
    if (!user) return null;
    const members = await this.repository.listOrganizationMembers({ organizationId: orgId });
    const isMember = members.some((m) => m.email === user.email);
    if (!isMember) return null;
    return this.toSCIMUser(user, orgId);
  }

  public async createUser(req: SCIMCreateUserRequest, orgId: string): Promise<SCIMUser> {
    const user = await this.repository.createDesktopAuthUser({
      email: req.userName,
      displayName: req.displayName ?? req.name?.formatted ?? req.userName,
      passwordHash: "",
      passwordSalt: "",
      passwordIterations: 0,
      authMethod: "sso",
    });
    await this.repository.upsertOrganizationMember({
      organizationId: orgId,
      email: req.userName,
      role: "developer",
      displayName: req.displayName,
    });
    const created = await this.repository.getDesktopAuthUser({ userId: user.userId });
    return this.toSCIMUser(created, orgId);
  }

  public async patchUser(userId: string, orgId: string, patch: SCIMPatchRequest): Promise<SCIMUser> {
    const user = await this.repository.getDesktopAuthUser({ userId }).catch(() => null);
    if (!user) throw new Error("User not found");
    for (const op of patch.Operations) {
      if (op.op === "replace" && op.path === "active") {
        const active = op.value as boolean;
        if (!active) {
          await this.repository.removeOrganizationMember({ organizationId: orgId, email: user.email }).catch(() => {});
        }
      }
      if (op.op === "replace" && op.path === "displayName") {
        const displayName = op.value as string;
        await this.repository.upsertOrganizationMember({
          organizationId: orgId,
          email: user.email,
          role: "developer",
          displayName,
        });
      }
    }
    const updated = await this.repository.getDesktopAuthUser({ userId });
    return this.toSCIMUser(updated, orgId);
  }

  public async deleteUser(userId: string, orgId: string): Promise<void> {
    const user = await this.repository.getDesktopAuthUser({ userId }).catch(() => null);
    if (!user) return;
    await this.repository.removeOrganizationMember({ organizationId: orgId, email: user.email }).catch(() => {});
  }

  public async createGroup(req: SCIMCreateGroupRequest, orgId: string): Promise<SCIMGroup> {
    const group: SCIMGroup = {
      schemas: [SCIM_GROUP_SCHEMA_URI],
      id: `group-${orgId}-${req.displayName.toLowerCase().replace(/\s+/g, "-")}`,
      displayName: req.displayName,
      members: req.members ?? [],
      meta: {
        resourceType: "Group",
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        version: "v1",
      },
    };
    return group;
  }

  public async deleteGroup(groupId: string, orgId: string): Promise<void> {
    return;
  }

  public async listGroups(orgId: string): Promise<SCIMListResponse> {
    const members = await this.repository.listOrganizationMembers({ organizationId: orgId });
    const roles = new Map<string, { display: string; members: Array<{ value: string; display: string }> }>();
    for (const m of members) {
      const roleId = `role-${m.role}`;
      if (!roles.has(roleId)) {
        roles.set(roleId, { display: m.role, members: [] });
      }
      roles.get(roleId)!.members.push({ value: m.email, display: m.displayName ?? m.email });
    }
    const Resources: SCIMGroup[] = [];
    for (const [id, role] of roles) {
      Resources.push({
        schemas: [SCIM_GROUP_SCHEMA_URI],
        id,
        displayName: role.display,
        members: role.members,
        meta: {
          resourceType: "Group",
          created: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          version: "v1",
        },
      });
    }
    return {
      schemas: [SCIM_LIST_RESPONSE_SCHEMA],
      totalResults: Resources.length,
      startIndex: 1,
      itemsPerPage: Resources.length,
      Resources,
    };
  }

  private toSCIMUser(user: DesktopAuthUser, orgId: string): SCIMUser {
    return {
      schemas: [SCIM_USER_SCHEMA_URI],
      id: user.userId,
      userName: user.email,
      displayName: user.displayName ?? user.email,
      emails: [{ value: user.email, primary: true }],
      active: true,
      meta: {
        resourceType: "User",
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        version: "v1",
      },
    };
  }
}
