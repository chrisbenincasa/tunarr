import { SlotId, getSlotIdForProgram } from '@/helpers/slotSchedulerUtil';
import { isNonEmptyString } from '@/helpers/util';
import { useChannelEditorLazy } from '@/store/selectors';
import {
  UICondensedChannelProgram,
  UICondensedContentProgram,
  UICondensedCustomProgram,
} from '@/types';
import { seq } from '@tunarr/shared/util';
import { forEach, uniqBy } from 'lodash-es';
import { useMemo } from 'react';
import { P, match } from 'ts-pattern';

export const useScheduledSlotProgramDetails = (slotIds: SlotId[]) => {
  const {
    channelEditor: { programLookup, originalProgramList },
  } = useChannelEditorLazy();

  return useMemo(() => {
    const programsBySlot: Map<SlotId, UICondensedChannelProgram[]> = new Map();

    forEach(originalProgramList, (program) => {
      if (program.type === 'flex') {
        return;
      }

      const slotId = getSlotIdForProgram(program, programLookup);
      if (!slotId) {
        return;
      }

      if (programsBySlot.has(slotId)) {
        programsBySlot.get(slotId)?.push(program);
      } else {
        programsBySlot.set(slotId, [program]);
      }
    });

    const details: Partial<Record<SlotId, SlotProgrammingDetails>> = {};

    for (const scheduledSlotId of slotIds) {
      if (!programsBySlot.has(scheduledSlotId) || details[scheduledSlotId]) {
        continue;
      }
      const programs = programsBySlot.get(scheduledSlotId)!;
      const programCount = match(scheduledSlotId)
        .with(
          P.string.startsWith('show'),
          P.string.startsWith('custom'),
          P.string.startsWith('movie'),
          () =>
            uniqBy(
              programs as (
                | UICondensedContentProgram
                | UICondensedCustomProgram
              )[],
              (p) => p.id ?? '',
            ).length,
        )
        .otherwise(() => 0);
      const programDurations = match(scheduledSlotId)
        .with(
          P.string.startsWith('show'),
          P.string.startsWith('custom'),
          P.string.startsWith('movie'),
          () =>
            seq.collect(programs, (p) =>
              p.type === 'content' ||
              (p.type === 'custom' && isNonEmptyString(p.id))
                ? { id: p.id!, duration: p.duration }
                : null,
            ),
        )
        .otherwise(() => []);

      details[scheduledSlotId] = {
        programCount,
        programDurations,
      };
    }
    return details;
  }, [originalProgramList, programLookup, slotIds]);
};

export type SlotProgrammingDetails = {
  programCount: number;
  programDurations: {
    id: string;
    duration: number;
  }[];
};
