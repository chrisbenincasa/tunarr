import { useLingui } from '@lingui/react/macro';
import { MoreVert } from '@mui/icons-material';
import { IconButton } from '@mui/material';
import type { Channel } from '@tunarr/types';
import { type ComponentProps, useId, useState } from 'react';
import { ChannelOptionsMenu } from './ChannelOptionsMenu.tsx';

type Props = {
  channel: Channel;
  hideItems?: ComponentProps<typeof ChannelOptionsMenu>['hideItems'];
};

export const ChannelMenuButton = ({ channel, hideItems }: Props) => {
  const { t } = useLingui();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const buttonId = useId();

  return (
    <>
      <IconButton
        id={buttonId}
        aria-label={t`More actions for ${channel.name}`}
        aria-haspopup="true"
        aria-expanded={anchorEl ? 'true' : undefined}
        onClick={(e) => {
          e.stopPropagation();
          setAnchorEl(e.currentTarget);
        }}
      >
        <MoreVert />
      </IconButton>
      <ChannelOptionsMenu
        anchorEl={anchorEl}
        open={anchorEl !== null}
        onClose={(e) => {
          e?.stopPropagation();
          setAnchorEl(null);
        }}
        row={channel}
        hideItems={hideItems}
        labelledBy={buttonId}
      />
    </>
  );
};
