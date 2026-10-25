import type {
  RandomSlot,
  RandomSlotSchedule,
  SlotFiller,
  TimeSlot,
  TimeSlotSchedule,
} from '@tunarr/types/api';
import type { SlotSchedulerProgram } from '../../services/scheduling/slotSchedulerUtil.ts';
import { createFakeProgramOrm } from './entityCreators.ts';

// Deterministic programs and schedules covering every slot ordering and
// link-group mode. Each call returns fresh objects, because the schedulers
// shuffle program arrays in place.

const oneMin = 60 * 1000;
const oneHour = 60 * oneMin;

export const FixtureIds = {
  showA: 'show-a',
  showB: 'show-b',
  customShow: '00000000-0000-4000-8000-0000000000c5',
  fillerList: '00000000-0000-4000-8000-0000000000f1',
  rerunGroup: '00000000-0000-4000-8000-0000000000a1',
  continueGroup: '00000000-0000-4000-8000-0000000000a2',
  mixedGroup: '00000000-0000-4000-8000-0000000000a3',
} as const;

function slotProgram(
  overrides: Parameters<typeof createFakeProgramOrm>[0],
  extra: Partial<
    Pick<SlotSchedulerProgram, 'parentCustomShows' | 'parentFillerLists'>
  > = {},
): SlotSchedulerProgram {
  return {
    ...createFakeProgramOrm(overrides),
    parentCustomShows: extra.parentCustomShows ?? [],
    parentFillerLists: extra.parentFillerLists ?? [],
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

export function fixturePrograms(): SlotSchedulerProgram[] {
  const movies = Array.from({ length: 15 }, (_, i) =>
    slotProgram({
      uuid: `movie-${i + 1}`,
      title: `Movie ${String(i + 1).padStart(2, '0')}`,
      type: 'movie',
      duration: 80 * oneMin + i * 3 * oneMin,
      originalAirDate: `20${String(10 + i).padStart(2, '0')}-01-01`,
    }),
  );
  const customShowPrograms = Array.from({ length: 10 }, (_, i) =>
    slotProgram(
      {
        uuid: `custom-${i + 1}`,
        title: `Custom ${i + 1}`,
        type: 'other_video',
        duration: 25 * oneMin,
      },
      {
        parentCustomShows: [{ customShowId: FixtureIds.customShow, index: i }],
      },
    ),
  );
  const ads = Array.from({ length: 20 }, (_, i) =>
    slotProgram(
      {
        uuid: `ad-${i + 1}`,
        title: `Ad ${i + 1}`,
        type: 'other_video',
        duration: 30 * 1000 + i * 1000,
      },
      { parentFillerLists: [FixtureIds.fillerList] },
    ),
  );

  return [
    ...fixtureEpisodes(FixtureIds.showA, 12, 22 * oneMin),
    ...fixtureEpisodes(FixtureIds.showB, 8, 44 * oneMin),
    ...movies,
    ...customShowPrograms,
    ...ads,
  ];
}

const postFiller: SlotFiller[] = [
  {
    types: ['post'],
    fillerListId: FixtureIds.fillerList,
    fillerOrder: 'uniform',
  },
];

const tailFiller: SlotFiller[] = [
  {
    types: ['tail'],
    fillerListId: FixtureIds.fillerList,
    fillerOrder: 'shuffle_prefer_short',
  },
];

export function fixtureSlotId(n: number) {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

function at(hours: number, minutes = 0) {
  return hours * oneHour + minutes * oneMin;
}

export function fixtureTimeSlotSchedule(
  overrides: Partial<TimeSlotSchedule> = {},
): TimeSlotSchedule {
  const slots: TimeSlot[] = [
    {
      id: fixtureSlotId(1),
      startTime: at(0),
      type: 'movie',
      order: 'chronological',
      direction: 'asc',
    },
    {
      id: fixtureSlotId(2),
      startTime: at(3),
      type: 'show',
      showId: FixtureIds.showA,
      order: 'next',
      direction: 'asc',
      seasonFilter: [],
      seasonExcludeFilter: [],
    },
    {
      id: fixtureSlotId(3),
      startTime: at(4),
      type: 'show',
      showId: FixtureIds.showA,
      order: 'shuffle',
      direction: 'asc',
      seasonFilter: [],
      seasonExcludeFilter: [],
      filler: postFiller,
    },
    {
      id: fixtureSlotId(4),
      startTime: at(5),
      type: 'custom-show',
      customShowId: FixtureIds.customShow,
      order: 'next',
      direction: 'asc',
    },
    {
      id: fixtureSlotId(5),
      startTime: at(6),
      type: 'custom-show',
      customShowId: FixtureIds.customShow,
      order: 'shuffle',
      direction: 'asc',
    },
    {
      id: fixtureSlotId(6),
      startTime: at(7),
      type: 'custom-show',
      customShowId: FixtureIds.customShow,
      order: 'ordered_shuffle',
      direction: 'asc',
    },
    {
      id: fixtureSlotId(7),
      startTime: at(8),
      type: 'movie',
      order: 'shuffle',
      direction: 'asc',
      filler: tailFiller,
    },
    {
      id: fixtureSlotId(8),
      startTime: at(11),
      type: 'show',
      showId: FixtureIds.showB,
      order: 'ordered_shuffle',
      direction: 'asc',
      seasonFilter: [],
      seasonExcludeFilter: [],
    },
    {
      id: fixtureSlotId(9),
      startTime: at(12),
      type: 'show',
      showId: FixtureIds.showB,
      order: 'next',
      direction: 'asc',
      seasonFilter: [],
      seasonExcludeFilter: [],
      iterationGroup: FixtureIds.rerunGroup,
      linkMode: 'rerun',
    },
    {
      id: fixtureSlotId(10),
      startTime: at(13),
      type: 'show',
      showId: FixtureIds.showB,
      order: 'next',
      direction: 'asc',
      seasonFilter: [],
      seasonExcludeFilter: [],
      iterationGroup: FixtureIds.rerunGroup,
      linkMode: 'rerun',
    },
    {
      id: fixtureSlotId(11),
      startTime: at(14),
      type: 'show',
      showId: FixtureIds.showA,
      order: 'next',
      direction: 'asc',
      seasonFilter: [],
      seasonExcludeFilter: [],
      iterationGroup: FixtureIds.continueGroup,
      linkMode: 'continue',
    },
    {
      id: fixtureSlotId(12),
      startTime: at(15),
      type: 'show',
      showId: FixtureIds.showA,
      order: 'next',
      direction: 'asc',
      seasonFilter: [],
      seasonExcludeFilter: [],
      iterationGroup: FixtureIds.continueGroup,
      linkMode: 'continue',
    },
    {
      id: fixtureSlotId(13),
      startTime: at(16),
      type: 'show',
      showId: FixtureIds.showB,
      order: 'shuffle',
      direction: 'asc',
      seasonFilter: [],
      seasonExcludeFilter: [],
      iterationGroup: FixtureIds.mixedGroup,
      linkMode: 'continue',
    },
    {
      id: fixtureSlotId(14),
      startTime: at(18),
      type: 'show',
      showId: FixtureIds.showB,
      order: 'shuffle',
      direction: 'asc',
      seasonFilter: [],
      seasonExcludeFilter: [],
      iterationGroup: FixtureIds.mixedGroup,
      linkMode: 'rerun',
      rerunOverflow: 'continue',
    },
    {
      id: fixtureSlotId(15),
      startTime: at(20),
      type: 'movie',
      order: 'alphanumeric',
      direction: 'desc',
    },
  ];

  return {
    type: 'time',
    flexPreference: 'end',
    maxDays: 6,
    padMs: 5 * oneMin,
    period: 'day',
    latenessMs: 0,
    overflow: { type: 'duration', maxMs: 0 },
    timeZoneOffset: 0,
    slots,
    ...overrides,
  };
}

export function fixtureRandomSlotSchedule(
  overrides: Partial<RandomSlotSchedule> = {},
): RandomSlotSchedule {
  const base = {
    weight: 1,
    cooldownMs: 0,
  };
  const slots: RandomSlot[] = [
    {
      ...base,
      id: fixtureSlotId(101),
      type: 'show',
      showId: FixtureIds.showA,
      order: 'next',
      direction: 'asc',
      seasonFilter: [],
      seasonExcludeFilter: [],
      durationSpec: { type: 'fixed', durationMs: oneHour },
    },
    {
      ...base,
      id: fixtureSlotId(102),
      type: 'show',
      showId: FixtureIds.showB,
      order: 'shuffle',
      direction: 'asc',
      seasonFilter: [],
      seasonExcludeFilter: [],
      durationSpec: { type: 'dynamic', programCount: 2 },
      filler: postFiller,
    },
    {
      ...base,
      id: fixtureSlotId(103),
      type: 'custom-show',
      customShowId: FixtureIds.customShow,
      order: 'ordered_shuffle',
      direction: 'asc',
      cooldownMs: 3 * oneHour,
      durationSpec: { type: 'dynamic', programCount: 1 },
    },
    {
      ...base,
      id: fixtureSlotId(104),
      type: 'movie',
      order: 'shuffle',
      direction: 'asc',
      weight: 2,
      durationSpec: { type: 'dynamic', programCount: 1 },
      filler: tailFiller,
    },
    {
      ...base,
      id: fixtureSlotId(105),
      type: 'custom-show',
      customShowId: FixtureIds.customShow,
      order: 'next',
      direction: 'asc',
      durationSpec: { type: 'fixed', durationMs: oneHour },
    },
  ];

  return {
    type: 'random',
    flexPreference: 'end',
    maxDays: 3,
    padMs: 5 * oneMin,
    padStyle: 'slot',
    randomDistribution: 'uniform',
    lockWeights: false,
    slots,
    ...overrides,
  };
}
