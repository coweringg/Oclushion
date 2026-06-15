import { describe, expect, it, vi } from "vitest";

import { VoiceCaptureService } from "./voice-capture.service";

function createMockWhisper() {
  return { transcribe: vi.fn().mockResolvedValue({ text: "hello world" }) };
}

function createMockShield() {
  return { sanitize: vi.fn().mockReturnValue({ sanitizedText: "hello world", mappings: [] }) };
}

describe("VoiceCaptureService", () => {
  it("throws when voice is disabled", async () => {
    const service = new VoiceCaptureService(createMockWhisper() as never, createMockShield() as never, {
      enabled: false,
      language: "auto",
      model: "whisper-1",
      autoCreateKanbanTask: false,
    });
    await expect(service.startRecording()).rejects.toThrow("Voice input is disabled");
  });

  it("transcribe sanitizes whisper output through SanoShield", async () => {
    const whisper = createMockWhisper();
    const shield = createMockShield();
    const service = new VoiceCaptureService(whisper as never, shield as never);

    const result = await service.transcribe(new Blob(["audio"]));

    expect(whisper.transcribe).toHaveBeenCalled();
    expect(shield.sanitize).toHaveBeenCalledWith("hello world");
    expect(result).toBe("hello world");
  });

  it("passes language setting to whisper", async () => {
    const whisper = createMockWhisper();
    const service = new VoiceCaptureService(whisper as never, createMockShield() as never, {
      enabled: true,
      language: "es",
      model: "whisper-1",
      autoCreateKanbanTask: false,
    });

    await service.transcribe(new Blob(["audio"]));
    expect(whisper.transcribe).toHaveBeenCalledWith(expect.any(Blob), { language: "es" });
  });

  it("passes null language for auto", async () => {
    const whisper = createMockWhisper();
    const service = new VoiceCaptureService(whisper as never, createMockShield() as never);

    await service.transcribe(new Blob(["audio"]));
    expect(whisper.transcribe).toHaveBeenCalledWith(expect.any(Blob), { language: null });
  });

  it("recordingDurationMs returns 0 when not started", () => {
    const service = new VoiceCaptureService(createMockWhisper() as never, createMockShield() as never);
    expect(service.recordingDurationMs()).toBe(0);
  });

  it("stopRecording throws when no active recording", async () => {
    const service = new VoiceCaptureService(createMockWhisper() as never, createMockShield() as never);
    await expect(service.stopRecording()).rejects.toThrow("No active voice recording");
  });
});
