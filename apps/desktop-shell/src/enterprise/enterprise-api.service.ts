import { z } from "zod";
import { getControlApiUrl, getStoredSession } from "../auth.service";
import { logger } from "../utils/logger";

const errorResponseSchema = z.object({
  error: z.string().optional(),
  message: z.unknown().optional(),
});

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

type ApiResponse<T> = {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
};

export async function enterpriseApi<T>(
  path: string,
  method: HttpMethod = "GET",
  body?: unknown,
): Promise<ApiResponse<T>> {
  const baseUrl = getControlApiUrl();
  if (!baseUrl) {
    return { ok: false, status: 0, error: "Control API not configured" };
  }

  const session = getStoredSession();
  if (!session) {
    return { ok: false, status: 401, error: "Not authenticated" };
  }

  const url = `${baseUrl}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.token}`,
  };

  const init: RequestInit = { method, headers };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, init);
    if (!response.ok) {
      const errorBody = await readErrorResponse(response);
      return { ok: false, status: response.status, error: errorBody };
    }
    const data = (await response.json()) as T;
    return { ok: true, status: response.status, data };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

async function readErrorResponse(response: Response): Promise<string> {
  try {
    const parsed = errorResponseSchema.safeParse(await response.json());
    const payload = parsed.success ? parsed.data : {};
    const message = typeof payload.error === "string" ? payload.error : payload.message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  } catch (error) {
    logger.debug('EnterpriseAPI', 'Response body is not JSON', error);
  }
  return `HTTP ${response.status}`;
}
