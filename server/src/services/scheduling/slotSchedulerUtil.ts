import constants from '@tunarr/shared/constants';
import { isNonEmptyString } from '@tunarr/shared/util';
import {
  isContentProgram,
  isFlexProgram,
  type CondensedChannelProgram,
  type CondensedContentProgram,
  type FillerProgram,
  type FlexProgram,
} from '@tunarr/types';
import {
  slotHasFiller,
  slotIsLinkable,
  type BaseMovieProgrammingSlot,
  type BaseShowProgrammingSlot,
  type BaseSlot,
  type FillerProgrammingSlot,
  type MidRollConfig,
  type SlotFillerTypes,
} from '@tunarr/types/api';
import type { OfflineFillerConfig } from '@tunarr/types/schemas';
import { FillerTypes } from '@tunarr/types/schemas';
import type { Duration } from 'dayjs/plugin/duration.js';
import {
  forEach,
  isEmpty,
  isNil,
  isNull,
  last,
  map,
  reduce,
  reject,
  sortBy,
  sumBy,
  uniq,
  uniqBy,
  values,
} from 'lodash-es';
import type { Random } from 'random-js';
import type {
  NonEmptyArray,
  StrictExclude,
  StrictExtract,
} from 'ts-essentials';
import { match, P } from 'ts-pattern';
import { v4 } from 'uuid';
import type { ProgramWithRelationsOrm } from '../../db/schema/derivedTypes.ts';
import type { Nullable } from '../../types/util.ts';
import { isNonEmptyArray, retrySimple } from '../../util/index.ts';
import { FlexProgramIterator } from './FlexProgramIterator.ts';
import {
  resolveBreakDuration,
  resolveBreakPoints,
} from './midRollBreakRules.ts';
import {
  ContentProgramChunkedShuffle,
  CustomProgramChunkedShuffle,
} from './ProgramChunkedShuffle.ts';
import type { ProgramIterator } from './ProgramIterator.js';
import {
  fillerSlotIteratorKey,
  getProgramOrderer,
  RecordingProgramIterator,
  ReplayProgramIterator,
  RerunProgramIterator,
  slotIteratorKey,
} from './ProgramIterator.js';
import {
  ContentProgramOrderedIterator,
  CustomProgramOrderedIterator,
} from './ProgramOrdereredIterator.ts';
import {
  ContentProgramShuffleIterator,
  CustomProgramShuffleIterator,
  ProgramShuffleIteratorImpl,
} from './ShuffleProgramIterator.ts';
import type { SlotImpl } from './SlotImpl.ts';
import { StaticProgramIterator } from './StaticProgramIterator.ts';
import { WeightedFillerProgramIterator } from './WeightedFillerProgramIterator.ts';

type ProgramMapping = {
  content: Record<ContentSlotId, SlotSchedulerProgram[]>;
  custom: Record<`custom-show.${string}`, SlotSchedulerProgram[]>;
  filler: Record<`filler.${string}`, SlotSchedulerProgram[]>;
  smartCollection: Record<`smart-collection.${string}`, SlotSchedulerProgram[]>;
};

export type CustomShowContext = {
  customShowId: string;
  index: number; // TODO: support multiple indices
};

export type SlotSchedulerProgram = ProgramWithRelationsOrm & {
  parentFillerLists: string[];
  parentCustomShows: CustomShowContext[];
  parentSmartCollections: string[];
};

type ContentSlotId =
  | 'movie'
  | 'music_video'
  | 'other_video'
  | `show.${string}`
  | `artist.${string}`;

export type SlotId =
  | ContentSlotId
  | `custom-show.${string}`
  | `filler.${string}`
  | `redirect.${string}`
  | `smart-collection.${string}`
  | `flex`;

const customShowSlotId = (id: string): `custom-show.${typeof id}` =>
  `custom-show.${id}` as const;
const fillerSlotId = (id: string): `filler.${typeof id}` =>
  `filler.${id}` as const;
const smartCollectionId = (id: string): `smart-collection.${string}` =>
  `smart-collection.${id}` as const;

