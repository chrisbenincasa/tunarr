import { isDefined } from '@/util/index.js';
import type { CondensedChannelProgram } from '@tunarr/types';
import type { MidRollConfig } from '@tunarr/types/api';

type MidRollBreakResult = {
  segments: { startOffsetMs: number; durationMs: number }[];
  totalBreakDurationMs: number;
};

export function calculateMidRollBreaks(
  programDurationMs: number,
  config: MidRollConfig,
  slotDurationMs?: number,
): MidRollBreakResult | null {
  if (programDurationMs < config.minProgramDurationMs) {
    return null;
  }

  let breakCount = Math.ceil(programDurationMs / config.intervalMs) - 1;
  if (config.maxBreaks >= 1) {
    breakCount = Math.min(breakCount, config.maxBreaks);
  }

  // If we know the slot duration, cap breaks so the total fits:
  // programDuration + breakCount * breakDuration <= slotDuration
  if (isDefined(slotDurationMs)) {
    const maxBreaksFromSlot = Math.floor(
      (slotDurationMs - programDurationMs) / config.breakDurationMs,
    );
    breakCount = Math.min(breakCount, maxBreaksFromSlot);
  }

  if (breakCount <= 0) {
    return null;
  }

  const segments: { startOffsetMs: number; durationMs: number }[] = [];
  for (let i = 0; i < breakCount; i++) {
    const startOffsetMs = i * config.intervalMs;
    const endOffsetMs = (i + 1) * config.intervalMs;
    segments.push({ startOffsetMs, durationMs: endOffsetMs - startOffsetMs });
  }
  // Final segment
  segments.push({
    startOffsetMs: breakCount * config.intervalMs,
    durationMs: programDurationMs - breakCount * config.intervalMs,
  });

  return {
    segments,
    totalBreakDurationMs: breakCount * config.breakDurationMs,
  };
}

export function programQualifiesForMidRoll(
  program: CondensedChannelProgram,
  config: MidRollConfig,
): boolean {
  if (program.type !== 'content') {
    return false;
  }
  if (!config.programTypes || config.programTypes.length === 0) {
    return true;
  }
  // We can't easily check subtype on CondensedContentProgram, so we allow
  // all content programs when type filter is set (subtype filtering happens
  // at a higher level if needed).
  return true;
}
