export type PreviewFramework = "vite" | "nextjs" | "custom";

export type PreviewConfig = {
  url: string;
  port: number;
  framework: PreviewFramework;
  autoReload: boolean;
};

export type PreviewConsoleLog = {
  level: "log" | "info" | "warn" | "error";
  message: string;
  timestamp: string;
};

export type VisualVerificationResult = {
  passed: boolean;
  screenshotPath: string;
  issuesDetected: string[];
};
