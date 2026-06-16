type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function readLogLevel(): LogLevel {
  if (typeof process !== 'undefined' && process.env?.VITE_LOG_LEVEL) {
    return process.env.VITE_LOG_LEVEL as LogLevel;
  }
  try {
    const fromMeta = (import.meta as Record<string, unknown>)?.env as Record<string, unknown> | undefined;
    if (fromMeta && typeof fromMeta.VITE_LOG_LEVEL === 'string') {
      return fromMeta.VITE_LOG_LEVEL as LogLevel;
    }
  } catch {}
  return 'info';
}

const LOG_LEVEL: LogLevel = readLogLevel();
const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const REMOTE_LOG_ENDPOINT = import.meta.env.VITE_REMOTE_LOG_ENDPOINT as string | undefined;
const SESSION_ID = typeof crypto !== 'undefined' ? crypto.randomUUID?.() : 'unknown';

let logBuffer: Array<{ level: LogLevel; component: string; message: string; timestamp: string }> = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function enqueueRemoteLog(level: LogLevel, component: string, message: string): void {
  if (!REMOTE_LOG_ENDPOINT) return;

  logBuffer.push({ level, component, message, timestamp: new Date().toISOString() });

  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      const batch = logBuffer;
      logBuffer = [];
      if (batch.length === 0) return;
      fetch(REMOTE_LOG_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: SESSION_ID, logs: batch }),
        keepalive: true,
      }).catch(() => {  });
    }, 5_000);
  }
}

export const logger = {
  debug(component: string, message: string, data?: unknown): void {
    if (LOG_LEVELS[LOG_LEVEL] <= LOG_LEVELS.debug) {
      console.debug(`[${component}] ${message}`, data);
    }
  },

  info(component: string, message: string, data?: unknown): void {
    if (LOG_LEVELS[LOG_LEVEL] <= LOG_LEVELS.info) {
      console.info(`[${component}] ${message}`, data);
    }
  },

  warn(component: string, message: string, data?: unknown): void {
    if (LOG_LEVELS[LOG_LEVEL] <= LOG_LEVELS.warn) {
      console.warn(`[${component}] ${message}`, data);
      enqueueRemoteLog('warn', component, message);
    }
  },

  error(component: string, message: string, error?: unknown): void {
    if (LOG_LEVELS[LOG_LEVEL] <= LOG_LEVELS.error) {
      console.error(`[${component}] ${message}`, error);
      enqueueRemoteLog('error', component, message);
    }
  },
};