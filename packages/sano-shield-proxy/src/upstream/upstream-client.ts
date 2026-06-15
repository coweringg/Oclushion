import { request } from "undici";

export type UpstreamRequest = {
  url: URL;
  headers: Record<string, string>;
  body: unknown;
  timeoutMs?: number;
  retryMax?: number;
};

export type UpstreamResponse = {
  statusCode: number;
  contentType: string;
  body: unknown;
};

export interface UpstreamClient {
  forward(input: UpstreamRequest): Promise<UpstreamResponse>;
}

export class UndiciUpstreamClient implements UpstreamClient {
  public async forward(input: UpstreamRequest): Promise<UpstreamResponse> {
    const timeoutMs = input.timeoutMs ?? 30000;
    const retryMax = input.retryMax ?? 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retryMax; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const response = await request(input.url, {
            method: "POST",
            headers: {
              ...input.headers,
              "content-type": "application/json",
            },
            body: JSON.stringify(input.body),
            signal: controller.signal,
          });

          const contentType = String(response.headers["content-type"] ?? "application/json");
          const text = await response.body.text();

          return {
            statusCode: response.statusCode,
            contentType,
            body: contentType.includes("application/json") ? JSON.parse(text) : text,
          };
        } finally {
          clearTimeout(timer);
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < retryMax) {
          const backoffMs = 200 * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }
    }

    throw lastError ?? new Error("Upstream request failed after retries.");
  }
}
