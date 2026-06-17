import { hostname as getHostname } from "node:os";

export type AuthErrorClass = "invalid_key" | "bad_format" | "config_missing" | "crypto_mismatch" | "unexpected";

export interface AuthLogEntry {
  ts: string;
  source: "auth";
  level: "info" | "warn" | "error";
  correlationId?: string;
  instanceId: string;
  msg: string;
  authVersion?: "legacy" | "v1" | "none";
  latencyMs?: number;
  orgId?: string;
  prefix?: string;
  reason?: string;
  cbTripped?: boolean;
  rolloutPercent?: number;
  [key: string]: unknown;
}

let _instanceId: string | null = null;

function getInstanceId(): string {
  if (!_instanceId) {
    const h = process.env.HOSTNAME ?? getHostname();
    _instanceId = `${h}:${process.pid}`;
  }
  return _instanceId;
}

function writeLog(entry: AuthLogEntry): void {
  entry.ts = new Date().toISOString();
  entry.instanceId = getInstanceId();
  process.stderr.write(JSON.stringify(entry) + "\n");
}

type AuthLogData = Omit<Partial<AuthLogEntry>, "ts" | "instanceId" | "source" | "level" | "msg">;

export const authLogger = {
  info(msg: string, data?: AuthLogData): void {
    writeLog({ source: "auth", level: "info", msg, ...data } as AuthLogEntry);
  },
  warn(msg: string, data?: AuthLogData): void {
    writeLog({ source: "auth", level: "warn", msg, ...data } as AuthLogEntry);
  },
  error(msg: string, data?: AuthLogData): void {
    writeLog({ source: "auth", level: "error", msg, ...data } as AuthLogEntry);
  },
};
