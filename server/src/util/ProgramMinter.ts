import { EntityManager, ref } from '@mikro-orm/better-sqlite';
import {
  PlexEpisode,
  PlexMovie,
  PlexMusicTrack,
  PlexTerminalMedia,
} from '@tunarr/types/plex';
import { compact, first, isError, map } from 'lodash-es';
import { ProgramSourceType } from '../dao/custom_types/ProgramSourceType.js';
import { Program, ProgramType } from '../dao/entities/Program.js';
import { ProgramExternalId } from '../dao/entities/ProgramExternalId.js';
import { ProgramExternalIdType } from '../dao/custom_types/ProgramExternalIdType.js';
import { LoggerFactory } from './logging/LoggerFactory.js';
import { parsePlexExternalGuid } from './externalIds.js';

/**
 * Generates Program DB entities for Plex media
 */
class PlexProgramMinter {
  #logger = LoggerFactory.child({ caller: import.meta });
  #em: EntityManager;

  constructor(em: EntityManager) {
    this.#em = em;
  }

  mint(serverName: string, plexItem: PlexTerminalMedia) {
    switch (plexItem.type) {
      case 'movie':
        return this.mintMovieProgram(serverName, plexItem);
      case 'episode':
        return this.mintEpisodeProgram(serverName, plexItem);
      case 'track':
        return this.mintTrackProgram(serverName, plexItem);
    }
  }

  private mintMovieProgram(serverName: string, plexMovie: PlexMovie): Program {
    const file = first(first(plexMovie.Media)?.Part ?? []);
    return this.#em.create(
      Program,
      {
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
      },
      { persist: false },
    );
  }

  private mintEpisodeProgram(
    serverName: string,
    plexEpisode: PlexEpisode,
  ): Program {
    const file = first(first(plexEpisode.Media)?.Part ?? []);
    const program = this.#em.create(
      Program,
      {
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
      },
      { persist: false },
    );

    return program;
  }

  private mintTrackProgram(serverName: string, plexTrack: PlexMusicTrack) {
    const file = first(first(plexTrack.Media)?.Part ?? []);
    return this.#em.create(
      Program,
      {
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
      },
      { persist: false },
    );
  }

  mintExternalIds(
    serverName: string,
    program: Program,
    media: PlexTerminalMedia,
  ) {
    const file = first(first(media.Media)?.Part ?? []);

    const ratingId = this.#em.create(
      ProgramExternalId,
      {
        externalKey: media.ratingKey,
        sourceType: ProgramExternalIdType.PLEX,
        program,
        externalSourceId: serverName,
        externalFilePath: file?.key,
        directFilePath: file?.file,
      },
      { persist: false },
    );

    const guidId = this.#em.create(
      ProgramExternalId,
      {
        externalKey: media.guid,
        sourceType: ProgramExternalIdType.PLEX_GUID,
        program,
      },
      { persist: false },
    );

    const externalGuids = compact(
      map(media.Guid, (externalGuid) => {
        // Plex returns these in a URI form, so we can attempt to parse them
        const parsed = parsePlexExternalGuid(externalGuid.id);
        if (!isError(parsed)) {
          parsed.program = ref(program);
          return parsed;
        } else {
          this.#logger.error(parsed, 'Error while extracting Plex Guids');
        }
        return null;
      }),
    );

    return [ratingId, guidId, ...externalGuids];
  }
}

export class ProgramMinterFactory {
  static createPlexMinter(em: EntityManager): PlexProgramMinter {
    return new PlexProgramMinter(em);
  }
}
