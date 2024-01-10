import { PlexEpisode, PlexMovie, PlexTerminalMedia } from 'dizquetv-types/plex';
import {
  Program,
  ProgramSourceType,
  ProgramType,
} from '../dao/entities/Program.js';
import { EntityManager } from '@mikro-orm/better-sqlite';
import { first } from 'lodash-es';

type Minter = (
  em: EntityManager,
) => (serverName: string, plexItem: PlexTerminalMedia) => Program;

export const programMinter: Minter = (em) => (serverName, plexItem) => {
  switch (plexItem.type) {
    case 'movie':
      return mintMovieProgram(em, serverName, plexItem);
    case 'episode':
      return mintEpisodeProgram(em, serverName, plexItem);
  }
};

function mintMovieProgram(
  em: EntityManager,
  serverName: string,
  plexMovie: PlexMovie,
): Program {
  const file = first(first(plexMovie.Media)?.Part ?? []);
  return em.create(Program, {
    sourceType: ProgramSourceType.PLEX,
    originalAirDate: plexMovie.originallyAvailableAt,
    duration: plexMovie.duration,
    filePath: file?.file,
    externalSourceId: serverName,
    externalKey: plexMovie.key,
    plexRatingKey: plexMovie.ratingKey,
    plexFilePath: file?.key,
    rating: plexMovie.contentRating,
    summary: plexMovie.summary,
    title: plexMovie.title,
    type: ProgramType.Movie,
    year: plexMovie.year,
  });
}

function mintEpisodeProgram(
  em: EntityManager,
  serverName: string,
  plexEpisode: PlexEpisode,
): Program {
  const file = first(first(plexEpisode.Media)?.Part ?? []);
  return em.create(Program, {
    sourceType: ProgramSourceType.PLEX,
    originalAirDate: plexEpisode.originallyAvailableAt,
    duration: plexEpisode.duration,
    filePath: file?.file,
    externalSourceId: serverName,
    externalKey: plexEpisode.key,
    plexRatingKey: plexEpisode.ratingKey,
    plexFilePath: file?.key,
    rating: plexEpisode.contentRating,
    summary: plexEpisode.summary,
    title: plexEpisode.title,
    type: ProgramType.Episode,
    year: plexEpisode.year,
    showTitle: plexEpisode.grandparentTitle,
    showIcon: plexEpisode.grandparentThumb,
    episode: plexEpisode.index,
  });
}
