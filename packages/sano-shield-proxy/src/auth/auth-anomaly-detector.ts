import { authMetrics } from "./auth-metrics.js";

interface RateTracker {
  timestamps: number[];
  label: string;
}

/**
 * Per-instance anomaly (spike) detector for auth events.
 *
 * ## Distributed Safety Model
 *
 * This detector is **strictly per-instance**. It ONLY records events seen
 * on the local instance:
 *
 * - `isSpiking("malformed_keys")` returns `true` if this instance has seen
 *   >50 malformed keys in the last 60 seconds. It does NOT reflect the
 *   global system state.
 * - Operators MUST aggregate across instances to detect system-wide anomalies:
 *   `sum(rate(auth_anomaly_spikes_total[5m]))`.
 *
 * ## Why not a distributed anomaly detector?
 * - Distributed anomaly detection requires shared state (Redis, streaming
 *   analytics) which adds complexity and latency.
 * - The per-instance signal is sufficient for local operational awareness
 *   (e.g., "this pod is receiving a flood of bad keys").
 * - Global anomaly detection is better served by Prometheus aggregated
 *   metrics + alerting rules.
 *
 * ## Integration with external aggregation
 * - The `ratePerMinute(label)` method can be exposed via the metrics endpoint
 *   for Prometheus to scrape and aggregate.
 * - Alerting on `sum(rate(...))` across all instances gives a global view.
 */
export class AuthAnomalyDetector {
  private readonly trackers: Map<string, RateTracker> = new Map();

  private tracker(label: string): RateTracker {
    let t = this.trackers.get(label);
    if (!t) {
      t = { timestamps: [], label };
      this.trackers.set(label, t);
    }
    return t;
  }

  public record(label: string): void {
    const t = this.tracker(label);
    t.timestamps.push(Date.now());
    const cutoff = Date.now() - 60_000;
    while (t.timestamps.length > 0 && t.timestamps[0]! < cutoff) {
      t.timestamps.shift();
    }

    if (this.isSpiking(label)) {
      authMetrics.anomalySpikes.inc();
    }
  }

  public isSpiking(label: string): boolean {
    const t = this.tracker(label);
    const cutoff = Date.now() - 60_000;
    const recent = t.timestamps.filter((ts) => ts >= cutoff).length;
    return recent > 50;
  }

  public ratePerMinute(label: string): number {
    const t = this.tracker(label);
    const cutoff = Date.now() - 60_000;
    return t.timestamps.filter((ts) => ts >= cutoff).length;
  }

  public reset(): void {
    this.trackers.clear();
  }
}

export const authAnomalyDetector = new AuthAnomalyDetector();
