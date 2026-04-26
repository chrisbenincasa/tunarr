import { describe, expect, it } from 'vitest';
import type { MidRollConfig } from '@tunarr/types/api';
import {
  calculateMidRollBreaks,
  programQualifiesForMidRoll,
} from './midRollUtil.ts';

const baseConfig: MidRollConfig = {
  intervalMs: 30 * 60 * 1000, // 30 minutes
  maxBreaks: 10,
  breakDurationMs: 3 * 60 * 1000, // 3 minutes
  minProgramDurationMs: 60 * 60 * 1000, // 60 minutes
};

describe('calculateMidRollBreaks', () => {
  it('returns null for programs shorter than minProgramDurationMs', () => {
    const result = calculateMidRollBreaks(30 * 60 * 1000, baseConfig);
    expect(result).toBeNull();
  });

  it('returns null when breakCount is 0', () => {
    // Program of exactly 30 min => ceil(30/30) - 1 = 0 breaks
    const result = calculateMidRollBreaks(30 * 60 * 1000, {
      ...baseConfig,
      minProgramDurationMs: 0,
    });
    expect(result).toBeNull();
  });

  it('caps breaks at maxBreaks', () => {
    // 3-hour program, 30-min interval => ceil(180/30)-1 = 5 breaks, capped at 2
    const result = calculateMidRollBreaks(3 * 60 * 60 * 1000, {
      ...baseConfig,
      maxBreaks: 2,
    });
    expect(result).not.toBeNull();
    expect(result!.segments.length).toBe(3); // 2 breaks = 3 segments
  });

  it('segment durations sum to original program duration', () => {
    const programDurationMs = 2 * 60 * 60 * 1000; // 2 hours
    const result = calculateMidRollBreaks(programDurationMs, baseConfig);
    expect(result).not.toBeNull();
    const totalSegmentDuration = result!.segments.reduce(
      (acc, seg) => acc + seg.durationMs,
      0,
    );
    expect(totalSegmentDuration).toBe(programDurationMs);
  });

  it('assigns correct startOffsetMs per segment', () => {
    const intervalMs = 30 * 60 * 1000;
    const result = calculateMidRollBreaks(2 * 60 * 60 * 1000, {
      ...baseConfig,
      intervalMs,
    });
    expect(result).not.toBeNull();
    expect(result!.segments[0]!.startOffsetMs).toBe(0);
    expect(result!.segments[1]!.startOffsetMs).toBe(intervalMs);
    expect(result!.segments[2]!.startOffsetMs).toBe(2 * intervalMs);
  });

  it('calculates totalBreakDurationMs correctly', () => {
    const result = calculateMidRollBreaks(2 * 60 * 60 * 1000, baseConfig);
    expect(result).not.toBeNull();
    // 2 hours / 30 min => ceil(4) - 1 = 3 breaks
    expect(result!.totalBreakDurationMs).toBe(3 * baseConfig.breakDurationMs);
  });

  it('caps breaks to fit within slotDurationMs', () => {
    // 2-hour program, 30-min interval => 3 breaks normally
    // Each break = 3 min. Slot = 2h10m => room for only 3 breaks (2h + 3*3m = 2h9m fits, 4 would overflow)
    // But with maxBreaks=10 and 3 natural breaks, we just check it doesn't overflow the slot
    const programDurationMs = 2 * 60 * 60 * 1000; // 2 hours
    const slotDurationMs = 2 * 60 * 60 * 1000 + 5 * 60 * 1000; // 2h 5m
    // breakDurationMs = 3 min => max breaks from slot = floor(5min / 3min) = 1
    const result = calculateMidRollBreaks(
      programDurationMs,
      baseConfig,
      slotDurationMs,
    );
    expect(result).not.toBeNull();
    expect(result!.segments.length).toBe(2); // 1 break = 2 segments
    expect(
      programDurationMs + result!.totalBreakDurationMs,
    ).toBeLessThanOrEqual(slotDurationMs);
  });

  it('returns null when no breaks fit within slotDurationMs', () => {
    // 2-hour program in a exactly 2-hour slot => 0 room for breaks
    const programDurationMs = 2 * 60 * 60 * 1000;
    const result = calculateMidRollBreaks(
      programDurationMs,
      baseConfig,
      programDurationMs,
    );
    expect(result).toBeNull();
  });
});

describe('programQualifiesForMidRoll', () => {
  it('returns false for non-content programs', () => {
    const result = programQualifiesForMidRoll(
      { type: 'flex', duration: 1000, persisted: false },
      baseConfig,
    );
    expect(result).toBe(false);
  });

  it('returns true for content programs', () => {
    const result = programQualifiesForMidRoll(
      { type: 'content', duration: 1000, persisted: true },
      baseConfig,
    );
    expect(result).toBe(true);
  });
});
