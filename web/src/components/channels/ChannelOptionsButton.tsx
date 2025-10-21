import type { channelListOptions } from '@/types/index.ts';
import { Settings } from '@mui/icons-material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { Button } from '@mui/material';
import type { Channel } from '@tunarr/types';
import { isNull } from 'lodash-es';
import { useState } from 'react';
import { ChannelOptionsMenu } from './ChannelOptionsMenu.tsx';

type Props = {
  channel: Channel;
  hideItems?: channelListOptions[];
};

export const ChannelOptionsButton = ({ channel, hideItems }: Props) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [channelMenu, setChannelMenu] = useState<Channel>();
  const open = !isNull(anchorEl);

  const handleClick = (
    event: React.MouseEvent<HTMLElement>,
    channel: Channel,
  ) => {
    console.log(channel);
    setAnchorEl(event.currentTarget);
    setChannelMenu(channel);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <Button
        variant="outlined"
        startIcon={<Settings />}
        aria-controls={open ? 'channel-nav-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        disableRipple
        disableElevation
        onClick={(event) => handleClick(event, channel)}
        endIcon={<KeyboardArrowDownIcon />}
      >
        Options
      </Button>
      {channelMenu && (
        <ChannelOptionsMenu
          anchorEl={anchorEl}
          open={open}
          onClose={handleClose}
          row={channelMenu}
          hideItems={hideItems}
        />
      )}
    </>
  );
};
