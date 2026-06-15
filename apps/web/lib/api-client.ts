const CONTROL_API_URL = process.env.NEXT_PUBLIC_CONTROL_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  public constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiGet<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${CONTROL_API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, (body as { message?: string }).message ?? `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function apiPost<T>(path: string, token: string, body?: unknown): Promise<T> {
  const response = await fetch(`${CONTROL_API_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, (body as { message?: string }).message ?? `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function apiDelete(path: string, token: string): Promise<void> {
  const response = await fetch(`${CONTROL_API_URL}${path}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, (body as { message?: string }).message ?? `HTTP ${response.status}`);
  }
}

export async function apiLogin(email: string, password: string): Promise<{ token: string; user: { id: string; email: string; name: string } }> {
  const response = await fetch(`${CONTROL_API_URL}/v1/desktop/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, (body as { message?: string }).message ?? "Login failed");
  }
  return response.json() as Promise<{ token: string; user: { id: string; email: string; name: string } }>;
}
