import { describe, expect, test } from 'vitest';
import { summarizeProbes } from './probeStats.ts';

describe('summarizeProbes', () => {
  test('reports the slowest samples, not just the single worst', () => {
    // The shape a real time-slot save produces: two distinct stalls back to
    // back, then an idle server. Reported as a max, the second stall — 40% of
    // the damage — is invisible.
    const samples = [272.3, 197.4, 1.3, 1.0, 0.9, 1.1, 0.8];

    const summary = summarizeProbes(samples, 0, 25);

    expect(summary.maxMs).toBeCloseTo(272.3);
    expect(summary.topSlowMs.slice(0, 2)).toEqual([272.3, 197.4]);
  });

  test('totalExcessMs accounts for every stall, where maxMs accounts for one', () => {
    const twoStalls = summarizeProbes([272.3, 197.4, 1.0], 0, 25);
    const oneStall = summarizeProbes([272.3, 1.0, 1.0], 0, 25);

    // Identical worst case, very different amount of degraded service. This is
    // why totalExcessMs is the headline metric and maxMs is not.
    expect(twoStalls.maxMs).toEqual(oneStall.maxMs);
    expect(twoStalls.totalExcessMs).toBeGreaterThan(
      oneStall.totalExcessMs * 1.5,
    );
  });

  test('topSlowMs is capped and ordered descending', () => {
    const summary = summarizeProbes(
      [5, 90, 1, 70, 3, 80, 2, 60, 50, 40],
      0,
      25,
    );

    expect(summary.topSlowMs).toEqual([90, 80, 70, 60, 50]);
  });

  test('an idle run reports no stalls', () => {
    const summary = summarizeProbes([1.0, 0.9, 1.2, 0.8], 0, 25);

    expect(summary.slowCount).toBe(0);
    expect(summary.totalExcessMs).toBe(0);
    expect(summary.topSlowMs.every((ms) => ms < 25)).toBe(true);
  });

  test('handles an empty sample set without throwing', () => {
    const summary = summarizeProbes([], 0, 25);

    expect(summary.count).toBe(0);
    expect(summary.maxMs).toBe(0);
    expect(summary.topSlowMs).toEqual([]);
  });
});
