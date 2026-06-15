import { z } from "zod";
import type { WhisperTranscription } from "./voice.types";

const whisperResponseSchema = z.object({ text: z.string() });

export type WhisperLanguage = "en" | "es" | "fr" | "zh" | "pt" | "de" | "ja" | "ko" | null;

export type WhisperTranscribeOptions = {
  language?: WhisperLanguage;
  prompt?: string;
};

export class WhisperClient {
  public constructor(
    private readonly apiKeyProvider: () => string | null | Promise<string | null>,
    private readonly baseUrl = "https://api.openai.com/v1/audio/transcriptions",
  ) {}

  public async transcribe(audioBlob: Blob, options: WhisperTranscribeOptions = {}): Promise<WhisperTranscription> {
    const apiKey = await this.apiKeyProvider();
    if (!apiKey) {
      throw new Error("OpenAI API key is required for Whisper transcription.");
    }
    const formData = new FormData();
    formData.append("file", audioBlob, "recording.webm");
    formData.append("model", "whisper-1");
    if (options.language) {
      formData.append("language", options.language);
    }
    if (options.prompt?.trim()) {
      formData.append("prompt", options.prompt.trim());
    }
    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });
    if (!response.ok) {
      throw new Error(`Whisper transcription failed with HTTP ${response.status}`);
    }
    const raw = await response.json();
    const payload = whisperResponseSchema.safeParse(raw);
    if (!payload.success) {
      throw new Error("Whisper response did not include text.");
    }
    return { text: payload.data.text };
  }
}
