interface Counter {
  inc(labels?: Record<string, string>): void;
  value(): number;
}

interface Histogram {
  observe(value: number, labels?: Record<string, string>): void;
  snapshot(): HistogramSnapshot;
}

interface HistogramSnapshot {
  count: number;
  sum: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
}

function makeCounter(_name: string): Counter {
  let val = 0;
  return {
    inc() { val++; },
    value() { return val; },
  };
}

function makeHistogram(_buckets: number[] = [0.1, 0.5, 1, 2, 5, 10, 25, 50, 100, 500]): Histogram {
  const values: number[] = [];
  return {
    observe(value: number) {
      values.push(value);
    },
    snapshot(): HistogramSnapshot {
      const sorted = [...values].sort((a, b) => a - b);
      const len = sorted.length;
      if (len === 0) {
        return { count: 0, sum: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0 };
      }
      const sum = sorted.reduce((a, b) => a + b, 0);
      const idx50 = Math.min(Math.floor(len * 0.5), len - 1);
      const idx95 = Math.min(Math.floor(len * 0.95), len - 1);
      const idx99 = Math.min(Math.floor(len * 0.99), len - 1);
      return {
        count: len,
        sum,
        min: sorted[0]!,
        max: sorted[len - 1]!,
        p50: sorted[idx50]!,
        p95: sorted[idx95]!,
        p99: sorted[idx99]!,
      };
    },
  };
}

export class AuthMetrics {
  public readonly legacyAuthSuccess = makeCounter("legacy_auth_success_total");
  public readonly legacyAuthFailure = makeCounter("legacy_auth_failure_total");
  public readonly v1AuthSuccess = makeCounter("v1_auth_success_total");
  public readonly v1AuthFailure = makeCounter("v1_auth_failure_total");
  public readonly malformedKeys = makeCounter("auth_malformed_keys_total");
  public readonly fallbackTriggered = makeCounter("auth_fallback_triggered_total");
  public readonly authLatency = makeHistogram();
  public readonly circuitBreakerTrips = makeCounter("auth_circuit_breaker_trips_total");
  public readonly anomalySpikes = makeCounter("auth_anomaly_spikes_total");

  /* --- Error classification counters (no silent failures) --- */
  public readonly authErrorsInvalidKey = makeCounter("auth_errors_invalid_key_total");
  public readonly authErrorsBadFormat = makeCounter("auth_errors_bad_format_total");
  public readonly authErrorsConfigMissing = makeCounter("auth_errors_config_missing_total");
  public readonly authErrorsCryptoMismatch = makeCounter("auth_errors_crypto_mismatch_total");
  public readonly authErrorsUnexpected = makeCounter("auth_errors_unexpected_total");

  /* --- Self-check / drift metrics --- */
  public readonly selfCheckOk = makeCounter("auth_self_check_ok_total");
  public readonly selfCheckFailure = makeCounter("auth_self_check_failure_total");

  private readonly startTime = Date.now();

  /** Returns a plain bag of current rate-compatible values for the health endpoint. */
  public runtimeDiagnostics(): AuthRuntimeDiag {
    const h = this.authLatency.snapshot();
    const totalOk = this.legacyAuthSuccess.value() + this.v1AuthSuccess.value();
    const totalFail = this.legacyAuthFailure.value() + this.v1AuthFailure.value();
    const total = totalOk + totalFail;
    return {
      totalAuthAttempts: total,
      totalAuthSuccesses: totalOk,
      successRate: total > 0 ? totalOk / total : 0,
      latencyCount: h.count,
      v1SuccessRate: totalOk > 0 ? this.v1AuthSuccess.value() / totalOk : 0,
      legacySuccessRate: totalOk > 0 ? this.legacyAuthSuccess.value() / totalOk : 0,
    };
  }

