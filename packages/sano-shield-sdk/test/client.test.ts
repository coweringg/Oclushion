import { describe, expect, it, vi } from "vitest";

import { SanoClient } from "../src/index.js";
import type { SanoHttpError } from "../src/index.js";

describe("SanoClient", () => {
  it("routes OpenAI chat calls through Sano Shield with separate client and provider keys", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ choices: [{ message: { content: "ok" } }] }));
    const client = new SanoClient({
      baseUrl: "https://shield.oclushion.test/",
      apiKey: "oclushion_live_client",
      providerApiKey: "openai_provider_key",
      fetch: request,
    });

    const result = await client.openai.chat.completions.create<{ choices: unknown[] }>({
      messages: [{ role: "user", content: "Hola" }],
    });

    expect(result.choices).toHaveLength(1);
    expect(request).toHaveBeenCalledOnce();
    const [url, options] = request.mock.calls[0]!;
    const headers = new Headers(options?.headers);
    expect(url).toBe("https://shield.oclushion.test/v1/proxy/openai/v1/chat/completions");
    expect(headers.get("x-sano-api-key")).toBe("oclushion_live_client");
    expect(headers.get("authorization")).toBe("Bearer openai_provider_key");
  });

  it("routes Anthropic calls using its provider headers", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ content: [] }));
    const client = new SanoClient({
      baseUrl: "https://shield.oclushion.test",
      apiKey: "oclushion_live_client",
      providerApiKey: "anthropic_provider_key",
      anthropicVersion: "2023-06-01",
      fetch: request,
    });

    await client.anthropic.messages.create({ messages: [] });

    const [, options] = request.mock.calls[0]!;
    const headers = new Headers(options?.headers);
    expect(headers.get("x-sano-api-key")).toBe("oclushion_live_client");
    expect(headers.get("x-api-key")).toBe("anthropic_provider_key");
    expect(headers.get("anthropic-version")).toBe("2023-06-01");
    expect(headers.get("authorization")).toBeNull();
  });

  it("returns actionable proxy errors", async () => {
    const client = new SanoClient({
      baseUrl: "https://shield.oclushion.test",
      apiKey: "oclushion_live_client",
      providerApiKey: "provider_key",
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json({ error: "Valid Oclushion API key required." }, { status: 401 }),
        ),
    });

    await expect(client.openai.responses.create({ input: "hello" })).rejects.toEqual(
      expect.objectContaining<SanoHttpError>({
        name: "SanoHttpError",
        message: "Sano Shield proxy request failed with status 401.",
        status: 401,
        body: { error: "Valid Oclushion API key required." },
      }),
    );
  });
});
