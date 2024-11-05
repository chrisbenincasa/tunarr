import { JellyfinItem } from '@tunarr/types/jellyfin';
import {
  PlexEpisode,
  PlexMovie,
  PlexMusicTrack,
  PlexTerminalMedia,
} from '@tunarr/types/plex';
import { ContentProgramOriginalProgram } from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import { compact, find, first, isError, isNil, map } from 'lodash-es';
import { P, match } from 'ts-pattern';
import { v4 } from 'uuid';
import { parsePlexGuid } from '../../util/externalIds.js';
import { LoggerFactory } from '../../util/logging/LoggerFactory.js';
import {
  ProgramExternalIdType,
  programExternalIdTypeFromJellyfinProvider,
} from '../custom_types/ProgramExternalIdType.js';
import { ProgramSourceType } from '../custom_types/ProgramSourceType.js';
import {
  NewProgram as NewRawProgram,
  ProgramType,
} from '../direct/schema/Program.js';
import { NewProgramExternalId } from '../direct/schema/ProgramExternalId.js';

/**
 * Generates Program DB entities for Plex media
 */
class ProgramDaoMinter {
  #logger = LoggerFactory.child({
    caller: import.meta,
    className: this.constructor.name,
  });

  mint(
    serverName: string,
    program: ContentProgramOriginalProgram,
  ): NewRawProgram {
    const ret = match(program)
      .with(
        { sourceType: 'plex', program: { type: 'movie' } },
        ({ program: movie }) => this.mintProgramForPlexMovie(serverName, movie),
      )
      .with(
        { sourceType: 'plex', program: { type: 'episode' } },
        ({ program: episode }) =>
          this.mintProgramForPlexEpisode(serverName, episode),
      )
      .with(
        { sourceType: 'plex', program: { type: 'track' } },
        ({ program: track }) => this.mintProgramForPlexTrack(serverName, track),
      )
      .with(
        {
          sourceType: 'jellyfin',
          program: {
            Type: P.union(
              'Movie',
              'Audio',
              'Episode',
              'MusicVideo',
              'Video',
              'Trailer',
            ),
          },
        },
        ({ program }) => this.mintProgramForJellyfinItem(serverName, program),
      )
      .otherwise(() => new Error('Unexpected program type'));
    if (isError(ret)) {
      throw ret;
    }
    return ret;
  }

  private mintProgramForPlexMovie(
    serverName: string,
    plexMovie: PlexMovie,
  ): NewRawProgram {
    const file = first(first(plexMovie.Media)?.Part ?? []);
    return {
      uuid: v4(),
      sourceType: ProgramSourceType.PLEX,
      originalAirDate: plexMovie.originallyAvailableAt ?? null,
      duration: plexMovie.duration ?? 0,
      filePath: file?.file ?? null,
      externalSourceId: serverName,
      externalKey: plexMovie.ratingKey,
      plexRatingKey: plexMovie.ratingKey,
      plexFilePath: file?.key ?? null,
      rating: plexMovie.contentRating ?? null,
      summary: plexMovie.summary ?? null,
      title: plexMovie.title,
      type: ProgramType.Movie,
      year: plexMovie.year ?? null,
      createdAt: +dayjs(),
      updatedAt: +dayjs(),
    };
  }

  private mintProgramForJellyfinItem(
    serverName: string,
    item: Omit<JellyfinItem, 'Type'> & {
      Type: 'Movie' | 'Episode' | 'Audio' | 'Video' | 'MusicVideo' | 'Trailer';
    },
  ): NewRawProgram {
    return {
      uuid: v4(),
      createdAt: +dayjs(),
      updatedAt: +dayjs(),
      sourceType: ProgramSourceType.JELLYFIN,
      originalAirDate: item.PremiereDate,
      duration: (item.RunTimeTicks ?? 0) / 10_000,
      externalSourceId: serverName,
      externalKey: item.Id,
      rating: item.OfficialRating,
      summary: item.Overview,
      title: item.Name ?? '',
      type: match(item.Type)
        .with(P.union('Movie', 'Trailer'), () => ProgramType.Movie)
        .with(
          P.union('Episode', 'Video', 'MusicVideo'),
          () => ProgramType.Episode,
        )
        .with('Audio', () => ProgramType.Track)
        .exhaustive(),
      year: item.ProductionYear,
      showTitle: item.SeriesName,
      showIcon: item.SeriesThumbImageTag,
      seasonNumber: item.ParentIndexNumber,
      episode: item.IndexNumber,
      parentExternalKey: item.ParentId ?? item.SeasonId ?? item.AlbumId,
      grandparentExternalKey:
        item.SeriesId ??
        find(item.AlbumArtists, { Name: item.AlbumArtist })?.Id,
    };
  }

  private mintProgramForPlexEpisode(
    serverName: string,
    plexEpisode: PlexEpisode,
  ): NewRawProgram {
    const file = first(first(plexEpisode.Media)?.Part ?? []);
    return {
      uuid: v4(),
      createdAt: +dayjs(),
      updatedAt: +dayjs(),
      sourceType: ProgramSourceType.PLEX,
      originalAirDate: plexEpisode.originallyAvailableAt,
      duration: plexEpisode.duration ?? 0,
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
    };
  }

  private mintProgramForPlexTrack(
    serverName: string,
    plexTrack: PlexMusicTrack,
  ): NewRawProgram {
    const file = first(first(plexTrack.Media)?.Part ?? []);
    return {
      uuid: v4(),
      createdAt: +dayjs(),
      updatedAt: +dayjs(),
      sourceType: ProgramSourceType.PLEX,
      duration: plexTrack.duration ?? 0,
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
    };
  }

  mintExternalIds(
    serverName: string,
    programId: string,
    originalProgram: ContentProgramOriginalProgram,
  ) {
    return match(originalProgram)
      .with({ sourceType: 'plex' }, ({ program: originalProgram }) =>
        this.mintExternalIdsForPlex(serverName, programId, originalProgram),
      )
      .with({ sourceType: 'jellyfin' }, ({ program: originalProgram }) =>
        this.mintExternalIdsForJellyfin(serverName, programId, originalProgram),
      )
      .exhaustive();
  }

  mintExternalIdsForPlex(
    serverName: string,
    programId: string,
    media: PlexTerminalMedia,
  ): NewProgramExternalId[] {
    const file = first(first(media.Media)?.Part ?? []);
    const ratingId = {
      uuid: v4(),
      createdAt: +dayjs(),
      updatedAt: +dayjs(),
      externalKey: media.ratingKey,
      sourceType: ProgramExternalIdType.PLEX,
      programUuid: programId,
      externalSourceId: serverName,
      externalFilePath: file?.key,
      directFilePath: file?.file,
    } satisfies NewProgramExternalId;

    const guidId = {
      uuid: v4(),
      createdAt: +dayjs(),
      updatedAt: +dayjs(),
      externalKey: media.guid,
      sourceType: ProgramExternalIdType.PLEX_GUID,
      programUuid: programId,
    } satisfies NewProgramExternalId;

    const externalGuids = compact(
      map(media.Guid, (externalGuid) => {
        // Plex returns these in a URI form, so we can attempt to parse them
        const parsed = parsePlexGuid(externalGuid.id);
        if (!isError(parsed)) {
          return {
            ...parsed,
            uuid: v4(),
            createdAt: +dayjs(),
            updatedAt: +dayjs(),
            programUuid: programId,
          } satisfies NewProgramExternalId;
        } else {
          this.#logger.error(parsed, 'Error while extracting Plex Guids');
        }
        return null;
      }),
    );

    return [ratingId, guidId, ...externalGuids];
  }

  mintJellyfinExternalId(
    serverName: string,
    programId: string,
    media: JellyfinItem,
  ) {
    return {
      uuid: v4(),
      createdAt: +dayjs(),
      updatedAt: +dayjs(),
      externalKey: media.Id,
      sourceType: ProgramExternalIdType.JELLYFIN,
      programUuid: programId,
      externalSourceId: serverName,
    } satisfies NewProgramExternalId;
  }

  mintExternalIdsForJellyfin(
    serverName: string,
    programId: string,
    media: JellyfinItem,
  ) {
    const ratingId = this.mintJellyfinExternalId(serverName, programId, media);

    const externalGuids = compact(
      map(media.ProviderIds, (externalGuid, guidType) => {
        if (isNil(externalGuid)) {
          return;
        }

        const typ = programExternalIdTypeFromJellyfinProvider(guidType);
        if (typ) {
          return {
            uuid: v4(),
            createdAt: +dayjs(),
            updatedAt: +dayjs(),
            externalKey: externalGuid,
            sourceType: typ,
            programUuid: programId,
          } satisfies NewProgramExternalId;
        }

        return;
      }),
    );

    return [ratingId, ...externalGuids];
  }
}

export class ProgramMinterFactory {
  static create(): ProgramDaoMinter {
    return new ProgramDaoMinter();
  }
}
