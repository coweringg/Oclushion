import { SanoShield } from "../sano-shield.service";
import type { WhisperClient } from "./whisper-client";
import type { VoiceSettings } from "./voice.types";

export class VoiceCaptureService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private startedAt = 0;

  public constructor(
    private readonly whisper: WhisperClient,
    private readonly shield: SanoShield,
    private readonly settings: VoiceSettings = {
      enabled: true,
      language: "auto",
      model: "whisper-1",
      autoCreateKanbanTask: false,
    },
  ) {}

  public async startRecording(): Promise<void> {
    if (!this.settings.enabled) {
      throw new Error("Voice input is disabled.");
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Microphone capture is unavailable in this environment.");
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioChunks = [];
    this.mediaRecorder = new MediaRecorder(stream);
    this.mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    });
    this.startedAt = Date.now();
    this.mediaRecorder.start();
  }

  public async stopRecording(): Promise<Blob> {
    if (!this.mediaRecorder) {
      throw new Error("No active voice recording.");
    }
    const recorder = this.mediaRecorder;
    const stopped = new Promise<void>((resolve) => {
      recorder.addEventListener("stop", () => resolve(), { once: true });
    });
    recorder.stop();
    recorder.stream.getTracks().forEach((track) => track.stop());
    await stopped;
    this.mediaRecorder = null;
    return new Blob(this.audioChunks, { type: recorder.mimeType || "audio/webm" });
  }

  public async transcribe(audioBlob: Blob): Promise<string> {
    const language = this.settings.language === "auto" ? null : this.settings.language;
    const result = await this.whisper.transcribe(audioBlob, { language });
    return this.shield.sanitize(result.text).sanitizedText;
  }

  public recordingDurationMs(): number {
    return this.startedAt ? Date.now() - this.startedAt : 0;
  }
}