export function deduplicatePrograms(
  programs: SlotSchedulerProgram[],
): SlotSchedulerProgram[] {
  const acc: Map<string, SlotSchedulerProgram> = new Map();
  for (const program of programs) {
    if (acc.has(program.uuid)) {
      const existing = acc.get(program.uuid)!;
      // Merge ids. This should theoretically never happen.
      existing.parentFillerLists = uniq(
        existing.parentFillerLists.concat(program.parentFillerLists),
      );
      existing.parentCustomShows = uniq(
        existing.parentCustomShows.concat(program.parentCustomShows),
      );
      existing.parentSmartCollections = uniq(
        existing.parentSmartCollections.concat(program.parentSmartCollections),
      );
      acc.set(program.uuid, existing); // Necessary?
    } else {
      acc.set(program.uuid, program);
    }
  }
  return [...acc.values()];
}

/**
 * Creates a mapping of 'schedulable' content
 * @param programs
 * @returns
 */
export function createProgramMap(
  programs: SlotSchedulerProgram[],
): ProgramMapping {
  return reduce(
    programs,
    (acc, program) => {
      const id = match(program)
        .returnType<Nullable<ContentSlotId>>()
        .with(
          { type: P.union('movie', 'music_video', 'other_video') },
          () => 'movie',
        )
        .with(
          { type: 'episode', show: { uuid: P.when(isNonEmptyString) } },
          (ep) => `show.${ep.show.uuid}`,
        )
        .with(
          { type: 'episode', tvShowUuid: P.when(isNonEmptyString) },
          (ep) => `show.${ep.tvShowUuid}`,
        )
        .with(
          { type: 'track', artist: { uuid: P.when(isNonEmptyString) } },
          (track) => `artist.${track.artist.uuid}`,
        )
        .otherwise(() => null);

      if (!isNull(id)) {
        const existing = acc.content[id] ?? [];
        existing.push(program);
        acc.content[id] = existing;
      }

      for (const customShow of program.parentCustomShows) {
        const id = `custom-show.${customShow.customShowId}` as const;
        const existing = acc.custom[id] ?? [];
        existing.push(program);
        acc.custom[id] = existing;
      }

      for (const fillerList of program.parentFillerLists) {
        const id = `filler.${fillerList}` as const;
        const existing = acc.filler[id] ?? [];
        existing.push(program);
        acc.filler[id] = existing;
      }

      for (const collectionId of program.parentSmartCollections) {
        const id = smartCollectionId(collectionId);
        const existing = acc.smartCollection[id] ?? [];
        existing.push(program);
        acc.smartCollection[id] = existing;
      }

      return acc;
    },
    {
      content: {},
      redirect: {},
      custom: {},
      filler: {},
      smartCollection: {},
    } as unknown as ProgramMapping,
  );
}

export function createFillerIterators(
  slots: BaseSlot[],
  programBySlotType: ProgramMapping,
  random: Random,
): Partial<Record<SlotIteratorKey, ProgramIterator<FillerProgram>>> {
  const slotFiller = uniqBy(
    slots.filter(slotHasFiller).flatMap((slot) => slot.filler ?? []),
    ({ fillerListId }) => fillerListId,
  );

  const fillerIterators: Partial<
    Record<SlotIteratorKey, ProgramIterator<FillerProgram>>
  > = {};

  for (const fillerDef of slotFiller) {
    const fakeSlot = match(fillerDef.fillerOrder)
      .returnType<FillerProgrammingSlot>()
      .with('uniform', () => ({
        id: v4(), // New id for virtual slot
        type: 'filler',
        order: 'uniform',
        decayFactor: 0.5,
        recoveryFactor: 0.05,
        durationWeighting: 'linear',
        fillerListId: fillerDef.fillerListId,
      }))
      .with(P.union('shuffle_prefer_long', 'shuffle_prefer_short'), (order) => {
        return {
          id: v4(),
          type: 'filler',
          fillerListId: fillerDef.fillerListId,
          order,
          decayFactor: 0.5,
          durationWeighting: 'linear',
          recoveryFactor: 0.05,
        } satisfies FillerProgrammingSlot;
      })
      .exhaustive();

    const iteratorKey = slotIteratorKey(fakeSlot);
    const slotId = `filler.${fillerDef.fillerListId}` satisfies SlotId;

    const programs = programBySlotType.filler[slotId] ?? [];
    if (!isNonEmptyArray(programs)) {
      throw new Error('Cannot schedule an empty filler list slot.');
    }

    const iterator =
      fakeSlot.order === 'uniform'
        ? new ProgramShuffleIteratorImpl(programs, random, (program) => ({
            type: 'filler',
            duration: program.duration,
            fillerListId: fillerDef.fillerListId,
            id: program.uuid,
            persisted: true,
          }))
        : new WeightedFillerProgramIterator(programs, fakeSlot, random);

    fillerIterators[iteratorKey] = iterator;
  }
  return fillerIterators;
}

