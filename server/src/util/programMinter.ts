import { EntityManager } from '@mikro-orm/better-sqlite';
import {
  PlexEpisode,
  PlexMovie,
  PlexMusicTrack,
  PlexTerminalMedia,
} from '@tunarr/types/plex';
import { first } from 'lodash-es';
import {
  Program,
  ProgramSourceType,
  ProgramType,
} from '../dao/entities/Program.js';

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
      case 'track':
        return mintTrackProgram(this.#em, serverName, plexItem);
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
    season: plexEpisode.parentIndex,
    episode: plexEpisode.index,
    parentExternalKey: plexEpisode.parentRatingKey,
    grandparentExternalKey: plexEpisode.grandparentRatingKey,
  });
}

function mintTrackProgram(
  em: EntityManager,
  serverName: string,
  plexTrack: PlexMusicTrack,
) {
  const file = first(first(plexTrack.Media)?.Part ?? []);
  return em.create(Program, {
    sourceType: ProgramSourceType.PLEX,
    duration: plexTrack.duration,
    filePath: file?.file,
    externalSourceId: serverName,
    externalKey: plexTrack.key,
    plexRatingKey: plexTrack.ratingKey,
    plexFilePath: file?.key,
    summary: plexTrack.summary,
    title: plexTrack.title,
    type: ProgramType.Track,
    year: plexTrack.parentYear,
    showTitle: plexTrack.grandparentTitle,
    showIcon: plexTrack.grandparentThumb,
    season: plexTrack.parentIndex,
    episode: plexTrack.index,
    parentExternalKey: plexTrack.parentRatingKey,
    grandparentExternalKey: plexTrack.grandparentRatingKey,
    albumName: plexTrack.parentTitle,
    artistName: plexTrack.grandparentTitle,
  });
}
