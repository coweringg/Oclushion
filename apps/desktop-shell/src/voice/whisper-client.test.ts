import { afterEach, describe, expect, it, vi } from "vitest";

import { WhisperClient } from "./whisper-client";

describe("WhisperClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends audio to OpenAI Whisper and returns text", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ text: "crear validacion" }), { status: 200 }),
    );
    const client = new WhisperClient(() => "sk-test");

    const result = await client.transcribe(new Blob(["audio"]), { language: "ja" });

    expect(result.text).toBe("crear validacion");
    expect(fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/audio/transcriptions",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
