import { EntityManager } from '@mikro-orm/better-sqlite';
import {
  PlexEpisode,
  PlexMovie,
  PlexMusicTrack,
  PlexTerminalMedia,
} from '@tunarr/types/plex';
import { first } from 'lodash-es';
import { ProgramSourceType } from '../dao/custom_types/ProgramSourceType.js';
import { Program, ProgramType } from '../dao/entities/Program.js';
import { ProgramExternalId } from '../dao/entities/ProgramExternalId.js';
import { ProgramExternalIdType } from '../dao/custom_types/ProgramExternalIdType.js';

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
  const program = em.create(Program, {
    sourceType: ProgramSourceType.PLEX,
    originalAirDate: plexMovie.originallyAvailableAt,
    duration: plexMovie.duration,
    filePath: file?.file,
    externalSourceId: serverName,
    externalKey: plexMovie.ratingKey,
    plexRatingKey: plexMovie.ratingKey,
    plexFilePath: file?.key,
    rating: plexMovie.contentRating,
    summary: plexMovie.summary,
    title: plexMovie.title,
    type: ProgramType.Movie,
    year: plexMovie.year,
  });

  program.externalIds.set(mintExternalIds(em, serverName, program, plexMovie));

  return program;
}

function mintEpisodeProgram(
  em: EntityManager,
  serverName: string,
  plexEpisode: PlexEpisode,
): Program {
  const file = first(first(plexEpisode.Media)?.Part ?? []);
  const program = em.create(Program, {
    sourceType: ProgramSourceType.PLEX,
    originalAirDate: plexEpisode.originallyAvailableAt,
    duration: plexEpisode.duration,
    filePath: file?.file,
    externalSourceId: serverName,
    externalKey: plexEpisode.ratingKey,
    plexRatingKey: plexEpisode.ratingKey,
    plexFilePath: file?.key,
    rating: plexEpisode.contentRating,
    summary: plexEpisode.summary,
    title: plexEpisode.title,
    type: ProgramType.Episode,
    year: plexEpisode.year,
    showTitle: plexEpisode.grandparentTitle,
    showIcon: plexEpisode.grandparentThumb,
    seasonNumber: plexEpisode.parentIndex,
    episode: plexEpisode.index,
    parentExternalKey: plexEpisode.parentRatingKey,
    grandparentExternalKey: plexEpisode.grandparentRatingKey,
  });
  program.externalIds.set(
    mintExternalIds(em, serverName, program, plexEpisode),
  );
  return program;
}

function mintTrackProgram(
  em: EntityManager,
  serverName: string,
  plexTrack: PlexMusicTrack,
) {
  const file = first(first(plexTrack.Media)?.Part ?? []);
  const program = em.create(Program, {
    sourceType: ProgramSourceType.PLEX,
    duration: plexTrack.duration,
    filePath: file?.file,
    externalSourceId: serverName,
    externalKey: plexTrack.ratingKey,
    plexRatingKey: plexTrack.ratingKey,
    plexFilePath: file?.key,
    summary: plexTrack.summary,
    title: plexTrack.title,
    type: ProgramType.Track,
    year: plexTrack.parentYear,
    showTitle: plexTrack.grandparentTitle,
    showIcon: plexTrack.grandparentThumb,
    seasonNumber: plexTrack.parentIndex,
    episode: plexTrack.index,
    parentExternalKey: plexTrack.parentRatingKey,
    grandparentExternalKey: plexTrack.grandparentRatingKey,
    albumName: plexTrack.parentTitle,
    artistName: plexTrack.grandparentTitle,
  });
  program.externalIds.set(mintExternalIds(em, serverName, program, plexTrack));
  return program;
}

function mintExternalIds(
  em: EntityManager,
  serverName: string,
  program: Program,
  media: PlexTerminalMedia,
) {
  const file = first(first(media.Media)?.Part ?? []);

  const ratingId = em.create(ProgramExternalId, {
    externalKey: media.ratingKey,
    sourceType: ProgramExternalIdType.PLEX,
    program,
    externalSourceId: serverName,
    externalFilePath: file?.key,
    directFilePath: file?.file,
  });

  const guidId = em.create(ProgramExternalId, {
    externalKey: media.guid,
    sourceType: ProgramExternalIdType.PLEX_GUID,
    program,
    externalSourceId: serverName,
  });

  return [ratingId, guidId];
}
