import { PlexEpisode, PlexMovie, PlexTerminalMedia } from 'dizquetv-types/plex';
import {
  Program,
  ProgramSourceType,
  ProgramType,
} from '../dao/entities/Program.js';
import { EntityManager } from '@mikro-orm/better-sqlite';
import { first } from 'lodash-es';

class ProgramMinter {
  #em: EntityManager;
  constructor(em: EntityManager) {
    this.#em = em;
  }

  mint(serverName: string, plexItem: PlexTerminalMedia) {
    switch (plexItem.type) {
      case 'movie':
        return mintMovieProgram(this.#em, serverName, plexItem);
      case 'episode':
        return mintEpisodeProgram(this.#em, serverName, plexItem);
    }
  }
}

export class ProgramMinterFactory {
  static create(em: EntityManager): ProgramMinter {
    return new ProgramMinter(em);
  }
}

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
    parentExternalKey: plexEpisode.parentRatingKey,
    grandparentExternalKey: plexEpisode.grandparentRatingKey,
  });
}
