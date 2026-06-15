import type {
  EnterpriseAgent,
  CreateEnterpriseAgentInput,
  UpdateEnterpriseAgentInput,
  EnterpriseAgentStatus,
} from "../types/enterprise-registry";
import { enterpriseApi } from "./enterprise-api.service";
import { getOrganization } from "./organization.service";

type AgentListener = (agents: EnterpriseAgent[]) => void;

let cachedAgents: EnterpriseAgent[] = [];
const agentListeners = new Set<AgentListener>();
let fetchAgentsPromise: Promise<EnterpriseAgent[]> | null = null;

export function getCachedAgents(): EnterpriseAgent[] {
  return cachedAgents;
}

export function subscribeToAgents(listener: AgentListener): () => void {
  agentListeners.add(listener);
  listener(cachedAgents);
  return () => agentListeners.delete(listener);
}

function emitAgents(agents: EnterpriseAgent[]): void {
  cachedAgents = agents;
  agentListeners.forEach((l) => l(agents));
}

export async function fetchAgents(): Promise<EnterpriseAgent[]> {
  if (fetchAgentsPromise) {
    return fetchAgentsPromise;
  }

  fetchAgentsPromise = fetchAgentsInternal();

  try {
    return await fetchAgentsPromise;
  } finally {
    fetchAgentsPromise = null;
  }
}

async function fetchAgentsInternal(): Promise<EnterpriseAgent[]> {
  const org = getOrganization();
  if (!org) return [];

  const res = await enterpriseApi<EnterpriseAgent[]>(`/v1/orgs/${org.id}/agents`);
  const agents = res.data ?? [];
  emitAgents(agents);
  return agents;
}

export async function createAgent(input: CreateEnterpriseAgentInput): Promise<EnterpriseAgent | null> {
  const org = getOrganization();
  if (!org) return null;

  const res = await enterpriseApi<EnterpriseAgent>(`/v1/orgs/${org.id}/agents`, "POST", input);
  if (res.ok && res.data) {
    emitAgents([...cachedAgents, res.data]);
    return res.data;
  }
  return null;
}

export async function updateAgent(
  agentId: string,
  input: UpdateEnterpriseAgentInput,
): Promise<EnterpriseAgent | null> {
  const org = getOrganization();
  if (!org) return null;

  const res = await enterpriseApi<EnterpriseAgent>(
    `/v1/orgs/${org.id}/agents/${agentId}`,
    "PUT",
    input,
  );

  if (res.ok && res.data) {
    emitAgents(cachedAgents.map((a) => (a.id === agentId ? res.data! : a)));
    return res.data;
  }
  return null;
}

export async function deleteAgent(agentId: string): Promise<boolean> {
  const org = getOrganization();
  if (!org) return false;

  const res = await enterpriseApi(`/v1/orgs/${org.id}/agents/${agentId}`, "DELETE");
  if (res.ok) {
    emitAgents(cachedAgents.filter((a) => a.id !== agentId));
    return true;
  }
  return false;
}

export function filterAgentsByStatus(agents: EnterpriseAgent[], status: EnterpriseAgentStatus): EnterpriseAgent[] {
  return agents.filter((a) => a.status === status);
}

export function searchAgents(agents: EnterpriseAgent[], query: string): EnterpriseAgent[] {
  const lower = query.toLowerCase();
  return agents.filter(
    (a) =>
      a.name.toLowerCase().includes(lower) ||
      a.description.toLowerCase().includes(lower) ||
      a.role.toLowerCase().includes(lower),
  );
}
