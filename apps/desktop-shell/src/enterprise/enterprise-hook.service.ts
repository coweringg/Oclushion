import type {
  EnterpriseHook,
  CreateEnterpriseHookInput,
  UpdateEnterpriseHookInput,
  HookEvent,
} from "../types/enterprise-registry";
import { enterpriseApi } from "./enterprise-api.service";
import { getOrganization } from "./organization.service";

type HookListener = (hooks: EnterpriseHook[]) => void;

let cachedHooks: EnterpriseHook[] = [];
const hookListeners = new Set<HookListener>();
let fetchHooksPromise: Promise<EnterpriseHook[]> | null = null;

export function getCachedHooks(): EnterpriseHook[] {
  return cachedHooks;
}

export function subscribeToHooks(listener: HookListener): () => void {
  hookListeners.add(listener);
  listener(cachedHooks);
  return () => hookListeners.delete(listener);
}

function emitHooks(hooks: EnterpriseHook[]): void {
  cachedHooks = hooks;
  hookListeners.forEach((l) => l(hooks));
}

export async function fetchHooks(): Promise<EnterpriseHook[]> {
  if (fetchHooksPromise) {
    return fetchHooksPromise;
  }

  fetchHooksPromise = fetchHooksInternal();

  try {
    return await fetchHooksPromise;
  } finally {
    fetchHooksPromise = null;
  }
}

async function fetchHooksInternal(): Promise<EnterpriseHook[]> {
  const org = getOrganization();
  if (!org) return [];

  const res = await enterpriseApi<EnterpriseHook[]>(`/v1/orgs/${org.id}/hooks`);
  const hooks = res.data ?? [];
  emitHooks(hooks);
  return hooks;
}

export async function createHook(input: CreateEnterpriseHookInput): Promise<EnterpriseHook | null> {
  const org = getOrganization();
  if (!org) return null;

  const res = await enterpriseApi<EnterpriseHook>(`/v1/orgs/${org.id}/hooks`, "POST", input);
  if (res.ok && res.data) {
    emitHooks([...cachedHooks, res.data]);
    return res.data;
  }
  return null;
}

export async function updateHook(
  hookId: string,
  input: UpdateEnterpriseHookInput,
): Promise<EnterpriseHook | null> {
  const org = getOrganization();
  if (!org) return null;

  const res = await enterpriseApi<EnterpriseHook>(
    `/v1/orgs/${org.id}/hooks/${hookId}`,
    "PUT",
    input,
  );

  if (res.ok && res.data) {
    emitHooks(cachedHooks.map((h) => (h.id === hookId ? res.data! : h)));
    return res.data;
  }
  return null;
}

export async function deleteHook(hookId: string): Promise<boolean> {
  const org = getOrganization();
  if (!org) return false;

  const res = await enterpriseApi(`/v1/orgs/${org.id}/hooks/${hookId}`, "DELETE");
  if (res.ok) {
    emitHooks(cachedHooks.filter((h) => h.id !== hookId));
    return true;
  }
  return false;
}

export async function toggleHook(hookId: string, enabled: boolean): Promise<boolean> {
  return updateHook(hookId, { enabled }) !== null;
}

export function filterHooksByEvent(hooks: EnterpriseHook[], event: HookEvent): EnterpriseHook[] {
  return hooks.filter((h) => h.event === event && h.enabled);
}

export function searchHooks(hooks: EnterpriseHook[], query: string): EnterpriseHook[] {
  const lower = query.toLowerCase();
  return hooks.filter(
    (h) =>
      h.name.toLowerCase().includes(lower) ||
      h.description.toLowerCase().includes(lower) ||
      h.event.toLowerCase().includes(lower),
  );
}
