import { Construction } from '@mui/icons-material';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import { Button } from '@mui/material';
import { useState } from 'react';
import { StyledMenu } from '../StyledMenu.tsx';
import { TimeSlotToolOptions } from './TimeSlotToolOptions.tsx';

type Props = {};

export const TimeSlotTools = () => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <Button
        startIcon={<Construction />}
        endIcon={<KeyboardArrowDown />}
        onClick={handleClick}
        variant="contained"
      >
        Tools
      </Button>
      <StyledMenu
        id="channel-programming-tools"
        MenuListProps={{
          'aria-labelledby': 'channel-programming-tools',
        }}
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
      >
        <TimeSlotToolOptions onClose={() => handleClose()} />
        {/* <ChannelProgrammingOrganizeOptions onClose={() => handleClose()} />
        <ChannelProgrammingDeleteOptions onClose={() => handleClose()} /> */}
      </StyledMenu>
    </>
  );
};
