import type {
  ChannelProgram,
  CondensedChannelProgram,
  ContentProgram,
  CustomProgram,
  FillerProgram,
  MultiExternalId,
} from '@tunarr/types';
import type {
  BaseMovieProgrammingSlot,
  BaseShowProgrammingSlot,
  BaseSlot,
} from '@tunarr/types/api';
import {
  filter,
  first,
  forEach,
  isEmpty,
  isNull,
  map,
  reduce,
  some,
} from 'lodash-es';
import type { Random } from 'random-js';
import type { NonEmptyArray } from 'ts-essentials';
import { match, P } from 'ts-pattern';
import { createExternalIdFromMulti } from '../index.js';
import type { ProgramIterator } from './ProgramIterator.js';
import {
  FlexProgramIterator,
  getProgramOrderer,
  ProgramChunkedShuffle,
  ProgramOrdereredIterator,
  ProgramShuffler,
  slotIteratorKey,
  StaticProgramIterator,
  FillerProgramIterator as WeightedFillerProgramIterator,
} from './ProgramIterator.js';
import { isNonEmptyString } from './index.js';

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
  return reduce(
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
