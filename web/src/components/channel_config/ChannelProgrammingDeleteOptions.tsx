import { Trans, useLingui } from '@lingui/react/macro';
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
  const { t } = useLingui();
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
        <Trans>Delete</Trans>
      </MenuItem>
      <ElevatedTooltip
        title={t`Removes all Flex periods from the schedule.`}
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
          <Trans>Flex</Trans>
        </MenuItem>
      </ElevatedTooltip>
      <ElevatedTooltip
        title={t`Removes repeated programs.`}
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
          <Trans>Duplicates</Trans>
        </MenuItem>
      </ElevatedTooltip>
      <ElevatedTooltip
        title={t`Removes any specials from the schedule. Specials are episodes with season '00'.`}
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
          <Trans>Specials</Trans>
        </MenuItem>
      </ElevatedTooltip>
      <ElevatedTooltip
        title={t`Allows you to pick specific programming to remove from the channel.`}
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
          <Trans>Remove...</Trans>
        </MenuItem>
      </ElevatedTooltip>
      <ElevatedTooltip
        title={t`Removes all programs from schedule`}
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
          <Trans>Clear Schedule</Trans>
        </MenuItem>
      </ElevatedTooltip>
    </>
  );
}
