import { ChannelProgram, MultiExternalId } from '@tunarr/types';
import { RandomSlot, TimeSlot } from '@tunarr/types/api';
import {
  filter,
  first,
  forEach,
  isEmpty,
  isNull,
  isUndefined,
  map,
  reduce,
  some,
} from 'lodash-es';
import { createExternalIdFromMulti } from '../index.js';
import {
  CustomProgramOrderer,
  ProgramIterator,
  ProgramOrderer,
  ProgramShuffler,
  StaticProgramIterator,
  slotIteratorKey,
} from './ProgramIterator.js';

export type SlotLike = {
  order?: 'next' | 'shuffle';
  programming: (TimeSlot & RandomSlot)['programming'];
};

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
  slots: SlotLike[],
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
          }
        } else if (slot.programming.type === 'custom-show') {
          acc[id] =
            slot.order === 'next'
              ? new CustomProgramOrderer(programBySlotType.custom[slotId] ?? [])
              : new ProgramShuffler(programBySlotType.custom[slotId] ?? []);
        } else {
          const programs = programBySlotType.content[slotId] ?? [];
          // Remove any duplicates.
          // We don't need to go through and remove flex since
          // they will just be ignored during schedule generation
          const seenDBIds = new Set<string>();
          const seenIds = new Set<string>();
          const uniquePrograms = filter(programs, (p) => {
            if (p.persisted && !isUndefined(p.id) && !seenDBIds.has(p.id)) {
              seenDBIds.add(p.id);
              forEach(p.externalIds, (eid) => {
                if (eid.type === 'multi') {
                  seenIds.add(createExternalIdFromMulti(eid));
                }
              });
              return true;
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
          acc[id] =
            slot.order === 'next'
              ? new ProgramOrderer(uniquePrograms)
              : new ProgramShuffler(uniquePrograms);
        }
      }

      return acc;
    },
    {} as Record<string, ProgramIterator>,
  );
}
