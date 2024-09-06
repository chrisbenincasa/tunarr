import {
  EntityManager,
  RequiredEntityData,
  ref,
} from '@mikro-orm/better-sqlite';
import { nullToUndefined } from '@tunarr/shared/util';
import { JellyfinItem } from '@tunarr/types/jellyfin';
import {
  PlexEpisode,
  PlexMovie,
  PlexMusicTrack,
  PlexTerminalMedia,
} from '@tunarr/types/plex';
import { ContentProgramOriginalProgram } from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import { compact, first, isError, isNil, map } from 'lodash-es';
import {
  ProgramExternalIdType,
  programExternalIdTypeFromJellyfinProvider,
} from '../dao/custom_types/ProgramExternalIdType.js';
import { ProgramSourceType } from '../dao/custom_types/ProgramSourceType.js';
import { Program, ProgramType } from '../dao/entities/Program.js';
import { ProgramExternalId } from '../dao/entities/ProgramExternalId.js';
import { parsePlexExternalGuid } from './externalIds.js';
import { LoggerFactory } from './logging/LoggerFactory.js';

/**
 * Generates Program DB entities for Plex media
 */
class PlexProgramMinter {
  #logger = LoggerFactory.child({
    caller: import.meta,
    className: this.constructor.name,
  });
  #em: EntityManager;

  constructor(em: EntityManager) {
    this.#em = em;
  }

  mint(serverName: string, program: ContentProgramOriginalProgram) {
    switch (program.sourceType) {
      case 'plex':
        switch (program.program.type) {
          case 'movie':
            return this.mintMovieProgramForPlex(serverName, program.program);
          case 'episode':
            return this.mintEpisodeProgramForPlex(serverName, program.program);
          case 'track':
            return this.mintTrackProgramForPlex(serverName, program.program);
        }
      // Disabled because eslint does not pickup the fact that the above is
      // exhaustive.
      // eslint-disable-next-line no-fallthrough
      case 'jellyfin':
        switch (program.program.Type) {
          case 'Movie':
            return this.mintMovieProgramForJellyfin(
              serverName,
              program.program,
            );
          case 'Episode':
            return this.mintEpisodeProgramForJellyfin(
              serverName,
              program.program,
            );
          case 'Audio':
          default:
            return this.mintTrackProgramForJellyfin(
              serverName,
              program.program,
            );
        }
    }
  }

  private mintMovieProgramForPlex(
    serverName: string,
    plexMovie: PlexMovie,
  ): Program {
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

  private mintMovieProgramForJellyfin(
    serverName: string,
    item: JellyfinItem,
  ): Program {
    // const file = first(first(plexMovie.Media)?.Part ?? []);
    return this.#em.create(
      Program,
      {
        sourceType: ProgramSourceType.JELLYFIN,
        originalAirDate: nullToUndefined(item.PremiereDate),
        duration: (item.RunTimeTicks ?? 0) / 10_000,
        filePath: nullToUndefined(item.Path),
        externalSourceId: serverName,
        externalKey: item.Id,
        plexRatingKey: item.Id,
        plexFilePath: '',
        // plexFilePath: file?.key,
        rating: nullToUndefined(item.OfficialRating),
        summary: nullToUndefined(item.Overview),
        title: nullToUndefined(item.Name) ?? '',
        type: ProgramType.Movie,
        year: nullToUndefined(item.ProductionYear),
      } satisfies RequiredEntityData<Program>,
      { persist: false },
    );
  }

  private mintEpisodeProgramForPlex(
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

  private mintEpisodeProgramForJellyfin(
    serverName: string,
    item: JellyfinItem,
  ): Program {
    // const file = first(first(plexEpisode.Media)?.Part ?? []);
    return this.#em.create(
      Program,
      {
        sourceType: ProgramSourceType.JELLYFIN,
        originalAirDate: nullToUndefined(item.PremiereDate),
        duration: (item.RunTimeTicks ?? 0) / 10_000,
        externalSourceId: serverName,
        externalKey: item.Id,
        rating: nullToUndefined(item.OfficialRating),
        summary: nullToUndefined(item.Overview),
        title: nullToUndefined(item.Name) ?? '',
        type: ProgramType.Episode,
        year: nullToUndefined(item.ProductionYear),
        showTitle: nullToUndefined(item.SeriesName),
        showIcon: nullToUndefined(item.SeriesThumbImageTag),
        seasonNumber: nullToUndefined(item.ParentIndexNumber),
        episode: nullToUndefined(item.IndexNumber),
        parentExternalKey: nullToUndefined(item.SeasonId),
        grandparentExternalKey: nullToUndefined(item.SeriesId),
      },
      { persist: false },
    );
  }

  private mintTrackProgramForPlex(
    serverName: string,
    plexTrack: PlexMusicTrack,
  ) {
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

  private mintTrackProgramForJellyfin(serverName: string, item: JellyfinItem) {
    // const file = first(first(plexTrack.Media)?.Part ?? []);
    return this.#em.create(
      Program,
      {
        sourceType: ProgramSourceType.JELLYFIN,
        originalAirDate: nullToUndefined(item.PremiereDate),
        duration: (item.RunTimeTicks ?? 0) / 10_000,
        externalSourceId: serverName,
        externalKey: item.Id,
        rating: nullToUndefined(item.OfficialRating),
        summary: nullToUndefined(item.Overview),
        title: nullToUndefined(item.Name) ?? '',
        type: ProgramType.Track,
        year: item.PremiereDate ? dayjs(item.PremiereDate).year() : undefined,
        parentExternalKey: nullToUndefined(item.AlbumId),
        grandparentExternalKey: first(item.AlbumArtists)?.Id,
        albumName: nullToUndefined(item.Album),
        artistName: nullToUndefined(item.AlbumArtist),
      },
      { persist: false },
    );
  }

  mintExternalIds(
    serverName: string,
    program: Program,
    { sourceType, program: originalProgram }: ContentProgramOriginalProgram,
  ) {
    switch (sourceType) {
      case 'plex':
        return this.mintExternalIdsForPlex(
          serverName,
          program,
          originalProgram,
        );
      case 'jellyfin':
        return this.mintExternalIdsForJellyfin(
          serverName,
          program,
          originalProgram,
        );
    }
  }

  mintExternalIdsForPlex(
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

  mintExternalIdsForJellyfin(
    serverName: string,
    program: Program,
    media: JellyfinItem,
  ) {
    const ratingId = this.#em.create(
      ProgramExternalId,
      {
        externalKey: media.Id,
        sourceType: ProgramExternalIdType.JELLYFIN,
        program,
        externalSourceId: serverName,
        // externalFilePath: file?.key,
        // directFilePath: file?.file,
      },
      { persist: false },
    );

    // const guidId = this.#em.create(
    //   ProgramExternalId,
    //   {
    //     externalKey: media.guid,
    //     sourceType: ProgramExternalIdType.PLEX_GUID,
    //     program,
    //   },
    //   { persist: false },
    // );

    const externalGuids = compact(
      map(media.ProviderIds, (externalGuid, guidType) => {
        if (isNil(externalGuid)) {
          return;
        }

        const typ = programExternalIdTypeFromJellyfinProvider(guidType);
        if (typ) {
          return this.#em.create(
            ProgramExternalId,
            {
              externalKey: externalGuid,
              sourceType: typ,
              program,
            },
            { persist: false },
          );
        }

        return;
      }),
    );

    return [ratingId, ...externalGuids];
  }
}

export class ProgramMinterFactory {
  static createPlexMinter(em: EntityManager): PlexProgramMinter {
    return new PlexProgramMinter(em);
  }
}
