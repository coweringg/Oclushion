import type { Page } from "@playwright/test";

const API_BASE = process.env.CONTROL_API_URL ?? "http://127.0.0.1:8082";

export async function apiPost(path: string, body: unknown, token?: string): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

export async function loginAs(page: Page, email: string, password: string): Promise<string> {
  const res = await apiPost("/v1/auth/login", { email, password });
  const data = await res.json();
  if (data.token) {
    await page.evaluate((t) => localStorage.setItem("session_token", t), data.token);
    return data.token;
  }
  return "";
}

export function generateTestEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.oclushion.local`;
}
