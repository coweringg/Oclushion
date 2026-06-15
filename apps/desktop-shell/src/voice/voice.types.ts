export type VoiceRecordingState = "idle" | "recording" | "processing" | "error";

export type VoiceSettings = {
  enabled: boolean;
  language: "auto" | "en" | "es" | "fr" | "zh" | "pt" | "de" | "ja" | "ko";
  model: "whisper-1";
  autoCreateKanbanTask: boolean;
};

export type WhisperTranscription = {
  text: string;
  durationMs?: number;
};
