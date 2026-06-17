import * as Sentry from "@sentry/node";

/**
 * Wraps an auth operation in a Sentry / OpenTelemetry span.
 *
 * When Sentry is not initialized (no DSN configured), `startSpan` is a
 * transparent pass-through — no overhead, no error.
 *
 * Each instance produces independent trace data; aggregation happens at
 * the Sentry / OTel collector level.
 */
export async function traceAuthSpan<T>(
  name: string,
  fn: (span: Sentry.Span | undefined) => Promise<T>,
): Promise<T> {
  return Sentry.startSpan({ name, op: "auth" }, async (span) => {
    return fn(span);
  });
}
