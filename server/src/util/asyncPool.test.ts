import { range } from 'lodash-es';
import { describe, expect, it, vi } from 'vitest';
import { asyncPool, unfurlPool } from './asyncPool.ts';

const { fakeLogger } = vi.hoisted(() => {
  const fakeLogger = {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: () => fakeLogger,
  };
  return { fakeLogger };
});

vi.mock('@/util/logging/LoggerFactory.js', () => ({
  LoggerFactory: { child: () => fakeLogger, root: fakeLogger },
}));

describe('unfurlPool', () => {
  it('rejects instead of returning a short list when a task fails', async () => {
    const inputs = range(1, 11);

    await expect(
      unfurlPool(
        asyncPool(
          inputs,
          (n) =>
            n === 4 ? Promise.reject(new Error('boom')) : Promise.resolve(n),
          { concurrency: 3 },
        ),
      ),
    ).rejects.toThrow(/1 of 10/);
  });
});

describe('unfurlPool ordering', () => {
  it('returns results in input order, not completion order', async () => {
    const inputs = range(1, 7);

    const results = await unfurlPool(
      asyncPool(
        inputs,
        async (n) => {
          // Later inputs finish first.
          await new Promise((resolve) => setTimeout(resolve, (7 - n) * 5));
          return n;
        },
        { concurrency: 6 },
      ),
    );

    expect(results).toEqual(inputs);
  });
});

describe('asyncPool', () => {
  it('yields a result for every input when tasks settle without I/O', async () => {
    const inputs = range(1, 41);

    const results = await unfurlPool(
      asyncPool(inputs, (n) => Promise.resolve(n), { concurrency: 3 }),
    );

    expect(results.sort((a, b) => a - b)).toEqual(inputs);
  });

  it('yields a failure result for every task that rejects', async () => {
    const inputs = range(1, 41);

    const outcomes: number[] = [];
    for await (const result of asyncPool(
      inputs,
      (n) => Promise.reject(new Error(`boom ${n}`)),
      { concurrency: 3 },
    )) {
      expect(result.isFailure()).toBe(true);
      if (result.isFailure()) {
        outcomes.push(result.error.input);
      }
    }

    expect(outcomes.sort((a, b) => a - b)).toEqual(inputs);
  });

  it('never runs more tasks at once than the configured concurrency', async () => {
    const inputs = range(1, 21);
    let inFlight = 0;
    let peak = 0;

    const results = await unfurlPool(
      asyncPool(
        inputs,
        async (n) => {
          inFlight++;
          peak = Math.max(peak, inFlight);
          await new Promise((resolve) => setTimeout(resolve, 1));
          inFlight--;
          return n;
        },
        { concurrency: 4 },
      ),
    );

    expect(results).toHaveLength(inputs.length);
    expect(peak).toBe(4);
  });

  it(
    'runs serially rather than spinning when given a non-positive concurrency',
    { timeout: 5_000 },
    async () => {
      const inputs = range(1, 6);

      const results = await unfurlPool(
        asyncPool(inputs, (n) => Promise.resolve(n), { concurrency: 0 }),
      );

      expect(results).toEqual(inputs);
    },
  );
});
