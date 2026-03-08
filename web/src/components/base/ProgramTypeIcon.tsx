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
import { ProgramOrFolder } from '@tunarr/types';
import React from 'react';
import { match } from 'ts-pattern';

type Props = {
  programType: ProgramOrFolder['type'];
};

export const ProgramTypeIcon = ({ programType }: Props) => {
  return match(programType)
    .returnType<React.ReactElement>()
    .with('movie', () => <Movie />)
    .with('show', () => <Tv />)
    .with('season', () => <Tv />)
    .with('episode', () => <Tv />)
    .with('track', () => <MusicNote />)
    .with('artist', () => <Person />)
    .with('album', () => <Album />)
    .with('other_video', () => <VideoFile />)
    .with('music_video', () => <MusicVideo />)
    .with('collection', () => <Collections />)
    .with('folder', () => <Folder />)
    .with('playlist', () => <PlaylistAdd />)
    .exhaustive();
};
