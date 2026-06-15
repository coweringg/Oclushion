import type { ModelRouter } from "../llm/model-router";
import { logger } from "../utils/logger";
import type { PreviewConfig, PreviewConsoleLog, PreviewFramework, VisualVerificationResult } from "./preview.types";

export type PreviewHealthProbe = (url: string) => Promise<boolean>;
export type ScreenshotProvider = () => Promise<string>;

export class PreviewService {
  private config: PreviewConfig | null = null;
  private logs: PreviewConsoleLog[] = [];

  public constructor(
    private readonly healthProbe: PreviewHealthProbe = defaultHealthProbe,
    private readonly screenshotProvider: ScreenshotProvider = defaultScreenshotProvider,
  ) {}

  public async startPreviewServer(input: {
    workspacePath: string;
    preferredPort?: number;
    framework?: PreviewFramework;
  }): Promise<PreviewConfig> {
    const framework = input.framework ?? inferFramework(input.workspacePath);
    const port = await this.findAvailablePort(input.preferredPort ?? defaultPort(framework));
    this.config = {
      port,
      framework,
      autoReload: true,
      url: `http://localhost:${port}`,
    };
    this.addConsoleLog({ level: "info", message: `${framework} preview attached on ${this.config.url}` });
    return { ...this.config };
  }

  public getConfig(): PreviewConfig | null {
    return this.config ? { ...this.config } : null;
  }

  public async captureScreenshot(): Promise<string> {
    return this.screenshotProvider();
  }

  public async verifyVisualState(input: {
    modelRouter: Pick<ModelRouter, "generate" | "stream">;
    expectedDesign: string;
    model?: string;
  }): Promise<VisualVerificationResult> {
    const screenshot = await this.captureScreenshot();
    const response = await input.modelRouter.generate({
      model: input.model ?? "gpt-5.4-mini",
      systemPrompt: "You are Oclushion QA Vision Agent. Return PASS or FAIL with concise visual issues.",
      userMessage: `Expected design:\n${input.expectedDesign}\n\nScreenshot(base64):\n${screenshot.slice(0, 120_000)}`,
    });
    const passed = /\bPASS\b/iu.test(response.content) && !/\bFAIL\b/iu.test(response.content);
    return {
      passed,
      screenshotPath: "memory://live-preview/latest",
      issuesDetected: passed ? [] : extractIssues(response.content),
    };
  }

  public addConsoleLog(log: Omit<PreviewConsoleLog, "timestamp"> | PreviewConsoleLog): void {
    const entry: PreviewConsoleLog = "timestamp" in log ? log : { ...log, timestamp: new Date().toISOString() };
    this.logs = [entry, ...this.logs].slice(0, 200);
  }

  public getLogs(): PreviewConsoleLog[] {
    return [...this.logs];
  }

  public clearLogs(): void {
    this.logs = [];
  }

  private async findAvailablePort(startPort: number): Promise<number> {
    for (let port = startPort; port < startPort + 20; port += 1) {
      if (await this.healthProbe(`http://localhost:${port}`)) {
        return port;
      }
    }
    return startPort;
  }
}

async function defaultHealthProbe(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 600);
    const response = await fetch(url, { method: "HEAD", cache: "no-store", signal: controller.signal });
    window.clearTimeout(timeout);
    return response.ok || response.status < 500;
  } catch (error) {
    logger.debug('PreviewService', `Health probe failed for ${url}`, error);
    return false;
  }
}

async function defaultScreenshotProvider(): Promise<string> {
  if (typeof document === "undefined") {
    return "";
  }
  return btoa(unescape(encodeURIComponent(document.documentElement.outerHTML.slice(0, 250_000))));
}

function inferFramework(workspacePath: string): PreviewFramework {
  const normalized = workspacePath.toLowerCase();
  if (normalized.includes("next")) return "nextjs";
  if (normalized.includes("vite")) return "vite";
  return "custom";
}

function defaultPort(framework: PreviewFramework): number {
  if (framework === "nextjs") return 3000;
  if (framework === "vite") return 5173;
  return 8080;
}

function extractIssues(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/u, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, 8);
}
