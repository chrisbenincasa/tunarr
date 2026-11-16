import { performance } from 'node:perf_hooks';
import { workBetween } from './activeWork.ts';

export type EventLoopStall = {
  blockedMs: number;

  /** `performance.now()` timestamps bounding the block. */
  startedAt: number;
  endedAt: number;
};

export type EventLoopStallMonitorOptions = {
  thresholdMs: number;
  intervalMs?: number;
  onStall: (stall: EventLoopStall) => void;
};

export type EventLoopStallLogFields = {
  blockedMs: number;
  activeWork: string[];
};

export type EventLoopStallLogger = {
  warn(fields: EventLoopStallLogFields, msg: string, blockedMs: number): void;
};

const DefaultIntervalMs = 100;

/**
 * Reports each time synchronous work blocks the event loop for at least
 * `thresholdMs`.
 *
 * A repeating timer expects to run every `intervalMs`. A block holds the timer
 * back, so it runs late by about as long as the block lasted. The report fires
 * as soon as the loop is free again.
 *
 * Returns a function that stops the monitor. The timer never keeps the process
 * alive.
 */
export function startEventLoopStallMonitor({
  thresholdMs,
  intervalMs = DefaultIntervalMs,
  onStall,
}: EventLoopStallMonitorOptions): () => void {
  let lastTick = performance.now();
  const timer = setInterval(() => {
    const now = performance.now();
    const blockedMs = now - lastTick - intervalMs;
    lastTick = now;
    if (blockedMs >= thresholdMs) {
      onStall({
        blockedMs: Math.round(blockedMs),
        startedAt: now - blockedMs,
        endedAt: now,
      });
    }
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}

/**
 * Logs a warning for each event loop stall, with the tracked work that ran
 * during it. Streams and requests wait for the whole stall, so these warnings
 * explain freezes in user logs. The warning is written as the stall ends.
 */
export function startEventLoopStallLog(
  logger: EventLoopStallLogger,
  opts: Omit<EventLoopStallMonitorOptions, 'onStall'>,
): () => void {
  return startEventLoopStallMonitor({
    ...opts,
    onStall: ({ blockedMs, startedAt, endedAt }) => {
      logger.warn(
        {
          blockedMs,
          activeWork: workBetween(startedAt, endedAt),
        },
        'Server was blocked for %d ms. Streams and requests waited until it finished',
        blockedMs,
      );
    },
  });
}
