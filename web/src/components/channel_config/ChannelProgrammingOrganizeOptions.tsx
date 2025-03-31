import { useConsolidatePrograms } from '@/hooks/programming_controls/useConcolidatePrograms';
import {
  Merge,
  ContentCopy as ReplicateIcon,
  Scale,
  Shuffle as ShuffleIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';
import { MenuItem } from '@mui/material';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { ElevatedTooltip } from '../base/ElevatedTooltip';
import AddReplicateModal from '../programming_controls/AddReplicateModal';
import AddRerunBlockModal from '../programming_controls/AddRerunBlockModal';
import AdjustWeightsModal from '../programming_controls/AdjustWeightsModal';
import { BalanceProgrammingModal } from '../programming_controls/BalanceProgrammingModal';

type Props = {
  onClose: () => void;
};

type OpenModal = 'replicate' | 'rerun' | 'weights' | 'balance';

export function ChannelProgrammingOrganizeOptions({ onClose }: Props) {
  const [openModal, setOpenModal] = useState<OpenModal | null>(null);
  const consolidatePrograms = useConsolidatePrograms();

  const handleClose = () => {
    setOpenModal(null);
    onClose();
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
        <MenuItem component={Link} to="time-slot-editor">
          <TimeIcon /> Time Slots...
        </MenuItem>
      </ElevatedTooltip>
      <ElevatedTooltip
        title="Schedule programming using slots assigned a start time and duration."
        placement="right"
        elevation={10}
      >
        <MenuItem component={Link} to="slot-editor">
          <ShuffleIcon /> Slots Editor...
        </MenuItem>
      </ElevatedTooltip>
      <ElevatedTooltip
        title="Schedule programming in blocks that are either count or duration based. Can be used to generate random schedules."
        placement="right"
        elevation={10}
      >
        <MenuItem
          onClick={() => {
            setOpenModal('balance');
          }}
        >
          <Scale /> Balance...
        </MenuItem>
      </ElevatedTooltip>
      <ElevatedTooltip
        title="Makes multiple copies of the schedule and plays them in sequence. Normally this isn't necessary, because Tunarr will always play the schedule back from the beginning when it finishes. But creating replicas is a useful intermediary step sometimes before applying other transformations. Note that because very large channels can be problematic, the number of replicas will be limited to avoid creating really large channels."
        placement="right"
        elevation={10}
      >
        <MenuItem
          onClick={() => {
            setOpenModal('replicate');
          }}
        >
          <ReplicateIcon /> Replicate...
        </MenuItem>
      </ElevatedTooltip>
      <ElevatedTooltip
        title="Consolidates contiguous match flex and redirect blocks into singular spans"
        placement="right"
        elevation={10}
      >
        <MenuItem
          onClick={() => {
            consolidatePrograms();
            handleClose();
          }}
        >
          <Merge /> Consolidate
        </MenuItem>
      </ElevatedTooltip>
      {/* <Tooltip
        title="Divides the programming in blocks of 6, 8 or 12 hours then repeats each of the blocks the specified number of times. For example, you can make a channel that plays exactly the same channels in the morning and in the afternoon. This button might be disabled if the channel is already too large."
        placement="right"
      >
        <MenuItem
          onClick={() => {
            // TODO: Fix issue with menu not closing
            // handleClose();
            setAddRerunBlocksModal(true);
          }}
        >
          <RerunBlocksIcon /> Create Rerun Blocks...
        </MenuItem>
      </Tooltip> */}
      <AddRerunBlockModal
        open={openModal === 'rerun'}
        onClose={() => handleClose()}
      />
      <AddReplicateModal
        open={openModal === 'replicate'}
        onClose={() => handleClose()}
      />
      <AdjustWeightsModal
        open={openModal === 'weights'}
        onClose={() => handleClose()}
      />
      <BalanceProgrammingModal
        open={openModal === 'balance'}
        onClose={() => handleClose()}
      />
    </>
  );
}
