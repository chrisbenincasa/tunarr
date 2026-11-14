import EmbyLogo from '@/assets/emby.svg?react';
import JellyfinLogo from '@/assets/jellyfin.svg?react';
import PlexLogo from '@/assets/plex.svg?react';
import { Computer } from '@mui/icons-material';
import type { SvgIconProps } from '@mui/material';
import type { MediaSourceType } from '@tunarr/types';

type Props = SvgIconProps & {
  network: MediaSourceType;
};

function networkIconComponent(network: MediaSourceType) {
  switch (network) {
    case 'plex':
      return PlexLogo;
    case 'emby':
      return EmbyLogo;
    case 'jellyfin':
      return JellyfinLogo;
    case 'local':
      return Computer;
  }
}

export const NetworkIcon = ({ network, ...rest }: Props) => {
  const Icon = networkIconComponent(network);
  return <Icon {...rest} />;
};
