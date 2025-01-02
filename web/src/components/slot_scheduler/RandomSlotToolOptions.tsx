import { useConsolidatePrograms } from '@/hooks/programming_controls/useConcolidatePrograms';
import { useSlotProgramOptions } from '@/hooks/programming_controls/useSlotProgramOptions.ts';
import { useRandomSlotFormContext } from '@/hooks/useRandomSlotFormContext.ts';
import { useChannelEditorLazy } from '@/store/selectors.ts';
import { AccessTime, Sort } from '@mui/icons-material';
import { MenuItem } from '@mui/material';
import { seq } from '@tunarr/shared/util';
import { RandomSlot } from '@tunarr/types/api';
import dayjs from 'dayjs';
import { groupBy, isEmpty, maxBy } from 'lodash-es';
import { useState } from 'react';
import { ElevatedTooltip } from '../base/ElevatedTooltip.tsx';

type Props = {
  onClose: () => void;
};

type OpenModal = 'replicate' | 'rerun' | 'weights' | 'balance';

export function RandomSlotToolOptions({ onClose }: Props) {
  const { slotArray } = useRandomSlotFormContext();
  const programOptions = useSlotProgramOptions();
  const [openModal, setOpenModal] = useState<OpenModal | null>(null);
  const consolidatePrograms = useConsolidatePrograms();

  const { materializeNewProgramList } = useChannelEditorLazy();

  const handleClose = () => {
    setOpenModal(null);
    onClose();
  };

  const handleAutoSlots = () => {
    const programs = materializeNewProgramList();
    const programsByShowId = groupBy(
      seq.collect(programs, (p) => {
        if (p.type === 'content' && p.subtype === 'episode') {
          return p;
        }
        return;
      }),
      (episode) => episode.showId,
    );

    const slots = seq.collect(programOptions, (option) => {
      if (option.type === 'show' && !isEmpty(programsByShowId[option.showId])) {
        const maxDuration = maxBy(
          programsByShowId[option.showId],
          (program) => program.duration,
        )!.duration;
        const duration =
          Math.ceil(dayjs.duration(maxDuration).asMinutes() / 5) * 5;
        const slot = {
          durationMs: duration * 60 * 1000,
          order: 'next',
          programming: {
            showId: option.showId,
            type: 'show',
          },
          weight: 100,
          cooldownMs: 0,
        } satisfies RandomSlot;
        return slot;
      }
    });
    slotArray.replace(slots);
    handleClose();
  };
  return (
    <>
      <MenuItem divider disabled>
        Organize
      </MenuItem>
      <ElevatedTooltip
        title="This allows to schedule specific shows to run at specific time slots of the day or a week. It's recommended you first populate the channel with the episodes from the shows you want to play and/or other content like movies and redirects."
        placement="right"
        elevation={10}
      >
        <MenuItem onClick={() => handleAutoSlots()}>
          <AccessTime /> Auto Slots...
        </MenuItem>
      </ElevatedTooltip>
      <MenuItem onClick={() => handleAutoSlots()}>
        <Sort /> Sort Slots...
      </MenuItem>
    </>
  );
}
