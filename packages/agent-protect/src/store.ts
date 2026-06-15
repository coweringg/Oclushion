import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { AgentSessionManifest } from "./types.js";

export function agentHome() {
  return process.env.SANO_AGENT_HOME ?? path.join(os.homedir(), ".sano", "agent-protect");
}

export function manifestPath(sessionId: string) {
  return path.join(agentHome(), `${sessionId}.json`);
}

export async function saveManifest(manifest: AgentSessionManifest) {
  await mkdir(agentHome(), { recursive: true });
  await writeFile(manifestPath(manifest.id), JSON.stringify(manifest, null, 2), {
    encoding: "utf8",
  });
}

export async function loadManifest(sessionId: string): Promise<AgentSessionManifest> {
  return JSON.parse(await readFile(manifestPath(sessionId), "utf8")) as AgentSessionManifest;
}
