import type { IntervalHistogram } from 'node:perf_hooks';
import { monitorEventLoopDelay } from 'node:perf_hooks';

const NS_PER_MS = 1_000_000;

export type EventLoopLagSummary = {
  /**
   * The worst single delay observed. This is the number that matters when
   * looking for synchronous work that stalls request handling: a 3 second
   * block shows up here as ~3000 and nowhere else.
   */
  maxMs: number;
  meanMs: number;
  p50Ms: number;
  p99Ms: number;
  /** Number of samples the histogram collected. */
  count: number;
  /** Sampling resolution the recorder was configured with. */
  resolutionMs: number;
};

export type EventLoopLagRecorderOptions = {
  /**
   * How often libuv samples the loop, in milliseconds. Smaller values catch
   * shorter stalls at the cost of more samples. The default matches Node's.
   */
  resolutionMs?: number;
};

/**
 * Records how far behind the event loop falls, using Node's native interval
 * histogram.
 *
 * The histogram measures the gap between when a timer was due to fire and when
 * it actually fired. Purely asynchronous work leaves that gap at roughly the
 * sampling resolution; a synchronous block holds the loop for its whole
 * duration and shows up as a single large sample. That makes `maxMs` a direct
 * measure of the longest uninterrupted block during the recording window.
 *
 * The recorder does not attribute a stall to the code that caused it. Wrap a
 * single suspect operation to keep the attribution unambiguous.
 */
export class EventLoopLagRecorder {
  readonly #histogram: IntervalHistogram;
  readonly #resolutionMs: number;
  #running = false;

  constructor({ resolutionMs = 10 }: EventLoopLagRecorderOptions = {}) {
    this.#resolutionMs = resolutionMs;
    this.#histogram = monitorEventLoopDelay({ resolution: resolutionMs });
  }

  /**
   * Begins recording.
   *
   * libuv only arms the sampling timer once control returns to the event loop,
   * so a synchronous block started in this same tick is invisible to the
   * histogram. Yield at least once — `await armed()` — before running the code
   * under measurement. `measureEventLoopLag` does this for you.
   */
  start(): this {
    if (!this.#running) {
      this.#histogram.reset();
      this.#histogram.enable();
      this.#running = true;
    }
    return this;
  }

  /**
   * Resolves once the sampler is actually collecting.
   *
   * A single tick is not enough: until one full resolution period has elapsed
   * the histogram reports every sample at the sampling floor, so a stall in
   * that window is recorded as if nothing happened. Waiting two periods leaves
   * margin on a loaded machine.
   */
  async armed(): Promise<this> {
    const settleMs = Math.max(this.#resolutionMs, 1) * 2;
    await new Promise((resolve) => setTimeout(resolve, settleMs));
    return this;
  }

  stop(): EventLoopLagSummary {
    if (this.#running) {
      this.#histogram.disable();
      this.#running = false;
    }
    return this.summary();
  }

  reset(): this {
    this.#histogram.reset();
    return this;
  }

  summary(): EventLoopLagSummary {
    return {
      maxMs: this.#histogram.max / NS_PER_MS,
      meanMs: this.#histogram.mean / NS_PER_MS,
      p50Ms: this.#histogram.percentile(50) / NS_PER_MS,
      p99Ms: this.#histogram.percentile(99) / NS_PER_MS,
      count: this.#histogram.count,
      resolutionMs: this.#resolutionMs,
    };
  }
}

/**
 * Runs `fn` while recording event loop lag, returning both its result and the
 * lag observed while it ran.
 *
 * The loop must get a chance to turn for the histogram to sample at all, so a
 * fully synchronous `fn` is measured by the sample taken once it yields.
 */
export async function measureEventLoopLag<T>(
  fn: () => Promise<T> | T,
  options?: EventLoopLagRecorderOptions,
): Promise<{ result: T; lag: EventLoopLagSummary }> {
  const recorder = new EventLoopLagRecorder(options).start();
  try {
    // The sampler is not collecting until the loop has turned once.
    await recorder.armed();
    const result = await fn();
    // Let a full sampling period elapse so a stall that ended just before
    // `fn` resolved is recorded before the histogram is read.
    await recorder.armed();
    return { result, lag: recorder.summary() };
  } finally {
    recorder.stop();
  }
}

export function formatLagSummary(lag: EventLoopLagSummary): string {
  return `max=${lag.maxMs.toFixed(1)}ms p99=${lag.p99Ms.toFixed(
    1,
  )}ms p50=${lag.p50Ms.toFixed(1)}ms mean=${lag.meanMs.toFixed(1)}ms n=${
    lag.count
  }`;
}
