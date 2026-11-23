import {
  Directions,
  Expand,
  MusicVideo,
  VideoCameraBackOutlined,
} from '@mui/icons-material';
import MusicNote from '@mui/icons-material/MusicNote';
import TheatersIcon from '@mui/icons-material/Theaters';
import TvIcon from '@mui/icons-material/Tv';
import type { UIChannelProgram } from '../../types/index.ts';

type Props = {
  program: UIChannelProgram;
};

export const ChannelItemIcon = ({ program }: Props) => {
  let icon: React.ReactElement | null = null;
  if (program.type === 'content' || program.type === 'custom') {
    const underlyingProgram =
      program.type === 'content' ? program : program.program;
    switch (underlyingProgram?.program.type) {
      case 'movie':
        icon = <TheatersIcon />;
        break;
      case 'episode':
        icon = <TvIcon />;
        break;
      case 'track':
        icon = <MusicNote />;
        break;
      case 'music_video':
        icon = <MusicVideo />;
        break;
      case 'other_video':
        icon = <VideoCameraBackOutlined />;
        break;
      case undefined:
        icon = null;
        break;
    }
  } else if (program.type === 'flex') {
    icon = <Expand />;
  } else if (program.type === 'redirect') {
    icon = <Directions />;
  }

  return icon;
};
