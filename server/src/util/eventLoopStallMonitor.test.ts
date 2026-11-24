import { setTimeout as sleep } from 'node:timers/promises';
import { describe, expect, test, vi } from 'vitest';
import { trackWork } from './activeWork.ts';
import type {
  EventLoopStall,
  EventLoopStallLogger,
} from './eventLoopStallMonitor.ts';
import {
  DefaultEventLoopStallThresholdMs,
  eventLoopStallThresholdMs,
  startEventLoopStallLog,
  startEventLoopStallMonitor,
} from './eventLoopStallMonitor.ts';

function blockFor(ms: number) {
  const until = performance.now() + ms;
  while (performance.now() < until) {
    // Busy-wait to hold the event loop.
  }
}

describe('eventLoopStallThresholdMs', () => {
  test('uses the default when the variable is unset', () => {
    expect(eventLoopStallThresholdMs(null)).toBe(
      DefaultEventLoopStallThresholdMs,
    );
  });

  test('uses a positive value as given', () => {
    expect(eventLoopStallThresholdMs(250)).toBe(250);
  });

  test('turns the monitor off for zero or less', () => {
    expect(eventLoopStallThresholdMs(0)).toBeUndefined();
    expect(eventLoopStallThresholdMs(-5)).toBeUndefined();
  });
});

describe('startEventLoopStallMonitor', () => {
  test('reports a block once the loop is free again', async () => {
    const stalls: EventLoopStall[] = [];
    const stop = startEventLoopStallMonitor({
      thresholdMs: 100,
      intervalMs: 10,
      onStall: (stall) => stalls.push(stall),
    });

    await sleep(30);
    blockFor(250);
    await sleep(50);
    stop();

    expect(stalls).toHaveLength(1);
    const [stall] = stalls;
    expect(stall?.blockedMs).toBeGreaterThanOrEqual(200);
    expect(stall?.blockedMs).toBeLessThan(1_000);
    expect(Math.round((stall?.endedAt ?? 0) - (stall?.startedAt ?? 0))).toBe(
      stall?.blockedMs,
    );
  });

  test('stays quiet while the loop is idle', async () => {
    const onStall = vi.fn();

    // The wide threshold keeps a GC pause on a busy runner from failing this.
    const stop = startEventLoopStallMonitor({
      thresholdMs: 500,
      intervalMs: 10,
      onStall,
    });

    await sleep(200);
    stop();

    expect(onStall).not.toHaveBeenCalled();
  });

  test('stops reporting once stopped', async () => {
    const onStall = vi.fn();
    const stop = startEventLoopStallMonitor({
      thresholdMs: 100,
      intervalMs: 10,
      onStall,
    });

    await sleep(30);
    stop();
    blockFor(150);
    await sleep(30);

    expect(onStall).not.toHaveBeenCalled();
  });
});

describe('startEventLoopStallLog', () => {
  test('logs the stall with the work that caused it', async () => {
    const logger = { warn: vi.fn<EventLoopStallLogger['warn']>() };
    const stop = startEventLoopStallLog(logger, {
      thresholdMs: 100,
      intervalMs: 10,
    });

    await sleep(30);
    await trackWork('BlockingTask', async () => {
      await sleep(0);
      blockFor(200);
    });
    await sleep(50);
    stop();

    expect(logger.warn).toHaveBeenCalledOnce();
    const call = logger.warn.mock.calls[0];
    expect(call?.[0]).toMatchObject({
      blockedMs: call?.[2],
      activeWork: ['BlockingTask'],
    });
    expect(call?.[1]).toContain('blocked for %d ms');
  });
});
