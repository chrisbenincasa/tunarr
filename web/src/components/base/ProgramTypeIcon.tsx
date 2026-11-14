import {
  Album,
  Collections,
  Folder,
  Movie,
  MusicNote,
  MusicVideo,
  Person,
  PlaylistAdd,
  Tv,
  VideoFile,
} from '@mui/icons-material';
import type { ProgramOrFolder } from '@tunarr/types';

type Props = {
  programType: ProgramOrFolder['type'];
};

export const ProgramTypeIcon = ({ programType }: Props) => {
  switch (programType) {
    case 'movie':
      return <Movie />;
    case 'show':
      return <Tv />;
    case 'season':
      return <Tv />;
    case 'episode':
      return <Tv />;
    case 'track':
      return <MusicNote />;
    case 'artist':
      return <Person />;
    case 'album':
      return <Album />;
    case 'other_video':
      return <VideoFile />;
    case 'music_video':
      return <MusicVideo />;
    case 'collection':
      return <Collections />;
    case 'folder':
      return <Folder />;
    case 'playlist':
      return <PlaylistAdd />;
  }
};
