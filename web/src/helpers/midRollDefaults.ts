import type { ContentProgram } from '@tunarr/types';
import type { BaseSlot, MidRollConfig } from '@tunarr/types/api';
import { clamp } from 'lodash-es';
import { slotProgramDurationsMs } from './slots.ts';

const OneMinuteMs = 60 * 1000;
const FiveMinutesMs = 5 * OneMinuteMs;

const DefaultBreakDurationMs = 3 * OneMinuteMs;
const MinIntervalMs = FiveMinutesMs;
const MaxIntervalMs = 30 * OneMinuteMs;

/** How many breaks a program of typical length should end up with. */
const TargetBreaksPerProgram = 2;

/**
 * Used when the slot's pool cannot be measured -- a smart collection, a custom
 * show, or a channel whose programs are not loaded. Deliberately permissive:
 * a minimum that excludes the content the user just pointed the slot at is
 * indistinguishable from mid-roll being broken, since the schedule comes back
 * with no breaks at all and nothing says why.
 */
export const FallbackMidRollDefaults: MidRollConfig = {
  intervalMs: 15 * OneMinuteMs,
  breakRule: { type: 'fixed_interval', intervalMs: 15 * OneMinuteMs },
  breakDurationMs: DefaultBreakDurationMs,
  maxBreaks: 0,
  minProgramDurationMs: 20 * OneMinuteMs,
  tailBufferMs: 0,
  programTypes: [],
  strategy: 'eager',
};

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function floorTo(value: number, step: number): number {
  return Math.floor(value / step) * step;
}

/**
 * Starting mid-roll settings for a slot, fitted to the programs that slot
 * actually draws from.
 *
 * The interval aims for {@link TargetBreaksPerProgram} breaks in a program of
 * typical length, and the minimum program duration sits at or below the
 * shortest program in the pool so that none of the slot's own content is
 * skipped. Both land on a five minute grid, which is the unit the form edits
 * them in.
 */
export function deriveMidRollDefaults(
  slot: Pick<BaseSlot, 'type'> & { showId?: string },
  programs: ContentProgram[],
): MidRollConfig {
  const durations = slotProgramDurationsMs(slot, programs)
    .filter((duration) => duration > 0)
    .sort((a, b) => a - b);

  if (durations.length === 0) {
    return { ...FallbackMidRollDefaults };
  }

  const shortest = durations[0];
  const typical = durations[Math.floor(durations.length / 2)];

  const intervalMs = clamp(
    roundTo(typical / (TargetBreaksPerProgram + 1), FiveMinutesMs),
    MinIntervalMs,
    MaxIntervalMs,
  );

  return {
    intervalMs,
    breakRule: { type: 'fixed_interval', intervalMs },
    breakDurationMs: DefaultBreakDurationMs,
    maxBreaks: 0,
    minProgramDurationMs: Math.max(
      OneMinuteMs,
      floorTo(shortest, FiveMinutesMs),
    ),
    tailBufferMs: 0,
    programTypes: [],
    strategy: 'eager',
  };
}
