import { describe, expect, test, vi } from 'vitest';
import { runEach } from './useChannelBulkActions.ts';

describe('runEach', () => {
  test('runs tasks one at a time in order', async () => {
    const order: string[] = [];
    let running = 0;
    const result = await runEach(['a', 'b', 'c'], async (item) => {
      running++;
      expect(running).toBe(1);
      await Promise.resolve();
      order.push(item);
      running--;
    });
    expect(order).toEqual(['a', 'b', 'c']);
    expect(result).toEqual({ succeeded: 3, failed: 0 });
  });

  test('keeps going after a failure and counts it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const seen: number[] = [];
    const result = await runEach([1, 2, 3], async (n) => {
      seen.push(n);
      if (n === 2) {
        throw new Error('boom');
      }
    });
    expect(seen).toEqual([1, 2, 3]);
    expect(result).toEqual({ succeeded: 2, failed: 1 });
  });
});
