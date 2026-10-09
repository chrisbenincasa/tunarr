import { sortedLastIndex } from 'lodash-es';
import type { LineupItem } from './derived_types/Lineup.ts';
import { isContentItem, isOfflineItem } from './derived_types/Lineup.ts';
import { calculateStartTimeOffsets } from './lineupUtil.ts';

export type ReconciledItemIndex = {
  // Index of the item in the reconciled lineup. A dropped item points at the
  // item that took its place.
  index: number;
  kept: boolean;
};

export type LineupDurationReconciliation = {
  items: LineupItem[];
  indexMap: ReconciledItemIndex[];
  changedItemCount: number;
};

/**
 * Brings lineup item durations in line with the current program durations.
 *
 * - A whole program item takes the program's duration.
 * - A mid-roll segment is clamped to the program's end. The final segment
 *   grows or shrinks so the segments still cover the whole program.
 * - When an item changes length, a flex item right after it absorbs the
 *   difference, so later items keep their place in the cycle.
 * - Items whose duration drops to zero are removed.
 */
export function reconcileLineupDurations(
  items: ReadonlyArray<LineupItem>,
  programDurations: ReadonlyMap<string, number>,
): LineupDurationReconciliation {
  const durations = items.map((item) => item.durationMs);
  let changedItemCount = 0;

  items.forEach((item, i) => {
    const target = targetDuration(items, i, programDurations);
    if (target === undefined || target === item.durationMs) {
      return;
    }

    changedItemCount++;
    durations[i] = target;

    const next = items[i + 1];
    if (isOfflineItem(next) && next.fillerConfig?.origin !== 'midroll') {
      durations[i + 1] = Math.max(
        0,
        next.durationMs - (target - item.durationMs),
      );
    }
  });

  const reconciled: LineupItem[] = [];
  const indexMap: ReconciledItemIndex[] = [];
  items.forEach((item, i) => {
    const durationMs = durations[i] ?? item.durationMs;
    const kept = durationMs > 0;
    indexMap.push({ index: reconciled.length, kept });
    if (kept) {
      reconciled.push(
        durationMs === item.durationMs ? item : { ...item, durationMs },
      );
    }
  });

  return { items: reconciled, indexMap, changedItemCount };
}

function targetDuration(
  items: ReadonlyArray<LineupItem>,
  index: number,
  programDurations: ReadonlyMap<string, number>,
): number | undefined {
  const item = items[index];
  if (!isContentItem(item) || item.fillerType === 'fallback') {
    return;
  }

  const programDuration = programDurations.get(item.id);
  if (programDuration === undefined || programDuration <= 0) {
    return;
  }

  if (item.startOffsetMs === undefined) {
    return programDuration;
  }

  const remaining = Math.max(0, programDuration - item.startOffsetMs);
  return isFinalSegment(items, index)
    ? remaining
    : Math.min(item.durationMs, remaining);
}

// A segment is final when no later segment of the same airing follows it.
// Breaks between segments hold flex and filler items, so those are skipped.
function isFinalSegment(items: ReadonlyArray<LineupItem>, index: number) {
  const segment = items[index];
  if (!isContentItem(segment) || segment.startOffsetMs === undefined) {
    return true;
  }

  for (let i = index + 1; i < items.length; i++) {
    const next = items[i];
    if (isOfflineItem(next)) {
      continue;
    }
    if (isContentItem(next) && next.fillerType !== undefined) {
      continue;
    }
    return !(
      isContentItem(next) &&
      next.id === segment.id &&
      next.startOffsetMs !== undefined &&
      next.startOffsetMs > segment.startOffsetMs
    );
  }

  return true;
}

/**
 * Maps a position in the old cycle to the same moment in the reconciled one.
 *
 * Inside a program, the elapsed time from its start is kept. Inside flex, the
 * time left until it ends is kept, so the next program starts on schedule.
 * A dropped item maps to the start of the item that replaced it.
 */
export function remapLineupPosition(
  oldItems: ReadonlyArray<LineupItem>,
  reconciliation: LineupDurationReconciliation,
  positionMs: number,
): number {
  const newItems = reconciliation.items;
  const oldOffsets = calculateStartTimeOffsets(oldItems);
  const newOffsets = calculateStartTimeOffsets(newItems);
  const newCycle = newOffsets[newItems.length] ?? 0;
  if (oldItems.length === 0 || newCycle <= 0) {
    return 0;
  }

  const oldIndex = Math.min(
    sortedLastIndex(oldOffsets, positionMs) - 1,
    oldItems.length - 1,
  );
  const oldItem = oldItems[oldIndex];
  const oldStart = oldOffsets[oldIndex];
  const mapped = reconciliation.indexMap[oldIndex];
  if (!oldItem || oldStart === undefined || !mapped) {
    return 0;
  }

  const newItem = newItems[mapped.index];
  const newStart = newOffsets[mapped.index];
  if (!newItem || newStart === undefined) {
    return 0;
  }

  const elapsed = positionMs - oldStart;
  let newElapsed: number;
  if (!mapped.kept) {
    newElapsed = 0;
  } else if (isOfflineItem(oldItem)) {
    const remaining = oldItem.durationMs - elapsed;
    newElapsed = Math.max(0, newItem.durationMs - remaining);
  } else {
    newElapsed = Math.min(elapsed, newItem.durationMs);
  }

  return (newStart + newElapsed) % newCycle;
}

/**
 * Returns a channel start time that puts `now` at `positionMs` in a cycle of
 * `cycleMs`. The result stays as close to the old start time as it can, and
 * never lands after `now`.
 */
export function rebaseChannelStartTime(
  oldStartTime: number,
  cycleMs: number,
  now: number,
  positionMs: number,
): number {
  const latestStart = now - positionMs;
  const cycles = Math.max(
    0,
    Math.floor((latestStart - oldStartTime) / cycleMs),
  );
  return latestStart - cycles * cycleMs;
}