export function createSlotProgramIterator(
  slot: BaseSlot,
  programBySlotType: ProgramMapping,
  random: Random,
): ProgramIterator {
  return match(slot)
    .with(
      { type: 'flex' },
      () =>
        new FlexProgramIterator({
          duration: -1,
          type: 'flex',
        }),
    )
    .with({ type: 'redirect' }, (slot) => {
      return new StaticProgramIterator({
        type: 'redirect',
        channel: slot.channelId,
        channelName: slot.channelName ?? '',
        channelNumber: -1,
        duration: 1,
      });
    })
    .with({ type: 'custom-show', order: 'next' }, (slot) => {
      const programs =
        programBySlotType.custom[customShowSlotId(slot.customShowId)] ?? [];
      return new CustomProgramOrderedIterator(slot.customShowId, programs);
    })
    .with(
      { type: 'custom-show', order: 'shuffle' },
      (slot) =>
        new CustomProgramShuffleIterator(
          slot.customShowId,
          programBySlotType.custom[customShowSlotId(slot.customShowId)] ?? [],
          random,
        ),
    )
    .with({ type: 'custom-show', order: 'ordered_shuffle' }, (slot) => {
      const programs =
        programBySlotType.custom[`custom-show.${slot.customShowId}` as const] ??
        [];
      return new CustomProgramChunkedShuffle(slot.customShowId, programs);
    })
    .with({ type: 'custom-show' }, (slot) => {
      throw new Error(
        `Invalid ordering type for custom show slot: ${slot.order}`,
      );
    })
    .with(
      {
        type: 'filler',
        order: P.union('shuffle_prefer_short', 'shuffle_prefer_long'),
      },
      (slot) => {
        const programs =
          programBySlotType.filler[fillerSlotId(slot.fillerListId)] ?? [];
        if (!isNonEmptyArray(programs)) {
          throw new Error('Cannot schedule an empty filler list slot.');
        }
        return new WeightedFillerProgramIterator(programs, slot, random);
      },
    )
    .with({ type: 'filler' }, (slot) => {
      const programs =
        programBySlotType.filler[fillerSlotId(slot.fillerListId)] ?? [];
      if (isEmpty(programs)) {
        throw new Error('Cannot schedule an empty filler list slot.');
      }
      return new ProgramShuffleIteratorImpl(programs, random, (program) => ({
        type: 'filler',
        duration: program.duration,
        fillerListId: slot.fillerListId,
        id: program.uuid,
        persisted: true,
      }));
    })
    .with({ type: P.union('movie', 'show') }, (slot) => {
      const slotId = match(slot)
        .returnType<ContentSlotId>()
        .with({ type: 'movie' }, () => 'movie')
        .with({ type: 'show' }, (show) => `show.${show.showId}`)
        .exhaustive();
      return getContentProgramIterator(programBySlotType, slotId, slot, random);
    })
    .with({ type: 'smart-collection' }, (slot) => {
      const programs =
        programBySlotType.smartCollection[
          smartCollectionId(slot.smartCollectionId)
        ] ?? [];
      switch (slot.order) {
        case 'next':
        case 'alphanumeric':
        case 'chronological':
          return new ContentProgramOrderedIterator(
            programs,
            getProgramOrderer(slot.order),
            slot.direction === 'asc',
          );
        case 'shuffle':
          return new ContentProgramShuffleIterator(programs, random);
        case 'ordered_shuffle':
          return new ContentProgramChunkedShuffle(
            programs,
            getProgramOrderer('next'),
            slot.direction === 'asc',
          );
      }
    })
    .exhaustive();
}

