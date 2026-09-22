import { describe, expect, test } from 'vitest';
import { EventLoopLagRecorder, measureEventLoopLag } from './eventLoopLag.ts';

function blockFor(ms: number) {
  const until = performance.now() + ms;
  // Deliberate busy-wait: this is the thing the recorder needs to detect.
  while (performance.now() < until) {
    /* spin */
  }
}

async function idleFor(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

describe('EventLoopLagRecorder', () => {
  test('reports a synchronous block roughly matching its duration', async () => {
    const { lag } = await measureEventLoopLag(
      async () => {
        await idleFor(20);
        blockFor(250);
        await idleFor(20);
      },
      { resolutionMs: 5 },
    );

    // Generous lower bound: the sampler cannot observe a stall shorter than
    // its own resolution, and CI machines are noisy. The point is that a
    // quarter-second block is nowhere near the idle baseline.
    expect(lag.maxMs).toBeGreaterThan(150);
  });

  test('stays near the sampling floor when nothing blocks', async () => {
    const { lag } = await measureEventLoopLag(() => idleFor(150), {
      resolutionMs: 5,
    });

    expect(lag.maxMs).toBeLessThan(100);
    expect(lag.count).toBeGreaterThan(0);
  });

  test('distinguishes a blocked window from an idle one', async () => {
    const { lag: idle } = await measureEventLoopLag(() => idleFor(120), {
      resolutionMs: 5,
    });
    const { lag: blocked } = await measureEventLoopLag(
      async () => {
        await idleFor(20);
        blockFor(200);
      },
      { resolutionMs: 5 },
    );

    expect(blocked.maxMs).toBeGreaterThan(idle.maxMs * 4);
  });

  test('reset clears previously recorded samples', async () => {
    const recorder = new EventLoopLagRecorder({ resolutionMs: 5 }).start();
    await recorder.armed();
    blockFor(200);
    await idleFor(20);
    expect(recorder.summary().maxMs).toBeGreaterThan(100);

    recorder.reset();
    await idleFor(50);
    const afterReset = recorder.stop();

    expect(afterReset.maxMs).toBeLessThan(100);
  });
});

describe('EventLoopLagRecorder arming', () => {
  test('a block before one sampling period has elapsed is not observed', async () => {
    // Documents a real limitation rather than asserting desirable behavior:
    // until a full resolution period passes the histogram reports everything
    // at the sampling floor, so this stall lands in a blind spot.
    const recorder = new EventLoopLagRecorder({ resolutionMs: 5 }).start();
    blockFor(200);
    await idleFor(20);

    expect(recorder.stop().maxMs).toBeLessThan(100);
  });

  test('the same block is observed after awaiting armed()', async () => {
    const recorder = new EventLoopLagRecorder({ resolutionMs: 5 }).start();
    await recorder.armed();
    blockFor(200);
    await idleFor(20);

    expect(recorder.stop().maxMs).toBeGreaterThan(100);
  });
});
