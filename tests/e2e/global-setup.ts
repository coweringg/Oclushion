import type { FullConfig } from "@playwright/test";

const API_BASE = process.env.CONTROL_API_URL ?? "http://127.0.0.1:8082";

async function globalSetup(_config: FullConfig): Promise<void> {
  void _config;
  const healthResp = await fetch(`${API_BASE}/health`);
  if (!healthResp.ok) {
    throw new Error(`Health check failed: ${healthResp.status}`);
  }
}

export default globalSetup;