export type SlotIteratorResult = {
  iterators: Map<string, ProgramIterator>;
  resetPeriodCallbacks: (() => void)[];
};

type GroupClassification = 'all-rerun' | 'all-continue' | 'mixed';

/**
 * Ensures every slot in the array has a unique `id`. If duplicate IDs are
 * found (e.g. when the UI copies daily slots across a weekly schedule without
 * regenerating IDs), later duplicates receive a fresh UUID so each slot
 * gets its own program iterator.
 *
 * Mutates the slots in-place and returns the same array.
 */
export function deduplicateSlotIds<T extends BaseSlot>(slots: T[]): T[] {
  const seenIds = new Set<string>();
  for (const slot of slots) {
    if (!('id' in slot) || typeof slot.id !== 'string') continue;
    if (seenIds.has(slot.id)) {
      (slot as BaseSlot & { id: string }).id = v4();
    }
    seenIds.add(slot.id);
  }
  return slots;
}

export function createSlotIterators(
  slots: BaseSlot[],
  programBySlotType: ProgramMapping,
  random: Random,
): SlotIteratorResult {
  const result = new Map<string, ProgramIterator>();
  const resetPeriodCallbacks: (() => void)[] = [];

  // Phase 1: Classify each group by its mix of linkMode values.
  const groupModes = new Map<string, Set<string>>();
  const rerunGroupMeta = new Map<string, { count: number }>();

  for (const slot of slots) {
    if (!slotIsLinkable(slot) || !slot.iterationGroup) continue;
    const group = slot.iterationGroup;
    const mode = slot.linkMode ?? 'continue';

    const modes = groupModes.get(group);
    if (modes) {
      modes.add(mode);
    } else {
      groupModes.set(group, new Set([mode]));
    }

    if (mode === 'rerun') {
      const existing = rerunGroupMeta.get(group);
      if (existing) {
        existing.count++;
      } else {
        rerunGroupMeta.set(group, { count: 1 });
      }
    }
  }

  const groupClassification = new Map<string, GroupClassification>();
  for (const [groupId, modes] of groupModes) {
    if (modes.size === 1) {
      groupClassification.set(
        groupId,
        modes.has('rerun') ? 'all-rerun' : 'all-continue',
      );
    } else {
      groupClassification.set(groupId, 'mixed');
    }
  }

  // Phase 2: Build iterators per group classification.
  const groupIterators = new Map<string, ProgramIterator>();
  const groupRecorders = new Map<string, RecordingProgramIterator>();

  const getOrCreateRecorder = (
    group: string,
    slot: BaseSlot,
  ): RecordingProgramIterator => {
    const existing = groupRecorders.get(group);
    if (existing) return existing;
    const base = createSlotProgramIterator(slot, programBySlotType, random);
    const recorder = new RecordingProgramIterator(base);
    groupRecorders.set(group, recorder);
    resetPeriodCallbacks.push(() => recorder.resetPeriod());
    return recorder;
  };

  for (const slot of slots) {
    const linkable = slotIsLinkable(slot) ? slot : undefined;
    const slotId = linkable?.id;
    const group = linkable?.iterationGroup;
    const mode = linkable?.linkMode ?? 'continue';

    const iterator = (() => {
      if (!group) {
        return createSlotProgramIterator(slot, programBySlotType, random);
      }

      const classification = groupClassification.get(group);

      // Legacy all-rerun: use existing RerunProgramIterator.
      if (classification === 'all-rerun') {
        const existing = groupIterators.get(group);
        if (existing) return existing;

        const baseIterator = createSlotProgramIterator(
          slot,
          programBySlotType,
          random,
        );
        const meta = rerunGroupMeta.get(group);
        if (!meta) {
          throw new Error(`Missing rerun group metadata for group ${group}`);
        }
        const newIterator = new RerunProgramIterator(baseIterator, meta.count);
        groupIterators.set(group, newIterator);
        return newIterator;
      }

      // All-continue: shared iterator keyed by group + content key.
      if (classification === 'all-continue') {
        const contentKey = slotIteratorKey(slot);
        const compositeKey = `${group}::${contentKey}`;
        const existing = groupIterators.get(compositeKey);
        if (existing) return existing;
        const newIterator = createSlotProgramIterator(
          slot,
          programBySlotType,
          random,
        );
        groupIterators.set(compositeKey, newIterator);
        return newIterator;
      }

      // Mixed group: continue slots get a RecordingProgramIterator,
      // rerun slots get a ReplayProgramIterator.
      const recorder = getOrCreateRecorder(group, slot);

      if (mode === 'continue') {
        return recorder;
      }

      // mode === 'rerun'
      const overflowMode = linkable?.rerunOverflow ?? 'flex';
      const replay = new ReplayProgramIterator(recorder, overflowMode);
      resetPeriodCallbacks.push(() => replay.resetPeriod());
      return replay;
    })();

    if (slotId !== undefined) {
      result.set(slotId, iterator);
    }
  }

  return { iterators: result, resetPeriodCallbacks };
}

