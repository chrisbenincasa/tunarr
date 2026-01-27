import type { channelListOptions } from '@/types/index.ts';
import { MoreVert, Settings } from '@mui/icons-material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { Button, IconButton, useMediaQuery, useTheme } from '@mui/material';
import { Trans } from '@lingui/react/macro';
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
  const theme = useTheme();
  const smallViewport = useMediaQuery(theme.breakpoints.down('sm'));

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
      {smallViewport ? (
        <IconButton
          aria-controls={open ? 'channel-nav-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
          onClick={(event) => handleClick(event, channel)}
        >
          <Settings />
        </IconButton>
      ) : (
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
          <Trans>Options</Trans>
        </Button>
      )}
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
