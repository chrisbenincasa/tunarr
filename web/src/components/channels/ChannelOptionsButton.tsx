import type { channelListOptions } from '@/types/index.ts';
import { MoreVert, Settings } from '@mui/icons-material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { Button, IconButton } from '@mui/material';
import type { Channel } from '@tunarr/types';
import { isNull } from 'lodash-es';
import { useMemo, useState } from 'react';
import { ChannelOptionsMenu } from './ChannelOptionsMenu.tsx';

type Props = {
  channel: Channel;
  hideItems?: channelListOptions[];
  iconButton?: boolean;
};

export const ChannelOptionsButton = ({
  channel,
  hideItems,
  iconButton,
}: Props) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = !isNull(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const button = useMemo(() => {
    if (iconButton) {
      return (
        <IconButton onClick={handleClick}>
          <MoreVert />
        </IconButton>
      );
    } else {
      return (
        <Button
          variant="outlined"
          startIcon={<Settings />}
          aria-controls={open ? 'channel-nav-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
          disableRipple
          disableElevation
          onClick={handleClick}
          endIcon={<KeyboardArrowDownIcon />}
        >
          Options
        </Button>
      );
    }
  }, [iconButton, open]);

  return (
    <>
      {button}
      <ChannelOptionsMenu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        row={channel}
        hideItems={hideItems}
      />
    </>
  );
};
