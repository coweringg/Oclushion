import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE,
    sendDefaultPii: false,
    tracesSampleRate: sampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE),
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        delete event.request.data;
        delete event.request.headers;
      }
      return event;
    },
  });
}

function sampleRate(value: string | undefined): number {
  const parsed = Number(value ?? "0.02");
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0.02;
}
