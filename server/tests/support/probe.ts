import type { FastifyInstance } from 'fastify';
import type { EventLoopLagSummary } from '../../src/util/eventLoopLag.ts';
import { EventLoopLagRecorder } from '../../src/util/eventLoopLag.ts';
import type { ProbeSummary } from '../../src/util/probeStats.ts';
import { summarizeProbes } from '../../src/util/probeStats.ts';

export type { ProbeSummary };

export type ConcurrentProbeOptions<T> = {
  app: FastifyInstance;
  /** A cheap endpoint. It stands in for an HLS segment fetch. */
  url: string;
  /** Pause between probe requests. */
  intervalMs?: number;
  /**
   * How long to keep probing after `operation` resolves.
   *
   * Essential for anything that kicks off background work. The lineup save
   * fires the guide refresh with `runNow(true)` and does not await it, so the
   * HTTP response returns *before* the expensive part runs. Without a settle
   * window the measurement closes early and reports the save as cheap while
   * the real stall happens just after.
   */
  settleMs?: number;
  /** Latency above which a probe counts as degraded. */
  slowThresholdMs?: number;
  operation: () => Promise<T>;
};

/**
 * Runs `operation` while continuously hitting a cheap endpoint, and reports how
 * long those concurrent requests took.
 *
 * This is the metric that matches the user-visible symptom. Event loop lag
 * alone under-reports work that yields frequently: the guide build calls
 * `throttle()` (a `setTimeout(0)`) once per program, so a full rebuild occupies
 * the loop as thousands of small tasks rather than one long stall. Peak lag
 * barely moves while every other request still queues behind that backlog.
 *
 * Probe latency captures both shapes — one long block and a flood of small
 * ones — because either way the probe waits.
 */
export async function measureWithConcurrentProbe<T>({
  app,
  url,
  intervalMs = 10,
  settleMs = 0,
  slowThresholdMs = 25,
  operation,
}: ConcurrentProbeOptions<T>): Promise<{
  result: T;
  probe: ProbeSummary;
  lag: EventLoopLagSummary;
}> {
  const samples: number[] = [];
  let failures = 0;
  let stopped = false;

  const recorder = new EventLoopLagRecorder({ resolutionMs: 5 }).start();
  await recorder.armed();

  const probeLoop = (async () => {
    let intendedAt = performance.now();
    while (!stopped) {
      const now = performance.now();
      if (now < intendedAt) {
        await new Promise((resolve) => setTimeout(resolve, intendedAt - now));
      }

      // Measured from when this probe was *due*, not from when it actually
      // went out. A block that lands between probes only delays the next send;
      // timing from the send would record that as a fast request and miss the
      // stall entirely. A real client asks for its next segment on a schedule
      // and waits however long it takes — this matches that.
      const dueAt = intendedAt;
      try {
        const res = await app.inject({ method: 'GET', url });
        if (res.statusCode < 200 || res.statusCode >= 300) {
          failures++;
        }
      } catch {
        failures++;
      }
      const completedAt = performance.now();
      // setTimeout can fire a fraction of a millisecond early, which would
      // otherwise show up as a negative latency.
      samples.push(Math.max(0, completedAt - dueAt));
      intendedAt = Math.max(completedAt, dueAt + intervalMs);
    }
  })();

  try {
    const result = await operation();
    if (settleMs > 0) {
      // Keep probing: background work kicked off by `operation` has not
      // necessarily started, let alone finished.
      await new Promise((resolve) => setTimeout(resolve, settleMs));
    }
    return {
      result,
      probe: summarizeProbes(samples, failures, slowThresholdMs),
      lag: recorder.stop(),
    };
  } finally {
    stopped = true;
    await probeLoop;
  }
}

export function formatProbeSummary(probe: ProbeSummary): string {
  return (
    `slow=${probe.slowCount}/${probe.count} (>${probe.slowThresholdMs}ms) ` +
    `excess=${probe.totalExcessMs.toFixed(0)}ms ` +
    `max=${probe.maxMs.toFixed(1)}ms p99=${probe.p99Ms.toFixed(1)}ms ` +
    `p50=${probe.p50Ms.toFixed(1)}ms` +
    (probe.failures > 0 ? ` failures=${probe.failures}` : '')
  );
}
