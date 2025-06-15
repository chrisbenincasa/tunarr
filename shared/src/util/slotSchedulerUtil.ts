import type {
  ChannelProgram,
  CustomProgram,
  MultiExternalId,
} from '@tunarr/types';
import type { BaseSlot } from '@tunarr/types/api';
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
import { createExternalIdFromMulti } from '../index.js';
import type { ProgramIterator } from './ProgramIterator.js';
import {
  ProgramChunkedShuffle,
  ProgramOrdereredIterator,
  ProgramShuffler,
  StaticProgramIterator,
  getProgramOrderer,
  slotIteratorKey,
} from './ProgramIterator.js';

type ProgramMapping = {
  [K in 'content' | 'redirect' | 'custom']: Record<
    string,
    Extract<ChannelProgram, { type: K }>[]
  >;
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
          // TODO handle music
          if (program.subtype === 'movie') {
            id = 'movie';
          } else if (
            program.subtype === 'episode' &&
            !isEmpty(program.showId)
          ) {
            id = `tv.${program.showId}`;
          } else if (
            program.subtype === 'track' &&
            !isEmpty(program.artistId)
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
        case 'flex':
          break;
      }

      return acc;
    },
    {
      content: {},
      redirect: {},
      custom: {},
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
) {
  return reduce(
    slots,
    (acc, slot) => {
      const id = slotIteratorKey(slot);
      let slotId: string | null = null;

      switch (slot.programming.type) {
        case 'movie':
          slotId = 'movie';
          break;
        case 'show':
          slotId = `tv.${slot.programming.showId}`;
          break;
        case 'redirect':
          slotId = `redirect.${slot.programming.channelId}`;
          break;
        case 'custom-show':
          slotId = `custom-show.${slot.programming.customShowId}`;
          break;
        case 'flex':
          break;
      }

      if (id && slotId && !acc[id]) {
        // Special-case
        if (slot.programming.type === 'redirect') {
          // Slot order is disregarded for redirect because we don't
          // know what will be playing anyway!
          const program = first(programBySlotType.redirect[slotId] ?? []);
          if (program) {
            acc[id] = new StaticProgramIterator(program);
          } else {
            acc[id] = new StaticProgramIterator({
              type: 'redirect',
              channel: slot.programming.channelId,
              channelName: slot.programming.channelName ?? '',
              channelNumber: -1,
              duration: 1,
              persisted: false,
            });
          }
        } else if (slot.programming.type === 'custom-show') {
          switch (slot.order) {
            case 'next':
              acc[id] = new ProgramOrdereredIterator<CustomProgram>(
                programBySlotType.custom[slotId] ?? [],
                (program) => program.index,
              );
              break;
            case 'shuffle':
              acc[id] = new ProgramShuffler(
                programBySlotType.custom[slotId] ?? [],
              );
              break;
            case 'ordered_shuffle':
              acc[id] = new ProgramChunkedShuffle(
                programBySlotType.custom[slotId] ?? [],
                (program) => program.index,
              );
          }
        } else {
          const programs = programBySlotType.content[slotId] ?? [];
          // Remove any duplicates.
          // We don't need to go through and remove flex since
          // they will just be ignored during schedule generation
          const seenDBIds = new Set<string>();
          const seenIds = new Set<string>();
          const uniquePrograms = filter(programs, (p) => {
            if (p.persisted && p.id) {
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
              acc[id] = new ProgramOrdereredIterator(
                uniquePrograms,
                getProgramOrderer(slot.order),
                slot.direction === 'asc',
              );
              break;
            case 'shuffle':
              acc[id] = new ProgramShuffler(uniquePrograms);
              break;
            case 'ordered_shuffle':
              acc[id] = new ProgramChunkedShuffle(
                uniquePrograms,
                getProgramOrderer('next'),
                slot.direction === 'asc',
              );
              break;
          }
        }
      }

      return acc;
    },
    {} as Record<string, ProgramIterator>,
  );
}
