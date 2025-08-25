import type {
  CustomShowProgramOption,
  FillerProgramOption,
  SlotId,
} from '@/helpers/slotSchedulerUtil';
import { getSlotIdForProgram } from '@/helpers/slotSchedulerUtil';
import { isNonEmptyString } from '@/helpers/util';
import { useChannelEditorLazy } from '@/store/selectors';
import type {
  UICondensedChannelProgram,
  UICondensedContentProgram,
  UICondensedCustomProgram,
} from '@/types';
import { seq } from '@tunarr/shared/util';
import { forEach, uniqBy } from 'lodash-es';
import { useMemo } from 'react';
import { P, match } from 'ts-pattern';
import useStore from '../../store/index.ts';
import { useSlotProgramOptions } from '../programming_controls/useSlotProgramOptions.ts';

export const useScheduledSlotProgramDetails = (slotIds: SlotId[]) => {
  const {
    channelEditor: { originalProgramList, programList },
  } = useChannelEditorLazy();
  const { dropdownOpts: programOptions } = useSlotProgramOptions();
  const globalProgramLookup = useStore((s) => s.programLookup);

  return useMemo(() => {
    const programsBySlot: Map<SlotId, UICondensedChannelProgram[]> = new Map();

    // Add the original program list to the end of the list to ensure
    // saved state overrides anything that is in the unsaved list
    forEach(programList.concat(originalProgramList), (program) => {
      if (program.type === 'flex') {
        return;
      }

      const slotId = getSlotIdForProgram(program, globalProgramLookup);
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
      // Special case for now
      const [, slotIdentifier] = scheduledSlotId.split('.', 2);
      if (scheduledSlotId.startsWith('filler')) {
        details[scheduledSlotId] = {
          programCount:
            programOptions.find(
              (opt): opt is FillerProgramOption =>
                opt.type === 'filler' && opt.fillerListId === slotIdentifier,
            )?.programCount ?? 0,
          programDurations: [],
        };
      }

      if (details[scheduledSlotId]) {
        continue;
      }

      const programs = programsBySlot.get(scheduledSlotId)!;
      const programCount = match(scheduledSlotId)
        .with(P.string.startsWith('custom'), (cs) => {
          const [, slotIdentifier] = cs.split('.', 2);
          return (
            programOptions.find(
              (opt): opt is CustomShowProgramOption =>
                opt.type === 'custom-show' &&
                opt.customShowId === slotIdentifier,
            )?.programCount ?? 0
          );
        })
        .with(
          P.string.startsWith('show'),
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
  }, [
    globalProgramLookup,
    originalProgramList,
    programList,
    programOptions,
    slotIds,
  ]);
};

export type SlotProgrammingDetails = {
  programCount: number;
  programDurations: {
    id: string;
    duration: number;
  }[];
};
