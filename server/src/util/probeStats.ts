/**
 * Latency statistics for a stream of probe requests.
 *
 * Shared so that the in-process perf tests and the out-of-band worker pool
 * benchmark report the same numbers, computed the same way. Two harnesses with
 * two definitions of "degraded" cannot be compared against each other, which
 * defeats the point of measuring at all.
 */
export type ProbeSummary = {
  count: number;
  maxMs: number;
  meanMs: number;
  p50Ms: number;
  p99Ms: number;
  /**
   * Probes slower than `slowThresholdMs`.
   *
   * The headline metric for work that yields. A guide rebuild calls
   * `throttle()` once per program, so it never produces one long stall — it
   * produces thousands of small ones. Max and p99 barely move; the count of
   * degraded requests moves a great deal.
   */
  slowCount: number;
  /**
   * Total latency above `slowThresholdMs`, summed across slow probes. Stands in
   * for "how much service was degraded, in aggregate".
   */
  totalExcessMs: number;
  slowThresholdMs: number;
  /** Probes that did not return 2xx, which would invalidate the timings. */
  failures: number;
};

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[index]!;
}

export function summarizeProbes(
  samples: number[],
  failures: number,
  slowThresholdMs: number,
): ProbeSummary {
  const sorted = [...samples].sort((a, b) => a - b);
  const slow = samples.filter((s) => s > slowThresholdMs);
  return {
    count: samples.length,
    maxMs: sorted.length > 0 ? sorted[sorted.length - 1]! : 0,
    meanMs:
      samples.length > 0
        ? samples.reduce((sum, s) => sum + s, 0) / samples.length
        : 0,
    p50Ms: percentile(sorted, 50),
    p99Ms: percentile(sorted, 99),
    slowCount: slow.length,
    totalExcessMs: slow.reduce((sum, s) => sum + (s - slowThresholdMs), 0),
    slowThresholdMs,
    failures,
  };
}