export function getFillerIteratorsForSlot(
  slot: BaseSlot,
  map: Partial<Record<SlotIteratorKey, ProgramIterator>>,
  seenLinkGroups?: Set<string>,
): Record<string, ProgramIterator<FillerProgram>> {
  if (!slotHasFiller(slot)) {
    return {};
  }
  if (!slot.filler) {
    return {};
  }

  const shouldFork =
    seenLinkGroups !== undefined &&
    slotIsLinkable(slot) &&
    slot.iterationGroup !== undefined &&
    seenLinkGroups.has(slot.iterationGroup);

  if (
    seenLinkGroups !== undefined &&
    slotIsLinkable(slot) &&
    slot.iterationGroup !== undefined &&
    !seenLinkGroups.has(slot.iterationGroup)
  ) {
    seenLinkGroups.add(slot.iterationGroup);
  }

  const out: Record<string, ProgramIterator<FillerProgram>> = {};
  for (const filler of slot.filler) {
    const it =
      map[fillerSlotIteratorKey(filler.fillerListId, filler.fillerOrder)];
    if (it) {
      out[filler.fillerListId] = (
        shouldFork ? it.fork() : it
      ) as ProgramIterator<FillerProgram>;
    }
  }

  return out;
}

function getContentProgramIterator(
  programBySlotType: ProgramMapping,
  contentSlotId: ContentSlotId,
  slot: BaseMovieProgrammingSlot | BaseShowProgrammingSlot,
  random: Random,
) {
  let programs = uniqBy(
    programBySlotType.content[contentSlotId] ?? [],
    (p) => p.uuid,
  );

  if (slot.type === 'show') {
    if (slot.seasonFilter.length > 0) {
      programs = programs.filter((program) => {
        const season = program.season?.index ?? program.seasonNumber;
        return !isNil(season) && slot.seasonFilter.includes(season);
      });
    }
    if (slot.seasonExcludeFilter?.length > 0) {
      programs = programs.filter((program) => {
        const season = program.season?.index ?? program.seasonNumber;
        return isNil(season) || !slot.seasonExcludeFilter.includes(season);
      });
    }
  }

  switch (slot.order) {
    case 'next':
    case 'alphanumeric':
    case 'chronological':
      return new ContentProgramOrderedIterator(
        programs,
        getProgramOrderer(slot.order),
        slot.direction === 'asc',
      );
    case 'shuffle':
      return new ContentProgramShuffleIterator(programs, random);
    case 'ordered_shuffle':
      return new ContentProgramChunkedShuffle(
        programs,
        getProgramOrderer('next'),
        slot.direction === 'asc',
      );
  }
}

type SlotTypeWithOrdering = StrictExclude<
  BaseSlot['type'],
  'redirect' | 'flex'
