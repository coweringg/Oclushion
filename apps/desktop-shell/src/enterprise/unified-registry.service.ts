import type { KeyValueStore } from "../persistent-store";
import type { EnterpriseSkill, EnterpriseAgent, EnterpriseHook } from "../types/enterprise-registry";
import type { MarketplaceSkillView, Skill, MarketplaceCatalog } from "../marketplace/marketplace.types";
import { getOrganization } from "./organization.service";
import { getCachedSkills, subscribeToSkills, fetchSkills } from "./enterprise-skill.service";
import { escapeXml } from "../utils/escape-xml.js";
import { getCachedAgents, subscribeToAgents, fetchAgents } from "./enterprise-agent.service";
import { getCachedHooks, subscribeToHooks, fetchHooks } from "./enterprise-hook.service";

export type UnifiedSkillView = {
  source: "org" | "public";
  skill: Skill;
  enterpriseSkill?: EnterpriseSkill;
  installState: "available" | "installed" | "update_available" | "locked";
};

type UnifiedRegistryListener = () => void;
const unifiedListeners = new Set<UnifiedRegistryListener>();

export function subscribeToUnifiedRegistry(listener: UnifiedRegistryListener): () => void {
  unifiedListeners.add(listener);
  return () => unifiedListeners.delete(listener);
}

function emitUnifiedChange(): void {
  unifiedListeners.forEach((l) => l());
}

subscribeToSkills(() => emitUnifiedChange());
subscribeToAgents(() => emitUnifiedChange());
subscribeToHooks(() => emitUnifiedChange());

export async function initializeEnterpriseRegistry(): Promise<void> {
  const org = getOrganization();
  if (!org) return;

  await Promise.all([fetchSkills(), fetchAgents(), fetchHooks()]);
}

export function buildUnifiedSkillList(
  publicCatalog: MarketplaceCatalog,
  installedSkillIds: string[],
  installedSkillVersions: Map<string, string>,
): UnifiedSkillView[] {
  const org = getOrganization();
  const orgSkills = org ? getCachedSkills() : [];
  const approvedOrgSkills = orgSkills.filter((s) => s.status === "approved");

  const result: UnifiedSkillView[] = [];

  for (const enterpriseSkill of approvedOrgSkills) {
    const publicEquivalent = publicCatalog.skills.find(
      (s) => s.name.toLowerCase() === enterpriseSkill.name.toLowerCase(),
    );

    if (publicEquivalent) {
      const installed = installedSkillVersions.get(publicEquivalent.id);
      const installState = !installed
        ? "available"
        : installed !== publicEquivalent.version
          ? "update_available"
          : "installed";

      result.push({
        source: "org",
        skill: publicEquivalent,
        enterpriseSkill,
        installState,
      });
    } else {
      const syntheticSkill: Skill = {
        id: `org-${enterpriseSkill.id}`,
        name: enterpriseSkill.name,
        description: enterpriseSkill.description,
        category: enterpriseSkill.category,
        tier: "enterprise",
        version: enterpriseSkill.version,
        downloadUrl: "",
        sha256: enterpriseSkill.sha256,
        sizeKb: Math.ceil(new TextEncoder().encode(enterpriseSkill.content).length / 1024),
        keywords: enterpriseSkill.tags,
        previewLines: enterpriseSkill.content.split("\n").slice(0, 3),
      };

      result.push({
        source: "org",
        skill: syntheticSkill,
        enterpriseSkill,
        installState: "available",
      });
    }
  }

  for (const publicSkill of publicCatalog.skills) {
    const alreadyAdded = result.some(
      (r) => r.skill.id === publicSkill.id || r.skill.name === publicSkill.name,
    );
    if (alreadyAdded) continue;

    const installed = installedSkillVersions.get(publicSkill.id);
    const installState = !installed
      ? "available"
      : installed !== publicSkill.version
        ? "update_available"
        : "installed";

    result.push({
      source: "public",
      skill: publicSkill,
      installState,
    });
  }

  return result;
}

export function searchUnifiedSkills(
  unified: UnifiedSkillView[],
  query: string,
): UnifiedSkillView[] {
  const lower = query.toLowerCase();
  return unified.filter(
    (item) =>
      item.skill.name.toLowerCase().includes(lower) ||
      item.skill.description.toLowerCase().includes(lower) ||
      (item.enterpriseSkill?.tags.some((t) => t.toLowerCase().includes(lower)) ?? false),
  );
}

export function filterUnifiedBySource(
  unified: UnifiedSkillView[],
  source: "org" | "public",
): UnifiedSkillView[] {
  return unified.filter((item) => item.source === source);
}

export function filterUnifiedByCategory(
  unified: UnifiedSkillView[],
  category: string,
): UnifiedSkillView[] {
  return unified.filter((item) => item.skill.category === category);
}

export function getApprovedAgents(): EnterpriseAgent[] {
  const org = getOrganization();
  if (!org) return [];
  return getCachedAgents().filter((a) => a.status === "approved");
}

export function getApprovedHooks(): EnterpriseHook[] {
  const org = getOrganization();
  if (!org) return [];
  return getCachedHooks().filter((h) => h.enabled);
}

export function buildEnterpriseSkillsContext(): string {
  const org = getOrganization();
  if (!org) return "";

  const approved = getCachedSkills().filter((s) => s.status === "approved");
  if (!approved.length) return "";

  const lines = approved.map(
    (s) => `  <skill id="${escapeXml(s.id)}" name="${escapeXml(s.name)}" version="${escapeXml(s.version)}"><![CDATA[\n${s.content}\n  ]]></skill>`,
  );

  return [
    `<enterprise_skills org="${escapeXml(org.name)}">`,
    ...lines,
    "</enterprise_skills>",
  ].join("\n");
}

export function buildEnterpriseAgentsContext(): string {
  const org = getOrganization();
  if (!org) return "";

  const approved = getApprovedAgents();
  if (!approved.length) return "";

  const lines = approved.map(
    (a) =>
      `  <agent id="${escapeXml(a.id)}" name="${escapeXml(a.name)}" role="${escapeXml(a.role)}">\n    ${escapeXml(a.systemPrompt)}\n  </agent>`,
  );

  return [
    `<enterprise_agents org="${escapeXml(org.name)}">`,
    ...lines,
    "</enterprise_agents>",
  ].join("\n");
}
