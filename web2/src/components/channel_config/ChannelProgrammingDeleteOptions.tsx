import { MenuItem, Tooltip } from '@mui/material';
import { Delete } from '@mui/icons-material';
import { useRemoveDuplicates } from '../../hooks/programming_controls/useRemoveDuplicates';
import { useRemoveFlex } from '../../hooks/programming_controls/useRemoveFlex';
import { useRemoveAllProgramming } from '../../hooks/programming_controls/useRemoveAllProgramming';
import { useRemoveSpecials } from '../../hooks/programming_controls/useRemoveSpecials';
import { useState } from 'react';
import RemoveShowsModal from '../programming_controls/RemoveShowsModal';

type DeleteOptionsProps = {
  onClose: () => void;
};

export function ChannelProgrammingDeleteOptions({
  onClose,
}: DeleteOptionsProps) {
  const removeDuplicatePrograms = useRemoveDuplicates();
  const removeFlex = useRemoveFlex();
  const removeAllProgramming = useRemoveAllProgramming();
  const removeSpecials = useRemoveSpecials();

  const [removeShowsModalOpen, setRemoveShowsModalOpen] = useState(false);

  const handleClose = () => {
    onClose();
  };
  return (
    <>
      <MenuItem divider disabled>
        Delete
      </MenuItem>
      <Tooltip
        title="Removes all Flex periods from the schedule."
        placement="right"
      >
        <MenuItem
          disableRipple
          onClick={() => {
            removeFlex();
            handleClose();
          }}
        >
          <Delete />
          Flex
        </MenuItem>
      </Tooltip>
      <Tooltip title="Removes repeated videos." placement="right">
        <MenuItem
          disableRipple
          onClick={() => {
            removeDuplicatePrograms();
            handleClose();
          }}
        >
          <Delete />
          Duplicates
        </MenuItem>
      </Tooltip>
      <Tooltip
        title="Removes any specials from the schedule. Specials are episodes with season '00'."
        placement="right"
      >
        <MenuItem
          disableRipple
          onClick={() => {
            removeSpecials();
            handleClose();
          }}
        >
          <Delete />
          Specials
        </MenuItem>
      </Tooltip>
      <Tooltip
        title="Allows you to pick specific shows to remove from the channel."
        placement="right"
      >
        <MenuItem
          disableRipple
          onClick={() => {
            // To Do: Fix issue with menu staying open
            // handleClose();
            setRemoveShowsModalOpen(true);
          }}
        >
          <Delete />
          Show(s)...
        </MenuItem>
      </Tooltip>
      <Tooltip title="Removes all programs from schedule" placement="right">
        <MenuItem
          disableRipple
          onClick={() => {
            removeAllProgramming();
            handleClose();
          }}
        >
          <Delete />
          Clear Schedule
        </MenuItem>
      </Tooltip>
      <RemoveShowsModal
        open={removeShowsModalOpen}
        onClose={() => setRemoveShowsModalOpen(false)}
      />
    </>
  );
}
