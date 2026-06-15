export type WorklogCategory = "context" | "model" | "command" | "file" | "proposal" | "security";

export type WorklogEntry = {
  id: string;
  timestamp: string;
  category: WorklogCategory;
  icon: string;
  message: string;
  detail?: string;
  durationMs?: number;
};

type WorklogListener = (entries: WorklogEntry[]) => void;

export class WorklogService {
  private entries: WorklogEntry[] = [];
  private readonly listeners = new Set<WorklogListener>();

  public log(entry: Omit<WorklogEntry, "id" | "timestamp">): WorklogEntry {
    const full: WorklogEntry = {
      ...entry,
      id: createWorklogId(),
      timestamp: new Date().toISOString(),
    };
    this.entries = [...this.entries, full].slice(-200);
    this.emit();
    return full;
  }

  public context(message: string, detail?: string): WorklogEntry {
    return this.log({ category: "context", icon: "CTX", message, detail });
  }

  public model(message: string, durationMs?: number): WorklogEntry {
    return this.log({ category: "model", icon: "LLM", message, durationMs });
  }

  public command(message: string, detail?: string): WorklogEntry {
    return this.log({ category: "command", icon: "CMD", message, detail });
  }

  public file(message: string, detail?: string): WorklogEntry {
    return this.log({ category: "file", icon: "FILE", message, detail });
  }

  public proposal(message: string, detail?: string): WorklogEntry {
    return this.log({ category: "proposal", icon: "DIFF", message, detail });
  }

  public security(message: string, detail?: string): WorklogEntry {
    return this.log({ category: "security", icon: "SAFE", message, detail });
  }

  public getEntries(): WorklogEntry[] {
    return this.entries.map((entry) => ({ ...entry }));
  }

  public clear(): void {
    this.entries = [];
    this.emit();
  }

  public subscribe(listener: WorklogListener): () => void {
    this.listeners.add(listener);
    listener(this.getEntries());
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const snapshot = this.getEntries();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

function createWorklogId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `worklog-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
