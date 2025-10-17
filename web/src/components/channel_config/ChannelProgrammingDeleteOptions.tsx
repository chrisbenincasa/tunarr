import { Delete } from '@mui/icons-material';
import { MenuItem } from '@mui/material';
import { useRemoveAllProgramming } from '../../hooks/programming_controls/useRemoveAllProgramming';
import { useRemoveDuplicates } from '../../hooks/programming_controls/useRemoveDuplicates';
import { useRemoveFlex } from '../../hooks/programming_controls/useRemoveFlex';
import { useRemoveSpecials } from '../../hooks/programming_controls/useRemoveSpecials';
import { ElevatedTooltip } from '../base/ElevatedTooltip.tsx';

type DeleteOptionsProps = {
  onClose: () => void;
  removeShowsModalOpen: (open: boolean) => void;
};

export function ChannelProgrammingDeleteOptions({
  onClose,
  removeShowsModalOpen,
}: DeleteOptionsProps) {
  const removeDuplicatePrograms = useRemoveDuplicates();
  const removeFlex = useRemoveFlex();
  const removeAllProgramming = useRemoveAllProgramming();
  const removeSpecials = useRemoveSpecials();

  const handleClose = () => {
    onClose();
  };

  return (
    <>
      <MenuItem divider disabled>
        Delete
      </MenuItem>
      <ElevatedTooltip
        title="Removes all Flex periods from the schedule."
        placement="right"
        elevation={10}
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
      </ElevatedTooltip>
      <ElevatedTooltip
        title="Removes repeated programs."
        placement="right"
        elevation={10}
      >
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
      </ElevatedTooltip>
      <ElevatedTooltip
        title="Removes any specials from the schedule. Specials are episodes with season '00'."
        placement="right"
        elevation={10}
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
      </ElevatedTooltip>
      <ElevatedTooltip
        title="Allows you to pick specific programming to remove from the channel."
        placement="right"
        elevation={10}
      >
        <MenuItem
          disableRipple
          onClick={(event) => {
            event.stopPropagation();
            removeShowsModalOpen(true);
            handleClose();
          }}
        >
          <Delete />
          Remove...
        </MenuItem>
      </ElevatedTooltip>
      <ElevatedTooltip
        title="Removes all programs from schedule"
        placement="right"
        elevation={10}
      >
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
      </ElevatedTooltip>
    </>
  );
}
