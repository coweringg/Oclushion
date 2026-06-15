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
}

function sampleRate(value: string | undefined): number {
  const parsed = Number(value ?? "0.05");
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0.05;
}

function redactHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!headers) {
    return headers;
  }

  const redacted = { ...headers };
  for (const header of [
    "authorization",
    "x-api-key",
    "x-oclushion-api-key",
    "x-sano-api-key",
    "cookie",
  ]) {
    if (header in redacted) {
      redacted[header] = "[REDACTED]";
    }
  }
  return redacted;
}
