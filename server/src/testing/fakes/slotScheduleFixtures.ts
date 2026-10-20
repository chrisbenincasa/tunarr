import type { SlotSchedulerProgram } from '../../services/scheduling/slotSchedulerUtil.ts';
import { createFakeProgramOrm } from './entityCreators.ts';

// Deterministic programs for slot scheduler tests. Each call returns fresh
// objects, because the schedulers shuffle program arrays in place.

function slotProgram(
  overrides: Parameters<typeof createFakeProgramOrm>[0],
  extra: Partial<Pick<SlotSchedulerProgram, 'parentCustomShows'>> = {},
): SlotSchedulerProgram {
  return {
    ...createFakeProgramOrm(overrides),
    parentCustomShows: extra.parentCustomShows ?? [],
    parentFillerLists: [],
    parentSmartCollections: [],
  };
}

export function fixtureEpisodes(
  showId: string,
  count: number,
  durationMs: number,
) {
  return Array.from({ length: count }, (_, i) =>
    slotProgram({
      uuid: `${showId}-ep${i + 1}`,
      title: `${showId} episode ${i + 1}`,
      type: 'episode',
      duration: durationMs,
      seasonNumber: Math.floor(i / 6) + 1,
      episode: (i % 6) + 1,
      tvShowUuid: showId,
    }),
  );
}

// Programs listed in a custom show in the order `custom-1` .. `custom-n`.
export function fixtureCustomShowPrograms(
  customShowId: string,
  count: number,
  durationMs: number,
) {
  return Array.from({ length: count }, (_, i) =>
    slotProgram(
      {
        uuid: `custom-${i + 1}`,
        title: `Custom ${i + 1}`,
        type: 'other_video',
        duration: durationMs,
      },
      { parentCustomShows: [{ customShowId, index: i }] },
    ),
  );
}

export function fixtureSlotId(n: number) {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}
