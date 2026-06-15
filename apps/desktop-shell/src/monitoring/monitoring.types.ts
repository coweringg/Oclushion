export type SentryIssue = {
  id: string;
  title: string;
  culprit: string;
  level: "fatal" | "error" | "warning" | "info";
  status: "unresolved" | "resolved" | "ignored";
  count: number;
  firstSeen: string;
  lastSeen: string;
  permalink: string;
  metadata: {
    type: string;
    value: string;
    filename?: string;
    function?: string;
  };
};

export type SentryEvent = {
  eventID: string;
  title: string;
  message: string;
  platform: string;
  dateCreated: string;
  entries: SentryEventEntry[];
};

export type SentryEventEntry = {
  type: "exception" | "message" | "breadcrumbs";
  data: {
    values?: SentryExceptionValue[];
  };
};

export type SentryExceptionValue = {
  type: string;
  value: string;
  stacktrace?: {
    frames: SentryStackFrame[];
  };
};

export type SentryStackFrame = {
  filename: string;
  function: string;
  lineNo: number;
  colNo: number;
  absPath: string;
  context?: Array<[number, string]>;
  inApp: boolean;
};

export type MonitorConfig = {
  provider: "sentry";
  dsn: string;
  authToken: string;
  organizationSlug: string;
  projectSlug: string;
  pollingIntervalMs: number;
  autoFixEnabled: boolean;
};

export type MonitoredIssue = {
  issue: SentryIssue;
  stackTrace: string;
  affectedFiles: string[];
  fixStatus: "pending" | "fixing" | "fixed" | "skipped";
  fixTaskId?: string;
  detectedAt: string;
};
