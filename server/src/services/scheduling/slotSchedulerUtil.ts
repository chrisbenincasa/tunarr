import { createExternalIdFromMulti } from '@tunarr/shared';
import constants from '@tunarr/shared/constants';
import { isNonEmptyString } from '@tunarr/shared/util';
import {
  isContentProgram,
  isCustomProgram,
  isFillerProgram,
  isFlexProgram,
  type ChannelProgram,
  type CondensedChannelProgram,
  type CondensedContentProgram,
  type ContentProgram,
  type CustomProgram,
  type FillerProgram,
  type FlexProgram,
  type MultiExternalId,
} from '@tunarr/types';
import type {
  BaseCustomShowProgrammingSlot,
  BaseMovieProgrammingSlot,
  BaseShowProgrammingSlot,
  BaseSlot,
  FillerProgrammingSlot,
  SlotFillerTypes,
} from '@tunarr/types/api';
import {
  FillerTypes,
  type CondensedCustomProgram,
  type CondensedFillerProgram,
} from '@tunarr/types/schemas';
import type { Duration } from 'dayjs/plugin/duration.js';
import {
  filter,
  first,
  forEach,
  groupBy,
  isEmpty,
  isNull,
  last,
  map,
  reduce,
  reject,
  some,
  sortBy,
  sumBy,
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
import { groupByTyped, retrySimple } from '../../util/index.ts';
import { FlexProgramIterator } from './FlexProgramIterator.ts';
import { ProgramChunkedShuffle } from './ProgramChunkedShuffle.ts';
import type { ProgramIterator } from './ProgramIterator.js';
import {
  fillerSlotIteratorKey,
  getProgramOrderer,
  slotIteratorKey,
} from './ProgramIterator.js';
import { ProgramOrdereredIterator } from './ProgramOrdereredIterator.ts';
import { ShuffleProgramIterator } from './ShuffleProgramIterator.ts';
import type { SlotImpl } from './SlotImpl.ts';
import { StaticProgramIterator } from './StaticProgramIterator.ts';
import { WeightedFillerProgramIterator } from './WeightedFillerProgramIterator.ts';

type ProgramMapping = {
  [K in 'content' | 'redirect' | 'custom' | 'filler']: Record<
    string,
    Extract<ChannelProgram, { type: K }>[]
  >;
};

export type SlotId =
  | 'movie'
  | 'music_video'
  | 'other_video'
  | `show.${string}`
  | `custom-show.${string}`
  | `filler.${string}`
  | `redirect.${string}`
  | `flex`;

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

function deduplicateContentPrograms(programs: ContentProgram[]) {
  // Remove any duplicates.
  // We don't need to go through and remove flex since
  // they will just be ignored during schedule generation
  const seenDBIds = new Set<string>();
  const seenIds = new Set<string>();
  return filter(programs, (p) => {
    if (p.persisted && isNonEmptyString(p.id)) {
      if (!seenDBIds.has(p.id)) {
        seenDBIds.add(p.id);
        forEach(p.externalIds, (eid) => {
          if (eid.type === 'multi') {
            seenIds.add(createExternalIdFromMulti(eid));
          }
        });
        return true;
      } else {
        return false;
      }
    }

    const externalIds = filter(
      p.externalIds,
      (eid): eid is MultiExternalId => eid.type === 'multi',
    );
    const eids = map(externalIds, createExternalIdFromMulti);
    if (some(eids, (eid) => seenIds.has(eid))) {
      return false;
    }

    forEach(eids, (eid) => seenIds.add(eid));
    return true;
  });
}

function deduplicateCustomPrograms(programs: CustomProgram[]) {
  const byCustomShowId = groupBy(programs, (program) => program.customShowId);
  const unique: CustomProgram[] = [];
  for (const [_, programs] of Object.entries(byCustomShowId)) {
    unique.push(...uniqBy(programs, (p) => p.id));
  }
  return unique;
}

function deduplicateFillerPrograms(programs: FillerProgram[]) {
  const byFillerListId = groupBy(programs, (program) => program.fillerListId);
  const unique: FillerProgram[] = [];
  for (const [_, programs] of Object.entries(byFillerListId)) {
    unique.push(...uniqBy(programs, (p) => p.id));
  }
  return unique;
}

export function deduplicatePrograms(programs: ChannelProgram[]) {
  const programsByType = groupByTyped(programs, (program) => program.type);
  const uniquePrograms = [
    ...(programsByType['flex'] ?? []),
    ...(programsByType['redirect'] ?? []),
  ];
  uniquePrograms.push(
    ...deduplicateContentPrograms(
      (programsByType['content'] ?? []).filter(isContentProgram),
    ),
  );
  uniquePrograms.push(
    ...deduplicateCustomPrograms(
      (programsByType['custom'] ?? []).filter(isCustomProgram),
    ),
  );
  uniquePrograms.push(
    ...deduplicateFillerPrograms(
      (programsByType['filler'] ?? []).filter(isFillerProgram),
    ),
  );
  return uniquePrograms;
}

/**
 * Creates a mapping of 'schedulable' content
 * @param programs
 * @returns
 */
export function createProgramMap(programs: ChannelProgram[]): ProgramMapping {
  return reduce(
    programs,
    (acc, program) => {
      switch (program.type) {
        case 'content': {
          let id: string | null = null;
          if (
            program.subtype === 'movie' ||
            program.subtype === 'music_video' ||
            program.subtype === 'other_video'
          ) {
            id = 'movie';
          } else if (
            program.subtype === 'episode' &&
            isNonEmptyString(program.showId)
          ) {
            id = `tv.${program.showId}`;
          } else if (
            program.subtype === 'track' &&
            isNonEmptyString(program.artistId)
          ) {
            id = `artist.${program.artistId}`;
          }

          if (!isNull(id)) {
            const existing = acc.content[id] ?? [];
            acc.content[id] = [...existing, program];
          }
          break;
        }
        case 'redirect': {
          const id = `redirect.${program.channel}`;
          const existing = acc.redirect[id] ?? [];
          acc.redirect[id] = [...existing, program];
          break;
        }
        case 'custom': {
          const id = `custom-show.${program.customShowId}`;
          const existing = acc.custom[id] ?? [];
          acc.custom[id] = [...existing, program];
          break;
        }
        case 'filler': {
          const id = `filler.${program.fillerListId}`;
          const existing = acc.filler[id] ?? [];
          acc.filler[id] = [...existing, program];
          break;
        }
        case 'flex':
          break;
      }

      return acc;
    },
    {
      content: {},
      redirect: {},
      custom: {},
      filler: {},
    } as ProgramMapping,
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
      let slotId: string;

      switch (slot.type) {
        case 'movie':
          slotId = 'movie';
          break;
        case 'show':
          slotId = `tv.${slot.showId}`;
          break;
        case 'redirect':
          slotId = `redirect.${slot.channelId}`;
          break;
        case 'custom-show':
          slotId = `custom-show.${slot.customShowId}`;
          break;
        case 'filler':
          slotId = `filler.${slot.fillerListId}`;
          break;
        case 'flex':
          slotId = 'flex';
          break;
      }

      if (id && slotId && !acc[id]) {
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
            const program = first(programBySlotType.redirect[slotId] ?? []);
            if (program) {
              return new StaticProgramIterator(program);
            } else {
              return new StaticProgramIterator({
                type: 'redirect',
                channel: slot.channelId,
                channelName: slot.channelName ?? '',
                channelNumber: -1,
                duration: 1,
                persisted: false,
              });
            }
          })
          .with(
            { type: 'custom-show', order: 'next' },
            () =>
              new ProgramOrdereredIterator<CustomProgram>(
                programBySlotType.custom[slotId] ?? [],
                (program) => program.index,
              ),
          )
          .with(
            { type: 'custom-show', order: 'shuffle' },
            () =>
              new ShuffleProgramIterator(
                programBySlotType.custom[slotId] ?? [],
                random,
              ),
          )
          .with(
            { type: 'custom-show', order: 'ordered_shuffle' },
            () =>
              new ProgramChunkedShuffle(
                programBySlotType.custom[slotId] ?? [],
                (program) => program.index,
              ),
          )
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
              const programs = programBySlotType.filler[slotId] ?? [];
              if (isEmpty(programs)) {
                throw new Error('Cannot schedule an empty filler list slot.');
              }
              return new WeightedFillerProgramIterator(
                programs as NonEmptyArray<FillerProgram>,
                slot,
                random,
              );
            },
          )
          .with({ type: 'filler' }, () => {
            const programs = programBySlotType.filler[slotId] ?? [];
            if (isEmpty(programs)) {
              throw new Error('Cannot schedule an empty filler list slot.');
            }
            return new ShuffleProgramIterator(programs, random);
          })
          .with({ type: P.union('movie', 'show') }, (slot) =>
            getContentProgramIterator(programBySlotType, slotId, slot, random),
          )
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
    const slotId = `filler.${fillerDef.fillerListId}`;

    // Already made this.
    if (iteratorsFromSlots[iteratorKey]) {
      continue;
    }
    const programs = programBySlotType.filler[slotId] ?? [];
    if (isEmpty(programs)) {
      throw new Error('Cannot schedule an empty filler list slot.');
    }

    const iterator =
      fakeSlot.order === 'uniform'
        ? new ShuffleProgramIterator(programs, random)
        : new WeightedFillerProgramIterator(
            programs as NonEmptyArray<FillerProgram>,
            fakeSlot,
            random,
          );

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
  contentSlotId: string,
  slot: BaseMovieProgrammingSlot | BaseShowProgrammingSlot,
  random: Random,
) {
  const programs = programBySlotType.content[contentSlotId] ?? [];
  // Remove any duplicates.
  // We don't need to go through and remove flex since
  // they will just be ignored during schedule generation
  const seenDBIds = new Set<string>();
  const seenIds = new Set<string>();
  const uniquePrograms = filter(programs, (p) => {
    if (p.persisted && isNonEmptyString(p.id)) {
      if (!seenDBIds.has(p.id)) {
        seenDBIds.add(p.id);
        forEach(p.externalIds, (eid) => {
          if (eid.type === 'multi') {
            seenIds.add(createExternalIdFromMulti(eid));
          }
        });
        return true;
      } else {
        return false;
      }
    }

    const externalIds = filter(
      p.externalIds,
      (eid): eid is MultiExternalId => eid.type === 'multi',
    );
    const eids = map(externalIds, createExternalIdFromMulti);
    if (some(eids, (eid) => seenIds.has(eid))) {
      return false;
    }

    forEach(eids, (eid) => seenIds.add(eid));
    return true;
  });

  switch (slot.order) {
    case 'next':
    case 'alphanumeric':
    case 'chronological':
      return new ProgramOrdereredIterator(
        uniquePrograms,
        getProgramOrderer(slot.order),
        slot.direction === 'asc',
      );
    case 'shuffle':
      return new ShuffleProgramIterator(uniquePrograms, random);
      break;
    case 'ordered_shuffle':
      return new ProgramChunkedShuffle(
        uniquePrograms,
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

export function condense(program: ChannelProgram): CondensedChannelProgram {
  switch (program.type) {
    case 'content':
      return {
        id: program.uniqueId, // TODO
        duration: program.duration,
        persisted: program.persisted,
        type: 'content',
      } satisfies CondensedContentProgram;
    case 'custom':
      return {
        customShowId: program.customShowId,
        duration: program.duration,
        id: program.id,
        index: program.index,
        persisted: program.persisted,
        type: 'custom',
        program: program.program
          ? (condense(program.program) as CondensedContentProgram)
          : undefined,
      } satisfies CondensedCustomProgram;
    case 'filler':
      return {
        fillerListId: program.fillerListId,
        duration: program.duration,
        id: program.id,
        persisted: program.persisted,
        type: 'filler',
        program: program.program
          ? (condense(program.program) as CondensedContentProgram)
          : undefined,
      } satisfies CondensedFillerProgram;
    case 'redirect':
    case 'flex':
      return program;
  }
}

export function createPaddedProgram(
  program: ChannelProgram,
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
  const lastProgram = relevantPrograms[relevantPrograms.length - 1];
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
    const program = relevantPrograms[sortedPads[i].index];
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
  const lastItemPad = contentPrograms[contentPrograms.length - 1].padMs;
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
      contentPrograms[contentPrograms.length - 1].padMs = 0;
      remainingTime = remainingTime + lastItemPad - filler.duration;
      contentPrograms[contentPrograms.length - 1].filler.tail = filler;
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

  for (let i = 0; i < contentPrograms.length; i++) {
    const program = contentPrograms[i];
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
    public program: ChannelProgram,
    public padMs: number,
    public filler: Partial<Record<SlotFillerTypes, ChannelProgram>>,
  ) {}

  get totalDuration() {
    const programDur = this.program.duration;
    const fillerDur = sumBy(values(this.filler), (f) => f.duration);
    return programDur + fillerDur + this.padMs;
  }
}
