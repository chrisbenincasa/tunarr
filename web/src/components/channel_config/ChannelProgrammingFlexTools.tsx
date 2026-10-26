import { Trans, useLingui } from '@lingui/react/macro';
import {
  FreeBreakfast as BreaksIcon,
  Delete as DeleteIcon,
  Expand as FlexIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  MoreTime as PaddingIcon,
  Nightlight as RestrictHoursIcon,
} from '@mui/icons-material';
import { Button, Divider, MenuItem } from '@mui/material';
import { useState } from 'react';
import { useRemoveFlex } from '../../hooks/programming_controls/useRemoveFlex';
import { ElevatedTooltip } from '../base/ElevatedTooltip.tsx';
import { StyledMenu } from '../base/StyledMenu.tsx';
import AddBreaksModal from '../programming_controls/AddBreaksModal';
import AddPaddingModal from '../programming_controls/AddPaddingModal';
import AddRestrictHoursModal from '../programming_controls/AddRestrictHoursModal';

type OpenModal = 'breaks' | 'padding' | 'restrict';

export function ChannelProgrammingFlexTools() {
  const { t } = useLingui();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [openModal, setOpenModal] = useState<OpenModal | null>(null);
  const removeFlex = useRemoveFlex();
  const open = anchorEl !== null;

  const handleClose = () => {
    setAnchorEl(null);
  };

  const openFromMenu = (modal: OpenModal) => {
    setOpenModal(modal);
    handleClose();
  };

  return (
    <>
      <Button
        id="channel-programming-flex-tools-button"
        startIcon={<FlexIcon />}
        endIcon={<KeyboardArrowDownIcon />}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        variant="outlined"
      >
        <Trans>Flex</Trans>
      </Button>

      <StyledMenu
        id="channel-programming-flex-tools"
        MenuListProps={{
          'aria-labelledby': 'channel-programming-flex-tools-button',
        }}
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
      >
        <ElevatedTooltip
          title={t`Adds Flex breaks between programs so that no run of consecutive programs goes longer than the time you set. Existing Flex stays in place.`}
          placement="right"
          elevation={10}
        >
          <MenuItem disableRipple onClick={() => openFromMenu('breaks')}>
            <BreaksIcon /> <Trans>Add Breaks...</Trans>
          </MenuItem>
        </ElevatedTooltip>
        <ElevatedTooltip
          title={t`Adds Flex after each TV episode or movie so the next program starts at one of the allowed minute marks, such as XX:00 or XX:30. Removes existing Flex first.`}
          placement="right"
          elevation={10}
        >
          <MenuItem disableRipple onClick={() => openFromMenu('padding')}>
            <PaddingIcon /> <Trans>Pad Start Times...</Trans>
          </MenuItem>
        </ElevatedTooltip>
        <ElevatedTooltip
          title={t`Plays the channel's programming only between the hours you set. Flex fills the rest of the day. Removes existing Flex first.`}
          placement="right"
          elevation={10}
        >
          <MenuItem disableRipple onClick={() => openFromMenu('restrict')}>
            <RestrictHoursIcon /> <Trans>Restrict Hours...</Trans>
          </MenuItem>
        </ElevatedTooltip>
        <Divider />
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
            <DeleteIcon /> <Trans>Remove All Flex</Trans>
          </MenuItem>
        </ElevatedTooltip>
      </StyledMenu>

      <AddBreaksModal
        open={openModal === 'breaks'}
        onClose={() => setOpenModal(null)}
      />
      <AddPaddingModal
        open={openModal === 'padding'}
        onClose={() => setOpenModal(null)}
      />
      <AddRestrictHoursModal
        open={openModal === 'restrict'}
        onClose={() => setOpenModal(null)}
      />
    </>
  );
}