>;
type SlotWithOrdering = StrictExtract<BaseSlot, { type: SlotTypeWithOrdering }>;
export type SlotOrder = SlotWithOrdering['order'];

export type SlotIteratorKey =
  | `movie_${SlotOrder}`
  | `tv_${string}_${SlotOrder}`
  | `redirect_${string}`
  | `custom-show_${string}_${SlotOrder}`
  | `filler_${string}_${SlotOrder}`
  | `smart_collection_${string}_${SlotOrder}`
  | 'flex';

// Adds flex time to the end of a programs array.
// If the final program is flex itself, just extends it
// Returns amount to increment the cursor
// Mutates the lineup array
export function pushOrExtendFlex(
  lineup: CondensedChannelProgram[],
  flexDuration: Duration,
): number {
  const durationMs = flexDuration.asMilliseconds();
  if (durationMs <= 0) {
    return 0;
  }

  const lastLineupItem = last(lineup);
  if (lastLineupItem && isFlexProgram(lastLineupItem)) {
    const newDuration = lastLineupItem.duration + durationMs;
    const newItem: FlexProgram = {
      type: 'flex',
      duration: newDuration,
    };
    lineup[lineup.length - 1] = newItem;
    return durationMs;
  }

  const newItem: FlexProgram = {
    type: 'flex',
    duration: durationMs,
  };

  lineup.push(newItem);
  return durationMs;
}

export function createPaddedProgram(
  program: CondensedChannelProgram,
  padMs: number,
): PaddedProgram {
  const rem = program.duration % padMs;
  const padAmount = padMs - rem;
  const shouldPad = rem > constants.SLACK && padAmount > constants.SLACK;
  return new PaddedProgram(program, shouldPad ? padAmount : 0, {});
}

// Exported for testing only
export function distributeFlex(
  programs: PaddedProgram[],
  padMs: number,
  remainingTime: number,
) {
  const relevantPrograms = reject(
    programs,
    ({ program }) => program.type === 'filler',
  );

  if (relevantPrograms.length === 0) {
    return;
  }

  const div = Math.floor(remainingTime / padMs);
  const mod = remainingTime % padMs;
  // Add leftover flex to end
  const lastProgram = relevantPrograms[relevantPrograms.length - 1]!;
  lastProgram.padMs += mod;
  // lastProgram.totalDuration += mod;

  // Padded programs sorted by least amount of existing padding
  // along with their original index in the programs array
  const sortedPads = sortBy(
    map(relevantPrograms, ({ padMs }, index) => ({ padMs, index })),
    ({ padMs }) => padMs,
  );

  forEach(relevantPrograms, (_, i) => {
    let q = Math.floor(div / relevantPrograms.length);
    if (i < div % relevantPrograms.length) {
      q++;
    }
    const extraPadding = q * padMs;
    const program = relevantPrograms[sortedPads[i]!.index]!;
    program.padMs += extraPadding;
    // program.totalDuration += extraPadding;
  });
}

export function addHeadAndTailFillerToSlot(
  remainingTime: number,
  slot: SlotImpl<BaseSlot>,
  contentPrograms: NonEmptyArray<PaddedProgram>,
): number {
  if (remainingTime <= 0) {
    return remainingTime;
  }

  if (remainingTime > 0 && slot.hasFillerOfType(FillerTypes.head)) {
    const filler = retrySimple(
      () =>
        slot.getFillerOfType(FillerTypes.head, {
          slotDuration: remainingTime,
          timeCursor: -1,
        }),
      3,
    );

    if (filler) {
      remainingTime -= filler.duration;
      contentPrograms[0].filler.head = filler;
    }
  }

  // Save the last item's pad.
  const lastItemPad = contentPrograms[contentPrograms.length - 1]!.padMs;
  // Temporarily add it to the remaining time
  // remainingTime += lastItemPad;
  if (
    remainingTime + lastItemPad > 0 &&
    slot.hasFillerOfType(FillerTypes.tail)
  ) {
    const filler = retrySimple(
      () =>
        slot.getFillerOfType(FillerTypes.tail, {
          slotDuration: remainingTime + lastItemPad,
          timeCursor: -1,
        }),
      3,
    );

    if (filler) {
      // Play the tail filler right after
      contentPrograms[contentPrograms.length - 1]!.padMs = 0;
      remainingTime = remainingTime + lastItemPad - filler.duration;
      contentPrograms[contentPrograms.length - 1]!.filler.tail = filler;
    }
  } else {
    // Remove the extra pad if necessary
    remainingTime -= lastItemPad;
  }

  return remainingTime;
}

