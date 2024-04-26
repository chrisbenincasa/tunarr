import {
  ContentCopy as ReplicateIcon,
  Shuffle as ShuffleIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';
import { MenuItem, Tooltip } from '@mui/material';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import AddReplicateModal from '../programming_controls/AddReplicateModal';
import AddRerunBlockModal from '../programming_controls/AddRerunBlockModal';
import AdjustWeightsModal from '../programming_controls/AdjustWeightsModal';

export function ChannelProgrammingOrganizeOptions() {
  const [addReplicateModalOpen, setAddReplicateModalOpen] = useState(false);
  const [addRerunBlocksModal, setAddRerunBlocksModal] = useState(false);
  const [adjustWeightsModal, setAdjustWeightsModal] = useState(false);

  return (
    <>
      <MenuItem divider disabled>
        Organize
      </MenuItem>
      <Tooltip
        title="This allows to schedule specific shows to run at specific time slots of the day or a week. It's recommended you first populate the channel with the episodes from the shows you want to play and/or other content like movies and redirects."
        placement="right"
      >
        <MenuItem component={Link} to="time-slot-editor">
          <TimeIcon /> Time Slots...
        </MenuItem>
      </Tooltip>
      <Tooltip
        title="This is similar to Time Slots, but instead of time sections, you pick a probability to play each tv show and the length of the block. Once a channel has been configured with random slots, the reload button can re-evaluate them again, with the saved settings."
        placement="right"
      >
        <MenuItem component={Link} to="random-slot-editor">
          <ShuffleIcon /> Random Slots...
        </MenuItem>
      </Tooltip>
      {/* <Tooltip
        title="This allows you to pick the weights for each of the shows, so you can decide that some shows should be less frequent than other shows."
        placement="right"
      >
        <MenuItem
          onClick={() => {
            // TODO: Fix issue with menu not closing
            // handleClose();
            setAdjustWeightsModal(true);
          }}
        >
          <TweakWeightsIcon /> Balance Media
        </MenuItem>
      </Tooltip> */}
      <Tooltip
        title="Makes multiple copies of the schedule and plays them in sequence. Normally this isn't necessary, because Tunarr will always play the schedule back from the beginning when it finishes. But creating replicas is a useful intermediary step sometimes before applying other transformations. Note that because very large channels can be problematic, the number of replicas will be limited to avoid creating really large channels."
        placement="right"
      >
        <MenuItem
          onClick={() => {
            // TODO: Fix issue with menu not closing
            // handleClose();
            setAddReplicateModalOpen(true);
          }}
        >
          <ReplicateIcon /> Replicate Programming...
        </MenuItem>
      </Tooltip>
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
        open={addRerunBlocksModal}
        onClose={() => setAddRerunBlocksModal(false)}
      />
      <AddReplicateModal
        open={addReplicateModalOpen}
        onClose={() => setAddReplicateModalOpen(false)}
      />
      <AdjustWeightsModal
        open={adjustWeightsModal}
        onClose={() => setAdjustWeightsModal(false)}
      />
    </>
  );
}
