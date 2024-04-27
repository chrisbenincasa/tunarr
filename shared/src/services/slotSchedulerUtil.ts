import {
  ChannelProgram,
  MultiExternalId,
  isContentProgram,
  isRedirectProgram,
} from '@tunarr/types';
import { RandomSlot, TimeSlot } from '@tunarr/types/api';
import {
  filter,
  first,
  forEach,
  isNull,
  isUndefined,
  map,
  reduce,
  some,
} from 'lodash-es';
import { createExternalIdFromMulti } from '../index.js';
import {
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
  [K in 'content' | 'redirect']: Record<
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
      if (isContentProgram(program)) {
        let id: string | null = null;
        // TODO handle music
        if (program.subtype === 'movie') {
          id = 'movie';
        } else if (program.subtype === 'episode') {
          id = `tv.${program.title}`;
        }

        if (!isNull(id)) {
          const existing = acc['content'][id] ?? [];
          acc['content'][id] = [...existing, program];
        }
      } else if (isRedirectProgram(program)) {
        const id = `redirect.${program.channel}`;
        const existing = acc['redirect'][id] ?? [];
        acc['redirect'][id] = [...existing, program];
      }

      return acc;
    },
    {
      content: {},
      redirect: {},
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
      let id: string | null = null,
        slotId: string | null = null;
      if (slot.programming.type === 'movie') {
        id = slotIteratorKey(slot)!;
        slotId = 'movie';
      } else if (slot.programming.type === 'show') {
        id = slotIteratorKey(slot)!;
        slotId = `tv.${slot.programming.showId}`;
      } else if (slot.programming.type === 'redirect') {
        id = slotIteratorKey(slot)!;
        slotId = `redirect.${slot.programming.channelId}`;
      }

      if (id && slotId && !acc[id]) {
        // Special-case
        if (slot.programming.type === 'redirect') {
          // Slot order is disregarded for redirect because we don't
          // know what will be playing anyway!
          const program = first(programBySlotType['redirect'][slotId] ?? []);
          if (program) {
            acc[id] = new StaticProgramIterator(program);
          }
        } else {
          const programs = programBySlotType['content'][slotId] ?? [];
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