export function maybeAddPrePostFiller(
  slot: SlotImpl<BaseSlot>,
  program: PaddedProgram,
  remainingTime: number,
): number {
  remainingTime = maybeAddFillerOfType(
    FillerTypes.pre,
    remainingTime,
    slot,
    program,
  );
  return maybeAddFillerOfType(FillerTypes.post, remainingTime, slot, program);
}

function maybeAddFillerOfType(
  fillerType: 'pre' | 'post',
  remainingTime: number,
  slot: SlotImpl<BaseSlot>,
  program: PaddedProgram,
): number {
  if (!slot.hasFillerOfType(fillerType)) {
    // return { nextPrograms: contentPrograms, nextRemainingTime: remainingTime };
    return remainingTime;
  }

  const totalTime = remainingTime + Math.max(program.padMs, 0);
  if (totalTime <= 0) {
    return remainingTime;
  }

  if (slot.hasFillerOfType(fillerType)) {
    const filler = retrySimple(
      () =>
        slot.getFillerOfType(fillerType, {
          slotDuration: totalTime,
          timeCursor: -1,
        }),
      3,
    );

    if (filler) {
      // 1. how much did we eat into this program's padding?
      const leftoverPad = program.padMs - filler.duration;
      const newPad = Math.max(0, leftoverPad);
      // 2. how much did we eat into the total remaining time
      //    of the slot?
      if (leftoverPad < 0) {
        // This is negative so we add it.
        remainingTime += leftoverPad;
      }
      program.padMs = newPad; //fillerType === 'pre' ? leftover : 0;
      program.filler[fillerType] = filler;
    }
  }

  return remainingTime;
}
export class PaddedProgram {
  constructor(
    public program: CondensedChannelProgram,
    public padMs: number,
    public filler: Partial<Record<SlotFillerTypes, CondensedChannelProgram>>,
  ) {}

  get totalDuration() {
    const programDur = this.program.duration;
    const fillerDur = sumBy(values(this.filler), (f) => f.duration);
    return programDur + fillerDur + this.padMs;
  }
}

export function createIndexByIdMap(
  programs: SlotSchedulerProgram[],
  customShowId: string,
) {
  return reduce(
    programs,
    (acc, program) => {
      const cs = program.parentCustomShows.find(
        (cs) => cs.customShowId === customShowId,
      );
      if (!cs) {
        return acc;
      }
      acc[program.uuid] = cs.index;
      return acc;
    },
    {} as Record<string, number>,
  );
}

export function applyMidRollBreaks(
  paddedProgram: PaddedProgram,
  slot: SlotImpl<BaseSlot>,
  midRollConfig: MidRollConfig | undefined,
  random: Random,
): PaddedProgram[] {
  if (!midRollConfig || slot.getMidFillerListIds().length === 0) {
    return [paddedProgram];
  }

  const program = paddedProgram.program;
  if (!isContentProgram(program)) return [paddedProgram];

  if (midRollConfig.programTypes) {
    const programType = (
      program as CondensedContentProgram & { subtype?: string }
    ).subtype;
    if (
      programType &&
      !midRollConfig.programTypes.includes(programType as never)
    ) {
      return [paddedProgram];
    }
  }

  const programDurationMs = program.duration;
  const breakPoints = resolveBreakPoints(programDurationMs, midRollConfig);
  if (!breakPoints) return [paddedProgram];

  if (midRollConfig.strategy === 'lazy') {
    return buildLazyBreaks(
      paddedProgram,
      breakPoints,
      midRollConfig,
      slot,
      random,
    );
  }
  return buildEagerBreaks(
    paddedProgram,
    breakPoints,
    midRollConfig,
    slot,
    random,
  );
}

