import { createExternalIdFromMulti } from '@tunarr/shared';
import constants from '@tunarr/shared/constants';
import { isNonEmptyString } from '@tunarr/shared/util';
import {
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
} from '@tunarr/types/api';
import type {
  CondensedCustomProgram,
  CondensedFillerProgram,
} from '@tunarr/types/schemas';
import type { Duration } from 'dayjs/plugin/duration.js';
import {
  filter,
  first,
  forEach,
  isEmpty,
  isNull,
  last,
  map,
  reduce,
  reject,
  some,
  sortBy,
  uniqBy,
} from 'lodash-es';
import type { Random } from 'random-js';
import type { NonEmptyArray } from 'ts-essentials';
import { match, P } from 'ts-pattern';
import { retrySimple } from '../../util/index.ts';
import {
  FillerProgramIterator,
  FillerProgramIterator as WeightedFillerProgramIterator,
} from './FillerProgramIterator.ts';
import { FlexProgramIterator } from './FlexProgramIterator.ts';
import { ProgramChunkedShuffle } from './ProgramChunkedShuffle.ts';
import type { ProgramIterator } from './ProgramIterator.js';
import {
  fillerSlotIteratorKey,
  getProgramOrderer,
  slotIteratorKey,
} from './ProgramIterator.js';
import { ProgramOrdereredIterator } from './ProgramOrdereredIterator.ts';
import { ProgramShuffler } from './ProgramShuffler.ts';
import type { PaddedProgram } from './RandomSlotsService.ts';
import type { SlotImpl } from './SlotImpl.ts';
import { StaticProgramIterator } from './StaticProgramIterator.ts';

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
              new ProgramShuffler(
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
          .with({ type: 'custom-show' }, () => {
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
            return new ProgramShuffler(programs, random);
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
    const fakeSlot = {
      type: 'filler',
      fillerListId: fillerDef.fillerListId,
      order: 'shuffle_prefer_short',
      decayFactor: 0.5,
      durationWeighting: 'linear',
      recoveryFactor: 0.05,
    } satisfies FillerProgrammingSlot;

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
    iteratorsFromSlots[iteratorKey] = new WeightedFillerProgramIterator(
      programs as NonEmptyArray<FillerProgram>,
      fakeSlot,
      random,
    );
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
): Record<string, FillerProgramIterator> {
  if (!slotMayHaveFiller(slot)) {
    return {};
  }
  if (!slot.filler) {
    return {};
  }

  const out: Record<string, FillerProgramIterator> = {};
  for (const filler of slot.filler) {
    const it =
      map[fillerSlotIteratorKey(filler.fillerListId, 'shuffle_prefer_short')];
    if (it && it instanceof FillerProgramIterator) {
      out[filler.fillerListId] = it;
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
      return new ProgramShuffler(uniquePrograms, random);
      break;
    case 'ordered_shuffle':
      return new ProgramChunkedShuffle(
        uniquePrograms,
        getProgramOrderer('next'),
        slot.direction === 'asc',
      );
  }
}

export type SlotIteratorKey =
  | `movie_${SlotOrder}`
  | `tv_${string}_${SlotOrder}`
  | `redirect_${string}_${SlotOrder}`
  | `custom-show_${string}_${SlotOrder}`
  | `filler_${string}_${SlotOrder}`
  | 'flex';

export type SlotOrder = BaseSlot['order'];

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

export function createPaddedProgram(program: ChannelProgram, padMs: number) {
  const rem = program.duration % padMs;
  const padAmount = padMs - rem;
  const shouldPad = rem > constants.SLACK && padAmount > constants.SLACK;
  return {
    program,
    padMs: shouldPad ? padAmount : 0,
    totalDuration: program.duration + (shouldPad ? padAmount : 0),
  };
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
  last(relevantPrograms)!.padMs += mod;
  last(relevantPrograms)!.totalDuration += mod;

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
    relevantPrograms[sortedPads[i].index].padMs += extraPadding;
    relevantPrograms[sortedPads[i].index].totalDuration += extraPadding;
  });
}

export function addFillerToFixedSlot(
  remainingTime: number,
  slot: SlotImpl<BaseSlot>,
  contentPrograms: NonEmptyArray<PaddedProgram>,
) {
  if (remainingTime <= 0) {
    return { programs: contentPrograms, remainingTime };
  }

  const newPaddedPrograms: NonEmptyArray<PaddedProgram> = [...contentPrograms];
  remainingTime = maybeAddFillerOfType(
    'pre',
    remainingTime,
    slot,
    contentPrograms,
    newPaddedPrograms,
  );
  remainingTime = maybeAddFillerOfType(
    'post',
    remainingTime,
    slot,
    contentPrograms,
    newPaddedPrograms,
  );

  if (remainingTime > 0 && slot.hasFillerOfType('head')) {
    const filler = retrySimple(
      () =>
        slot.getFillerOfType('head', {
          slotDuration: remainingTime,
          timeCursor: -1,
        }),
      3,
    );

    if (filler) {
      remainingTime -= filler.duration;
      newPaddedPrograms.unshift({
        padMs: 0,
        program: filler,
        totalDuration: filler.duration,
      });
    }
  }

  if (remainingTime > 0 && slot.hasFillerOfType('tail')) {
    const filler = retrySimple(
      () =>
        slot.getFillerOfType('tail', {
          slotDuration: remainingTime,
          timeCursor: -1,
        }),
      3,
    );

    if (filler) {
      remainingTime -= filler.duration;
      newPaddedPrograms.push({
        padMs: 0,
        program: filler,
        totalDuration: filler.duration,
      });
    }
  }

  return { programs: newPaddedPrograms, remainingTime };
}

export function maybeAddFillerOfType(
  fillerType: 'pre' | 'post',
  remainingTime: number,
  slot: SlotImpl<BaseSlot>,
  contentPrograms: NonEmptyArray<PaddedProgram>,
  workingPrograms: NonEmptyArray<PaddedProgram>,
): number {
  if (!slot.hasFillerOfType(fillerType)) {
    return remainingTime;
  }

  for (let i = 0; i < contentPrograms.length; i++) {
    if (remainingTime <= 0) {
      break;
    }

    if (slot.hasFillerOfType(fillerType)) {
      const filler = retrySimple(
        () =>
          slot.getFillerOfType(fillerType, {
            slotDuration: remainingTime,
            timeCursor: -1,
          }),
        3,
      );

      if (filler) {
        remainingTime -= filler.duration;

        workingPrograms.splice(fillerType === 'pre' ? i : i + 1, 0, {
          padMs: 0,
          program: filler,
          totalDuration: filler.duration,
        });
      }
    }
  }

  return remainingTime;
}
