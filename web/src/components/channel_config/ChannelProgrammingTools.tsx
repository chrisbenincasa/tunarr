import {
  KeyboardArrowDown as KeyboardArrowDownIcon,
  Construction as OrganizeIcon,
} from '@mui/icons-material';
import { Button } from '@mui/material';
import { useState } from 'react';
import { StyledMenu } from '../base/StyledMenu.tsx';
import { ChannelProgrammingDeleteOptions } from './ChannelProgrammingDeleteOptions';
import { ChannelProgrammingOrganizeOptions } from './ChannelProgrammingOrganizeOptions';

export function ChannelProgrammingTools() {
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
        startIcon={<OrganizeIcon />}
        endIcon={<KeyboardArrowDownIcon />}
        onClick={handleClick}
        variant="outlined"
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
        <ChannelProgrammingOrganizeOptions onClose={() => handleClose()} />
        <ChannelProgrammingDeleteOptions onClose={() => handleClose()} />
      </StyledMenu>
    </>
  );
}
