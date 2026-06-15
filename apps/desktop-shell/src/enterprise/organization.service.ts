import type {
  Organization,
  OrgMember,
  OrgRole,
  OrgSettings,
  InviteMemberInput,
} from "../types/enterprise-registry";
import { enterpriseApi } from "./enterprise-api.service";

type OrgListener = (org: Organization | null) => void;

let currentOrg: Organization | null = null;
const orgListeners = new Set<OrgListener>();

export function getOrganization(): Organization | null {
  return currentOrg;
}

export function setOrganization(org: Organization | null): void {
  currentOrg = org;
  orgListeners.forEach((l) => l(org));
}

export function subscribeToOrg(listener: OrgListener): () => void {
  orgListeners.add(listener);
  listener(currentOrg);
  return () => orgListeners.delete(listener);
}

export async function fetchOrganization(orgId: string): Promise<Organization | null> {
  const res = await enterpriseApi<Organization>(`/v1/orgs/${orgId}`);
  if (res.ok && res.data) {
    setOrganization(res.data);
    return res.data;
  }
  return null;
}

export async function createOrganization(input: {
  name: string;
  plan: "team" | "enterprise";
}): Promise<Organization | null> {
  const res = await enterpriseApi<Organization>("/v1/orgs", "POST", input);
  if (res.ok && res.data) {
    setOrganization(res.data);
    return res.data;
  }
  return null;
}

export async function updateOrganization(
  orgId: string,
  input: { name?: string; settings?: Partial<OrgSettings> },
): Promise<Organization | null> {
  const res = await enterpriseApi<Organization>(`/v1/orgs/${orgId}`, "PUT", input);
  if (res.ok && res.data) {
    setOrganization(res.data);
    return res.data;
  }
  return null;
}

export async function fetchMembers(orgId: string): Promise<OrgMember[]> {
  const res = await enterpriseApi<OrgMember[]>(`/v1/orgs/${orgId}/members`);
  return res.data ?? [];
}

export async function inviteMember(
  orgId: string,
  input: InviteMemberInput,
): Promise<OrgMember | null> {
  const res = await enterpriseApi<OrgMember>(
    `/v1/orgs/${orgId}/members`,
    "POST",
    input,
  );
  return res.data ?? null;
}

export async function removeMember(orgId: string, userId: string): Promise<boolean> {
  const res = await enterpriseApi(`/v1/orgs/${orgId}/members/${userId}`, "DELETE");
  return res.ok;
}

export async function updateMemberRole(
  orgId: string,
  userId: string,
  role: OrgRole,
): Promise<boolean> {
  const res = await enterpriseApi(`/v1/orgs/${orgId}/members/${userId}`, "PUT", { role });
  return res.ok;
}

export function canManageOrg(role: OrgRole): boolean {
  return role === "owner" || role === "admin";
}

export function canUploadSkills(role: OrgRole): boolean {
  return role === "owner" || role === "admin" || role === "developer";
}

export function canApproveSkills(role: OrgRole): boolean {
  return role === "owner" || role === "admin";
}
