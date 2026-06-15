import type {
  EnterpriseSkill,
  CreateEnterpriseSkillInput,
  UpdateEnterpriseSkillInput,
  EnterpriseSkillStatus,
} from "../types/enterprise-registry";
import { sha256Hex } from "../marketplace/integrity";
import { enterpriseApi } from "./enterprise-api.service";
import { getOrganization } from "./organization.service";

type SkillListener = (skills: EnterpriseSkill[]) => void;

let cachedSkills: EnterpriseSkill[] = [];
const skillListeners = new Set<SkillListener>();
let fetchSkillsPromise: Promise<EnterpriseSkill[]> | null = null;

export function getCachedSkills(): EnterpriseSkill[] {
  return cachedSkills;
}

export function subscribeToSkills(listener: SkillListener): () => void {
  skillListeners.add(listener);
  listener(cachedSkills);
  return () => skillListeners.delete(listener);
}

function emitSkills(skills: EnterpriseSkill[]): void {
  cachedSkills = skills;
  skillListeners.forEach((l) => l(skills));
}

export async function fetchSkills(): Promise<EnterpriseSkill[]> {
  if (fetchSkillsPromise) {
    return fetchSkillsPromise;
  }

  fetchSkillsPromise = fetchSkillsInternal();

  try {
    return await fetchSkillsPromise;
  } finally {
    fetchSkillsPromise = null;
  }
}

async function fetchSkillsInternal(): Promise<EnterpriseSkill[]> {
  const org = getOrganization();
  if (!org) return [];

  const res = await enterpriseApi<EnterpriseSkill[]>(`/v1/orgs/${org.id}/skills`);
  const skills = res.data ?? [];
  emitSkills(skills);
  return skills;
}

export async function createSkill(input: CreateEnterpriseSkillInput): Promise<EnterpriseSkill | null> {
  const org = getOrganization();
  if (!org) return null;

  const sha256 = await sha256Hex(input.content);
  const res = await enterpriseApi<EnterpriseSkill>(`/v1/orgs/${org.id}/skills`, "POST", {
    ...input,
    sha256,
  });

  if (res.ok && res.data) {
    emitSkills([...cachedSkills, res.data]);
    return res.data;
  }
  return null;
}

export async function updateSkill(
  skillId: string,
  input: UpdateEnterpriseSkillInput,
): Promise<EnterpriseSkill | null> {
  const org = getOrganization();
  if (!org) return null;

  const payload: Record<string, unknown> = { ...input };
  if (input.content !== undefined) {
    payload.sha256 = await sha256Hex(input.content);
  }

  const res = await enterpriseApi<EnterpriseSkill>(
    `/v1/orgs/${org.id}/skills/${skillId}`,
    "PUT",
    payload,
  );

  if (res.ok && res.data) {
    const updatedSkill = res.data;
    emitSkills(cachedSkills.map((s) => (s.id === skillId ? updatedSkill : s)));
    return updatedSkill;
  }
  return null;
}

export async function deleteSkill(skillId: string): Promise<boolean> {
  const org = getOrganization();
  if (!org) return false;

  const res = await enterpriseApi(`/v1/orgs/${org.id}/skills/${skillId}`, "DELETE");
  if (res.ok) {
    emitSkills(cachedSkills.filter((s) => s.id !== skillId));
    return true;
  }
  return false;
}

export async function approveSkill(skillId: string): Promise<boolean> {
  const org = getOrganization();
  if (!org) return false;

  const res = await enterpriseApi(
    `/v1/orgs/${org.id}/skills/${skillId}/approve`,
    "POST",
  );

  if (res.ok) {
    emitSkills(
      cachedSkills.map((s) =>
        s.id === skillId ? { ...s, status: "approved" as EnterpriseSkillStatus } : s,
      ),
    );
    return true;
  }
  return false;
}

export function filterSkillsByStatus(skills: EnterpriseSkill[], status: EnterpriseSkillStatus): EnterpriseSkill[] {
  return skills.filter((s) => s.status === status);
}

export function searchSkills(skills: EnterpriseSkill[], query: string): EnterpriseSkill[] {
  const lower = query.toLowerCase();
  return skills.filter(
    (s) =>
      s.name.toLowerCase().includes(lower) ||
      s.description.toLowerCase().includes(lower) ||
      s.tags.some((t) => t.toLowerCase().includes(lower)),
  );
}
