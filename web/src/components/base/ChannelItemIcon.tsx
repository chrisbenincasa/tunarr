import {
  Directions,
  Expand,
  MusicVideo,
  VideoCameraBackOutlined,
} from '@mui/icons-material';
import MusicNote from '@mui/icons-material/MusicNote';
import TheatersIcon from '@mui/icons-material/Theaters';
import TvIcon from '@mui/icons-material/Tv';
import { match, P } from 'ts-pattern';
import type { UIChannelProgram } from '../../types/index.ts';

type Props = {
  program: UIChannelProgram;
};

export const ChannelItemIcon = ({ program }: Props) => {
  let icon: React.ReactElement | null = null;
  if (program.type === 'content' || program.type === 'custom') {
    const underlyingProgram =
      program.type === 'content' ? program : program.program;
    icon = match(underlyingProgram?.program.type)
      .with('movie', () => <TheatersIcon />)
      .with('episode', () => <TvIcon />)
      .with('track', () => <MusicNote />)
      .with('music_video', () => <MusicVideo />)
      .with('other_video', () => <VideoCameraBackOutlined />)
      .with(P.nullish, () => null)
      .exhaustive();
  } else if (program.type === 'flex') {
    icon = <Expand />;
  } else if (program.type === 'redirect') {
    icon = <Directions />;
  }

  return icon;
};
