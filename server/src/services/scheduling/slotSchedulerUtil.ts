import constants from '@tunarr/shared/constants';
import { isNonEmptyString } from '@tunarr/shared/util';
import {
  isFlexProgram,
  type CondensedChannelProgram,
  type ContentProgram,
  type FillerProgram,
  type FlexProgram,
} from '@tunarr/types';
import type {
  BaseCustomShowProgrammingSlot,
  BaseMovieProgrammingSlot,
  BaseShowProgrammingSlot,
  BaseSlot,
  FillerProgrammingSlot,
  SlotFillerTypes,
} from '@tunarr/types/api';
import { FillerTypes } from '@tunarr/types/schemas';
import type { Duration } from 'dayjs/plugin/duration.js';
import {
  forEach,
  isEmpty,
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
import type { ProgramWithRelationsOrm } from '../../db/schema/derivedTypes.ts';
import type { Nullable } from '../../types/util.ts';
import { isNonEmptyArray, retrySimple } from '../../util/index.ts';
import { FlexProgramIterator } from './FlexProgramIterator.ts';
import {
  ContentProgramChunkedShuffle,
  CustomProgramChunkedShuffle,
} from './ProgramChunkedShuffle.ts';
import type { ProgramIterator } from './ProgramIterator.js';
import {
  fillerSlotIteratorKey,
  getProgramOrderer,
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

export const getSlotIdForProgram = (
  program: CondensedChannelProgram,
  lookup: Record<string, ContentProgram>,
): SlotId | undefined => {
  switch (program.type) {
    case 'content': {
      if (isNonEmptyString(program.id)) {
        const materialized = lookup[program.id];
        if (materialized) {
          switch (materialized.subtype) {
            case 'movie':
            case 'music_video':
            case 'other_video':
              return materialized.subtype;
            case 'episode':
              return isNonEmptyString(materialized.showId)
                ? `show.${materialized.showId}`
                : undefined;
            case 'track':
              return;
          }
        }
      }
      return;
    }
    case 'filler':
      return `filler.${program.fillerListId}`;
    case 'custom':
      return `custom-show.${program.customShowId}`;
    case 'redirect':
      return `redirect.${program.channel}`;
    case 'flex':
      return 'flex';
  }
};

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

/**
 * Creates program iterators for a schedule's slots based on their
 * configuration.
 *
 * @param slots The schedule's slots
 * @param programBySlotType The result from {@link createProgramMap}
 * @returns A mapping of slot ID -> {@link ProgramIterator}
 */
export function createProgramIterators(
  slots: BaseSlot[],
  programBySlotType: ProgramMapping,
  random: Random,
): Record<SlotIteratorKey, ProgramIterator> {
  const iteratorsFromSlots = reduce(
    slots,
    (acc, slot) => {
      const id = slotIteratorKey(slot);

      if (id && !acc[id]) {
        acc[id] = match(slot)
          .with(
            { type: 'flex' },
            () =>
              new FlexProgramIterator({
                duration: -1,
                persisted: false,
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
              persisted: false,
            });
          })
          .with({ type: 'custom-show', order: 'next' }, (slot) => {
            const programs =
              programBySlotType.custom[customShowSlotId(slot.customShowId)] ??
              [];

            return new CustomProgramOrderedIterator(
              slot.customShowId,
              programs,
            );
          })
          .with(
            { type: 'custom-show', order: 'shuffle' },
            (slot) =>
              new CustomProgramShuffleIterator(
                slot.customShowId,
                programBySlotType.custom[customShowSlotId(slot.customShowId)] ??
                  [],
                random,
              ),
          )
          .with({ type: 'custom-show', order: 'ordered_shuffle' }, (slot) => {
            const programs =
              programBySlotType.custom[
                `custom-show.${slot.customShowId}` as const
              ] ?? [];
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
            return new ProgramShuffleIteratorImpl(
              programs,
              random,
              (program) => ({
                type: 'filler',
                duration: program.duration,
                fillerListId: slot.fillerListId,
                id: program.uuid,
                persisted: true,
              }),
            );
          })
          .with({ type: P.union('movie', 'show') }, (slot) => {
            const slotId = match(slot)
              .returnType<ContentSlotId>()
              .with({ type: 'movie' }, () => 'movie')
              .with({ type: 'show' }, (show) => `show.${show.showId}`)
              .exhaustive();
            return getContentProgramIterator(
              programBySlotType,
              slotId,
              slot,
              random,
            );
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

      return acc;
    },
    {} as Record<SlotIteratorKey, ProgramIterator>,
  );

  const slotFiller = uniqBy(
    slots.filter(slotMayHaveFiller).flatMap((slot) => slot.filler ?? []),
    ({ fillerListId }) => fillerListId,
  );

  for (const fillerDef of slotFiller) {
    const fakeSlot = match(fillerDef.fillerOrder)
      .returnType<FillerProgrammingSlot>()
      .with('uniform', () => ({
        type: 'filler',
        order: 'uniform',
        decayFactor: 0.5,
        recoveryFactor: 0.05,
        durationWeighting: 'linear',
        fillerListId: fillerDef.fillerListId,
      }))
      .with(P.union('shuffle_prefer_long', 'shuffle_prefer_short'), (order) => {
        return {
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

    // Already made this.
    if (iteratorsFromSlots[iteratorKey]) {
      continue;
    }
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

    iteratorsFromSlots[iteratorKey] = iterator;
  }
  return iteratorsFromSlots;
}

export function slotMayHaveFiller(
  slot: BaseSlot,
): slot is
  | BaseMovieProgrammingSlot
  | BaseShowProgrammingSlot
  | BaseCustomShowProgrammingSlot {
  return (
    slot.type === 'show' || slot.type === 'movie' || slot.type === 'custom-show'
  );
}

export function slotFillerIterators(
  slot: BaseSlot,
  map: Record<SlotIteratorKey, ProgramIterator>,
): Record<string, ProgramIterator<FillerProgram>> {
  if (!slotMayHaveFiller(slot)) {
    return {};
  }
  if (!slot.filler) {
    return {};
  }

  const out: Record<string, ProgramIterator<FillerProgram>> = {};
  for (const filler of slot.filler) {
    const it =
      map[fillerSlotIteratorKey(filler.fillerListId, filler.fillerOrder)];
    if (it) {
      out[filler.fillerListId] = it as ProgramIterator<FillerProgram>;
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
  const programs = uniqBy(
    programBySlotType.content[contentSlotId] ?? [],
    (p) => p.uuid,
  );

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
      persisted: false,
    };
    lineup[lineup.length - 1] = newItem;
    return durationMs;
  }

  const newItem: FlexProgram = {
    type: 'flex',
    persisted: false,
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

export function maybeAddFillerOfTypeOld(
  fillerType: 'pre' | 'post',
  remainingTime: number,
  slot: SlotImpl<BaseSlot>,
  contentPrograms: NonEmptyArray<PaddedProgram>,
): { nextPrograms: NonEmptyArray<PaddedProgram>; nextRemainingTime: number } {
  if (!slot.hasFillerOfType(fillerType)) {
    return { nextPrograms: contentPrograms, nextRemainingTime: remainingTime };
  }

  for (const program of contentPrograms) {
    const totalTime = remainingTime + Math.max(program.padMs, 0);
    if (totalTime <= 0) {
      break;
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
          remainingTime += leftoverPad;
        }
        program.padMs = newPad; //fillerType === 'pre' ? leftover : 0;
        program.filler[fillerType] = filler;
      }
    }
  }

  return { nextPrograms: contentPrograms, nextRemainingTime: remainingTime };
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
  customShowId,
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
