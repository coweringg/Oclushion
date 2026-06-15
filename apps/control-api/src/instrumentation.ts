import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE,
    sendDefaultPii: false,
    tracesSampleRate: sampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE),
    integrations: [
      Sentry.fastifyIntegration({
        shouldHandleError: (_error, _request, reply) => reply.statusCode >= 500,
      }),
    ],
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        delete event.request.data;
        event.request.headers = redactHeaders(event.request.headers);
      }
      return event;
    },
  });

  Sentry.setTag("service", "control-api");
  Sentry.setTag("node_version", process.version);
  Sentry.setTag("platform", process.platform);
  Sentry.setTag("deployment", process.env.SENTRY_ENVIRONMENT ?? "development");

  import("os").then((os) => {
    Sentry.setTag("hostname", os.hostname());
  });

  Sentry.setContext("runtime", {
    memory: process.memoryUsage(),
    uptime: process.uptime(),
    pid: process.pid,
  });
}

export function setSentryUser(userId: string, orgId: string, role: string): void {
  Sentry.setUser({ id: userId, organizationId: orgId, role });
}

export function clearSentryUser(): void {
  Sentry.setUser(null);
}

export function addSentryBreadcrumb(message: string, category: string, data?: Record<string, unknown>): void {
  Sentry.addBreadcrumb({ message, category, data, level: "info", timestamp: Date.now() / 1000 });
}

function sampleRate(value: string | undefined): number {
  const parsed = Number(value ?? "0.05");
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0.05;
}

function redactHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!headers) return headers;
  const redacted = { ...headers };
  for (const header of ["authorization", "cookie", "x-api-key", "x-sano-api-key"]) {
    if (header in redacted) redacted[header] = "[REDACTED]";
  }
  return redacted;
}
