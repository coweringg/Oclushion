import { getCircuitBreakerThreshold, getCircuitBreakerWindow } from "./auth-config.js";
import { authMetrics } from "./auth-metrics.js";

/**
 * Per-instance circuit breaker for auth failures.
 *
 * ## Distributed Safety Model
 *
 * This circuit breaker is **strictly per-instance**. It observes only the
 * requests routed to the local instance. There is NO global coordination:
 *
 * - If instance A sees 50% failures and trips, instance B may still pass
 *   requests (normal — instances see different traffic and load).
 * - Operators MUST NOT assume that a tripped circuit breaker on one
 *   instance implies a system-wide auth degradation.
 * - Aggregation across instances happens externally (Prometheus query:
 *   `sum(rate(auth_circuit_breaker_trips_total[5m]))`).
 *
 * ## Why not a distributed circuit breaker?
 * - A distributed circuit breaker requires consensus (Redis, ZooKeeper, etc.)
 *   which adds latency, a new failure domain, and operational complexity.
 * - The practical failure modes that this protects against (e.g., a bad deploy
 *   causing local hash mismatches) are per-instance phenomena.
 * - Global auth degradation is detected by the anomaly detector + Prometheus
 *   aggregated alerting, not by a circuit breaker.
 *
 * ## Behavior
 * - Tracks the last `AUTH_CIRCUIT_BREAKER_WINDOW` (default 100) outcomes.
 * - Trips when the failure rate exceeds `AUTH_CIRCUIT_BREAKER_THRESHOLD` (default 0.5).
 * - Auto-recovers after 60 seconds of no trips (half-open).
 */
export class AuthCircuitBreaker {
  private readonly outcomes: boolean[] = [];
  private trippedAt: number | null = null;

  public record(success: boolean): void {
    this.outcomes.push(success);
    const window = getCircuitBreakerWindow();
    while (this.outcomes.length > window) {
      this.outcomes.shift();
    }

    if (!success && this.failureRate() >= getCircuitBreakerThreshold()) {
      if (!this.trippedAt) {
        this.trippedAt = Date.now();
        authMetrics.circuitBreakerTrips.inc();
      }
    }
  }

  private failureRate(): number {
    const window = getCircuitBreakerWindow();
    const minSamples = Math.min(window, 20);
    if (this.outcomes.length < minSamples) return 0;

    const failures = this.outcomes.filter((o) => !o).length;
    return failures / this.outcomes.length;
  }

  public isTripped(): boolean {
    if (this.trippedAt === null) return false;

    const elapsed = Date.now() - this.trippedAt;
    if (elapsed > 60_000) {
      this.trippedAt = null;
      return false;
    }
    return true;
  }

  public reset(): void {
    this.outcomes.length = 0;
    this.trippedAt = null;
  }
}

export const authCircuitBreaker = new AuthCircuitBreaker();
