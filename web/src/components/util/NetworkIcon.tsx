import EmbyLogo from '@/assets/emby.svg?react';
import JellyfinLogo from '@/assets/jellyfin.svg?react';
import PlexLogo from '@/assets/plex.svg?react';
import { Computer } from '@mui/icons-material';
import type { SvgIconProps } from '@mui/material';
import type { MediaSourceType } from '@tunarr/types';
import { match } from 'ts-pattern';

type Props = SvgIconProps & {
  network: MediaSourceType;
};

export const NetworkIcon = ({ network, ...rest }: Props) => {
  const Icon = match(network)
    .with('plex', () => PlexLogo)
    .with('emby', () => EmbyLogo)
    .with('jellyfin', () => JellyfinLogo)
    .with('local', () => Computer)
    .exhaustive();
  return <Icon {...rest} />;
};
