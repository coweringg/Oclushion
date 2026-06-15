export type AttackVector =
  | "sql-injection"
  | "xss"
  | "path-traversal"
  | "race-condition"
  | "oversized-input"
  | "empty-input"
  | "unicode-abuse"
  | "expired-token"
  | "null-injection"
  | "prototype-pollution"
  | "dos-loop"
  | "type-coercion";

export type AttackResult = {
  id: string;
  vector: AttackVector;
  description: string;
  targetFile: string;
  targetFunction: string;
  survived: boolean;
  evidence: string;
  severity: "critical" | "high" | "medium" | "low";
  executedAt: string;
};

export type BreakerReport = {
  id: string;
  sessionId: string;
  totalAttacks: number;
  survived: number;
  failed: number;
  survivalRate: number;
  attacks: AttackResult[];
  generatedAt: string;
};

export type PhantomTask = {
  id: string;
  source: "todo-comment" | "sentry-issue" | "memory-lesson" | "predicted";
  title: string;
  description: string;
  targetFiles: string[];
  status: "queued" | "building" | "breaking" | "survived" | "needs-review" | "failed";
  buildOutput?: string;
  breakerReport?: BreakerReport;
  diffPreview?: string;
  createdAt: string;
  completedAt?: string;
};

export type PhantomSession = {
  id: string;
  startedAt: string;
  finishedAt?: string;
  userAbsentSince: string;
  status: "running" | "completed" | "aborted";
  tasks: PhantomTask[];
  totalBuilds: number;
  totalAttacks: number;
  overallSurvivalRate: number;
};

export type BriefingState = {
  isVisible: boolean;
  session: PhantomSession | null;
  selectedTaskId: string | null;
};
