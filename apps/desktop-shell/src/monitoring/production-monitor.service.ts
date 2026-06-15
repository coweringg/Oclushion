import type { MonitorConfig, MonitoredIssue, SentryIssue, SentryEvent, SentryExceptionValue } from "./monitoring.types";
import { logger } from "../utils/logger";

type MonitorListener = (issues: MonitoredIssue[]) => void;

export class ProductionMonitorService {
  private config: MonitorConfig | null = null;
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private knownIssueIds = new Set<string>();
  private trackedIssues: MonitoredIssue[] = [];
  private readonly listeners = new Set<MonitorListener>();

  public configure(config: MonitorConfig): void {
    this.stop();
    this.config = config;
    if (config.autoFixEnabled) {
      this.start();
    }
    logger.info("ProductionMonitor", `Configured for ${config.organizationSlug}/${config.projectSlug}`);
  }

  public getConfig(): MonitorConfig | null {
    return this.config;
  }

  public getTrackedIssues(): MonitoredIssue[] {
    return [...this.trackedIssues];
  }

  public start(): void {
    if (!this.config || this.pollingTimer) return;
    logger.info("ProductionMonitor", `Polling started every ${this.config.pollingIntervalMs}ms`);
    this.pollingTimer = setInterval(() => {
      void this.poll();
    }, this.config.pollingIntervalMs);
    void this.poll();
  }

  public stop(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
      logger.info("ProductionMonitor", "Polling stopped");
    }
  }

  public markFixing(issueId: string, taskId: string): void {
    const tracked = this.trackedIssues.find(t => t.issue.id === issueId);
    if (tracked) {
      tracked.fixStatus = "fixing";
      tracked.fixTaskId = taskId;
      this.emit();
    }
  }

  public markFixed(issueId: string): void {
    const tracked = this.trackedIssues.find(t => t.issue.id === issueId);
    if (tracked) {
      tracked.fixStatus = "fixed";
      this.emit();
    }
  }

  public markSkipped(issueId: string): void {
    const tracked = this.trackedIssues.find(t => t.issue.id === issueId);
    if (tracked) {
      tracked.fixStatus = "skipped";
      this.emit();
    }
  }

  public subscribe(listener: MonitorListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private async poll(): Promise<void> {
    if (!this.config) return;

    try {
      const issues = await this.fetchUnresolvedIssues();
      const newIssues = issues.filter(issue => !this.knownIssueIds.has(issue.id));

      for (const issue of newIssues) {
        this.knownIssueIds.add(issue.id);
        const event = await this.fetchLatestEvent(issue.id);
        const stackTrace = this.extractStackTrace(event);
        const affectedFiles = this.extractAffectedFiles(event);

        const tracked: MonitoredIssue = {
          issue,
          stackTrace,
          affectedFiles,
          fixStatus: "pending",
          detectedAt: new Date().toISOString(),
        };

        this.trackedIssues.push(tracked);
        logger.info("ProductionMonitor", `New issue detected: ${issue.title} (${affectedFiles.length} files)`);
      }

      if (newIssues.length > 0) {
        this.emit();
      }
    } catch (err) {
      logger.warn("ProductionMonitor", `Polling failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  private async fetchUnresolvedIssues(): Promise<SentryIssue[]> {
    if (!this.config) return [];

    const url = `https://sentry.io/api/0/projects/${this.config.organizationSlug}/${this.config.projectSlug}/issues/?query=is:unresolved&statsPeriod=24h&sort=date`;

    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${this.config.authToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Sentry API returned ${response.status}`);
    }

    return response.json() as Promise<SentryIssue[]>;
  }

  private async fetchLatestEvent(issueId: string): Promise<SentryEvent | null> {
    if (!this.config) return null;

    const url = `https://sentry.io/api/0/issues/${issueId}/events/latest/`;

    try {
      const response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${this.config.authToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) return null;
      return response.json() as Promise<SentryEvent>;
    } catch {
      return null;
    }
  }

  private extractStackTrace(event: SentryEvent | null): string {
    if (!event) return "No stack trace available";

    for (const entry of event.entries) {
      if (entry.type === "exception" && entry.data.values) {
        return entry.data.values
          .map((exc: SentryExceptionValue) => {
            const frames = exc.stacktrace?.frames
              ?.filter(f => f.inApp)
              .map(f => `  at ${f.function} (${f.filename}:${f.lineNo}:${f.colNo})`)
              .reverse()
              .join("\n") ?? "";
            return `${exc.type}: ${exc.value}\n${frames}`;
          })
          .join("\n\n");
      }
    }

    return event.message || "No stack trace available";
  }

  private extractAffectedFiles(event: SentryEvent | null): string[] {
    if (!event) return [];

    const files = new Set<string>();
    for (const entry of event.entries) {
      if (entry.type === "exception" && entry.data.values) {
        for (const exc of entry.data.values) {
          if (exc.stacktrace?.frames) {
            for (const frame of exc.stacktrace.frames) {
              if (frame.inApp && frame.filename) {
                files.add(frame.filename);
              }
            }
          }
        }
      }
    }

    return Array.from(files);
  }

  private emit(): void {
    const snapshot = this.getTrackedIssues();
    this.listeners.forEach(listener => listener(snapshot));
  }
}
