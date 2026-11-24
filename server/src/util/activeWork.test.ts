import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import { describe, expect, test } from 'vitest';
import { trackWork, workBetween } from './activeWork.ts';

describe('activeWork', () => {
  test('lists work while it runs', async () => {
    let during: string[] = [];

    await trackWork('running-work', () => {
      const now = performance.now();
      during = workBetween(now, now);
      return Promise.resolve();
    });

    expect(during).toContain('running-work');
  });

  test('lists work that finished inside the window', async () => {
    const from = performance.now();
    await trackWork('finished-inside', () => sleep(5));

    expect(workBetween(from, performance.now())).toContain('finished-inside');
  });

  test('leaves out work that finished before the window or started after it', async () => {
    await trackWork('finished-before', () => sleep(5));
    const from = performance.now();
    await sleep(5);
    const to = performance.now();
    await trackWork('started-after', () => sleep(5));

    const labels = workBetween(from, to);
    expect(labels).not.toContain('finished-before');
    expect(labels).not.toContain('started-after');
  });

  test('records the end of work that throws', async () => {
    await expect(
      trackWork('throws', () => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom');
    await sleep(5);
    const now = performance.now();

    expect(workBetween(now, now)).not.toContain('throws');
  });

  test('lists each overlapping run of the same work', async () => {
    let during: string[] = [];
    let release = () => {};
    const first = trackWork(
      'twice',
      () => new Promise<void>((resolve) => (release = resolve)),
    );
    const second = trackWork('twice', () => {
      const now = performance.now();
      during = workBetween(now, now);
      return Promise.resolve();
    });
    await second;
    release();
    await first;

    expect(during.filter((label) => label === 'twice')).toHaveLength(2);
  });
});