function buildEagerBreaks(
  paddedProgram: PaddedProgram,
  breakPoints: { offsetMs: number }[],
  config: MidRollConfig,
  slot: SlotImpl<BaseSlot>,
  random: Random,
): PaddedProgram[] {
  const program = paddedProgram.program as CondensedContentProgram;
  const baseOffset = program.startOffsetMs ?? 0;
  const result: PaddedProgram[] = [];
  let segmentStart = 0;

  for (const bp of breakPoints) {
    const segmentDuration = bp.offsetMs - segmentStart;
    result.push(
      new PaddedProgram(
        {
          ...program,
          duration: segmentDuration,
          startOffsetMs: baseOffset + segmentStart,
        },
        0,
        {},
      ),
    );

    const breakDuration = resolveBreakDuration(config, random);
    const fillers = fillDurationWithFiller(slot, breakDuration);

    for (const filler of fillers.fillers) {
      result.push(new PaddedProgram(filler, 0, {}));
    }

    const remainder = breakDuration - fillers.totalDuration;
    if (remainder > 0) {
      const flex: FlexProgram = {
        type: 'flex',
        duration: remainder,
      };
      result.push(new PaddedProgram(flex, 0, {}));
    }

    segmentStart = bp.offsetMs;
  }

  const lastSegmentDuration = program.duration - segmentStart;
  const lastSegment = new PaddedProgram(
    {
      ...program,
      duration: lastSegmentDuration,
      startOffsetMs: baseOffset + segmentStart,
    },
    paddedProgram.padMs,
    { ...paddedProgram.filler },
  );
  result.push(lastSegment);

  return result;
}

function buildLazyBreaks(
  paddedProgram: PaddedProgram,
  breakPoints: { offsetMs: number }[],
  config: MidRollConfig,
  slot: SlotImpl<BaseSlot>,
  random: Random,
): PaddedProgram[] {
  const program = paddedProgram.program as CondensedContentProgram;
  const baseOffset = program.startOffsetMs ?? 0;
  const midFillerListIds = slot.getMidFillerListIds();
  const result: PaddedProgram[] = [];
  let segmentStart = 0;

  for (const bp of breakPoints) {
    const segmentDuration = bp.offsetMs - segmentStart;
    result.push(
      new PaddedProgram(
        {
          ...program,
          duration: segmentDuration,
          startOffsetMs: baseOffset + segmentStart,
        },
        0,
        {},
      ),
    );

    const breakDuration = resolveBreakDuration(config, random);
    const fillerConfig: OfflineFillerConfig = {
      fillerListIds: midFillerListIds.length > 0 ? midFillerListIds : undefined,
      origin: 'midroll',
    };
    const flex: FlexProgram = {
      type: 'flex',
      duration: breakDuration,
      fillerConfig,
    };
    result.push(new PaddedProgram(flex, 0, {}));

    segmentStart = bp.offsetMs;
  }

  const lastSegmentDuration = program.duration - segmentStart;
  const lastSegment = new PaddedProgram(
    {
      ...program,
      duration: lastSegmentDuration,
      startOffsetMs: baseOffset + segmentStart,
    },
    paddedProgram.padMs,
    { ...paddedProgram.filler },
  );
  result.push(lastSegment);

  return result;
}

function fillDurationWithFiller(
  slot: SlotImpl<BaseSlot>,
  targetDurationMs: number,
  maxAttempts: number = 10,
): { fillers: FillerProgram[]; totalDuration: number } {
  const fillers: FillerProgram[] = [];
  let totalDuration = 0;
  let attempts = 0;

  while (totalDuration < targetDurationMs && attempts < maxAttempts) {
    const remaining = targetDurationMs - totalDuration;
    const filler = slot.getFillerOfType('mid', {
      slotDuration: remaining,
      timeCursor: -1,
    });

    if (!filler) break;

    if (totalDuration + filler.duration <= targetDurationMs) {
      fillers.push({ ...filler, fillerType: 'mid' });
      totalDuration += filler.duration;
    }
    attempts++;
  }

  return { fillers, totalDuration };
}