  public snapshot(): string {
    const lines: string[] = [];

    const pushCounter = (name: string, help: string, value: number) => {
      lines.push(`# HELP ${name} ${help}`);
      lines.push(`# TYPE ${name} counter`);
      lines.push(`${name} ${value}`);
    };

    const pushGauge = (name: string, help: string, value: number) => {
      lines.push(`# HELP ${name} ${help}`);
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name} ${value}`);
    };

    pushCounter("legacy_auth_success_total", "Total legacy auth successes", this.legacyAuthSuccess.value());
    pushCounter("legacy_auth_failure_total", "Total legacy auth failures", this.legacyAuthFailure.value());
    pushCounter("v1_auth_success_total", "Total v1 auth successes", this.v1AuthSuccess.value());
    pushCounter("v1_auth_failure_total", "Total v1 auth failures", this.v1AuthFailure.value());
    pushCounter("auth_malformed_keys_total", "Total malformed keys seen", this.malformedKeys.value());
    pushCounter("auth_fallback_triggered_total", "Total fallbacks triggered", this.fallbackTriggered.value());
    pushCounter("auth_circuit_breaker_trips_total", "Total circuit breaker trips", this.circuitBreakerTrips.value());
    pushCounter("auth_anomaly_spikes_total", "Total anomaly spikes detected", this.anomalySpikes.value());
    pushCounter("auth_errors_invalid_key_total", "Total invalid key format errors", this.authErrorsInvalidKey.value());
    pushCounter("auth_errors_bad_format_total", "Total bad format errors", this.authErrorsBadFormat.value());
    pushCounter("auth_errors_config_missing_total", "Total config missing errors", this.authErrorsConfigMissing.value());
    pushCounter("auth_errors_crypto_mismatch_total", "Total crypto mismatch errors", this.authErrorsCryptoMismatch.value());
    pushCounter("auth_errors_unexpected_total", "Total unexpected errors", this.authErrorsUnexpected.value());
    pushCounter("auth_self_check_ok_total", "Total self-check passes", this.selfCheckOk.value());
    pushCounter("auth_self_check_failure_total", "Total self-check failures", this.selfCheckFailure.value());
    pushGauge("auth_uptime_seconds", "Auth system uptime", Math.floor((Date.now() - this.startTime) / 1000));

    const h = this.authLatency.snapshot();
    pushCounter("auth_latency_ms_count", "Auth latency count (monotonically increasing per instance)", h.count);
    pushCounter("auth_latency_ms_sum", "Auth latency sum (monotonically increasing per instance)", h.sum);
    pushGauge("auth_latency_ms_min", "Auth latency minimum (snapshot, per-instance)", h.min);
    pushGauge("auth_latency_ms_max", "Auth latency maximum (snapshot, per-instance)", h.max);
    pushGauge("auth_latency_ms_p50", "Auth latency p50 (snapshot, per-instance)", h.p50);
    pushGauge("auth_latency_ms_p95", "Auth latency p95 (snapshot, per-instance)", h.p95);
    pushGauge("auth_latency_ms_p99", "Auth latency p99 (snapshot, per-instance)", h.p99);

    return lines.join("\n") + "\n";
  }

  /**
   * Returns current counter values as a plain object suitable for
   * cross-instance aggregation in a log-based metrics pipeline.
   * Every counter is monotonically increasing per-instance.
   * Prometheus scrapes each instance independently; aggregation
   * happens at the Prometheus server level (sum over instances).
   */
  public counters(): Record<string, number> {
    return {
      legacy_auth_success_total: this.legacyAuthSuccess.value(),
      legacy_auth_failure_total: this.legacyAuthFailure.value(),
      v1_auth_success_total: this.v1AuthSuccess.value(),
      v1_auth_failure_total: this.v1AuthFailure.value(),
      auth_malformed_keys_total: this.malformedKeys.value(),
      auth_fallback_triggered_total: this.fallbackTriggered.value(),
      auth_circuit_breaker_trips_total: this.circuitBreakerTrips.value(),
      auth_anomaly_spikes_total: this.anomalySpikes.value(),
      auth_errors_invalid_key_total: this.authErrorsInvalidKey.value(),
      auth_errors_bad_format_total: this.authErrorsBadFormat.value(),
      auth_errors_config_missing_total: this.authErrorsConfigMissing.value(),
      auth_errors_crypto_mismatch_total: this.authErrorsCryptoMismatch.value(),
      auth_errors_unexpected_total: this.authErrorsUnexpected.value(),
      auth_self_check_ok_total: this.selfCheckOk.value(),
      auth_self_check_failure_total: this.selfCheckFailure.value(),
      auth_latency_ms_count: this.authLatency.snapshot().count,
      auth_latency_ms_sum: this.authLatency.snapshot().sum,
    };
  }

  public reset(): void {
    /* test helper - creates a fresh instance */
  }
}

export interface AuthRuntimeDiag {
  totalAuthAttempts: number;
  totalAuthSuccesses: number;
  successRate: number;
  latencyCount: number;
  v1SuccessRate: number;
  legacySuccessRate: number;
}

export const authMetrics = new AuthMetrics();
