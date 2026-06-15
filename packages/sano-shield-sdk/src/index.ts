export type SanoProvider = "openai" | "anthropic";

export type SanoClientOptions = {
  baseUrl: string;
  apiKey: string;
  providerApiKey?: string;
  anthropicVersion?: string;
  fetch?: typeof fetch;
};

export type SanoRequestOptions = {
  providerApiKey?: string;
  anthropicVersion?: string;
  headers?: HeadersInit;
  signal?: AbortSignal;
};

export class SanoHttpError extends Error {
  public readonly status: number;
  public readonly body: unknown;

  public constructor(status: number, body: unknown) {
    super(`Sano Shield proxy request failed with status ${status}.`);
    this.name = "SanoHttpError";
    this.status = status;
    this.body = body;
  }
}

export class SanoClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly providerApiKey?: string;
  private readonly anthropicVersion?: string;
  private readonly fetch: typeof fetch;

  public readonly openai: {
    chat: {
      completions: {
        create: <TResponse = unknown, TBody = unknown>(
          body: TBody,
          options?: SanoRequestOptions,
        ) => Promise<TResponse>;
      };
    };
    responses: {
      create: <TResponse = unknown, TBody = unknown>(
        body: TBody,
        options?: SanoRequestOptions,
      ) => Promise<TResponse>;
    };
  };

  public readonly anthropic: {
    messages: {
      create: <TResponse = unknown, TBody = unknown>(
        body: TBody,
        options?: SanoRequestOptions,
      ) => Promise<TResponse>;
    };
  };

  public constructor(options: SanoClientOptions) {
    if (!options.apiKey.trim()) {
      throw new Error("Oclushion apiKey is required.");
    }

    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.apiKey = options.apiKey;
    this.providerApiKey = options.providerApiKey;
    this.anthropicVersion = options.anthropicVersion;
    this.fetch = options.fetch ?? globalThis.fetch;

    this.openai = {
      chat: {
        completions: {
          create: (body, requestOptions) =>
            this.request("openai", "v1/chat/completions", body, requestOptions),
        },
      },
      responses: {
        create: (body, requestOptions) =>
          this.request("openai", "v1/responses", body, requestOptions),
      },
    };

    this.anthropic = {
      messages: {
        create: (body, requestOptions) =>
          this.request("anthropic", "v1/messages", body, requestOptions),
      },
    };
  }

  public async request<TResponse = unknown, TBody = unknown>(
    provider: SanoProvider,
    path: string,
    body: TBody,
    options: SanoRequestOptions = {},
  ): Promise<TResponse> {
    const providerApiKey = options.providerApiKey ?? this.providerApiKey;
    if (!providerApiKey) {
      throw new Error("providerApiKey is required to reach the selected AI provider.");
    }

    const headers = new Headers(options.headers);
    headers.set("content-type", "application/json");
    headers.set("x-sano-api-key", this.apiKey);

    if (provider === "openai") {
      headers.set("authorization", `Bearer ${providerApiKey}`);
    } else {
      headers.set("x-api-key", providerApiKey);
      headers.set(
        "anthropic-version",
        options.anthropicVersion ?? this.anthropicVersion ?? "2023-06-01",
      );
    }

    const response = await this.fetch(`${this.baseUrl}/v1/proxy/${provider}/${cleanPath(path)}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: options.signal,
    });
    const responseBody = await parseResponse(response);

    if (!response.ok) {
      throw new SanoHttpError(response.status, responseBody);
    }

    return responseBody as TResponse;
  }
}

function normalizeBaseUrl(value: string): string {
  const url = new URL(value);
  return url.toString().replace(/\/+$/, "");
}

function cleanPath(value: string): string {
  return value.replace(/^\/+/, "");
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }

  if (response.headers.get("content-type")?.includes("application/json")) {
    return JSON.parse(text) as unknown;
  }

  return text;
}
