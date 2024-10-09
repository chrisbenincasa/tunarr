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
import { compact, find, first, isError, isNil, map } from 'lodash-es';
import { P, match } from 'ts-pattern';
import { v4 } from 'uuid';
import {
  mintExternalIdForPlexGuid,
  parsePlexGuid,
} from '../../util/externalIds.js';
import { LoggerFactory } from '../../util/logging/LoggerFactory.js';
import {
  ProgramExternalIdType,
  programExternalIdTypeFromJellyfinProvider,
} from '../custom_types/ProgramExternalIdType.js';
import { ProgramSourceType } from '../custom_types/ProgramSourceType.js';
import { NewProgram as NewRawProgram } from '../direct/schema/Program.js';
import { NewProgramExternalId } from '../direct/schema/ProgramExternalId.js';
import { Program, ProgramType } from '../entities/Program.js';
import { ProgramExternalId } from '../entities/ProgramExternalId.js';

/**
 * Generates Program DB entities for Plex media
 */
class ProgramDaoMinter {
  #logger = LoggerFactory.child({
    caller: import.meta,
    className: this.constructor.name,
  });
  #em: EntityManager;

  constructor(em: EntityManager) {
    this.#em = em;
  }

  mint(serverName: string, program: ContentProgramOriginalProgram) {
    const ret = match(program)
      .with(
        { sourceType: 'plex', program: { type: 'movie' } },
        ({ program: movie }) => this.mintMovieProgramForPlex(serverName, movie),
      )
      .with(
        { sourceType: 'plex', program: { type: 'episode' } },
        ({ program: episode }) =>
          this.mintEpisodeProgramForPlex(serverName, episode),
      )
      .with(
        { sourceType: 'plex', program: { type: 'track' } },
        ({ program: track }) => this.mintTrackProgramForPlex(serverName, track),
      )
      .with(
        { sourceType: 'jellyfin', program: { Type: 'Movie' } },
        ({ program: movie }) =>
          this.mintMovieProgramForJellyfin(serverName, movie),
      )
      .with(
        { sourceType: 'jellyfin', program: { Type: 'Episode' } },
        ({ program: episode }) =>
          this.mintEpisodeProgramForJellyfin(serverName, episode),
      )
      .with(
        { sourceType: 'jellyfin', program: { Type: 'Audio' } },
        ({ program: track }) =>
          this.mintTrackProgramForJellyfin(serverName, track),
      )
      .otherwise(() => new Error('Unexpected program type'));
    if (isError(ret)) {
      throw ret;
    }
    return ret;
  }

  mintRaw(
    serverName: string,
    program: ContentProgramOriginalProgram,
  ): NewRawProgram {
    const ret = match(program)
      .with(
        { sourceType: 'plex', program: { type: 'movie' } },
        ({ program: movie }) =>
          this.mintRawProgramForPlexMovie(serverName, movie),
      )
      .with(
        { sourceType: 'plex', program: { type: 'episode' } },
        ({ program: episode }) =>
          this.mintRawProgramForPlexEpisode(serverName, episode),
      )
      .with(
        { sourceType: 'plex', program: { type: 'track' } },
        ({ program: track }) =>
          this.mintRawProgramForPlexTrack(serverName, track),
      )
      .with(
        {
          sourceType: 'jellyfin',
          program: { Type: P.union('Movie', 'Audio', 'Episode') },
        },
        ({ program }) =>
          this.mintRawProgramForJellyfinItem(serverName, program),
      )
      .otherwise(() => new Error('Unexpected program type'));
    if (isError(ret)) {
      throw ret;
    }
    return ret;
  }

  private mintMovieProgramForPlex(
    serverName: string,
    plexMovie: PlexMovie,
  ): Program {
    return this.#em.create(
      Program,
      {
        ...this.mintRawProgramForPlexMovie(serverName, plexMovie),
        sourceType: ProgramSourceType.PLEX,
        type: ProgramType.Movie,
        createdAt: dayjs().toDate(),
        updatedAt: dayjs().toDate(),
      },
      { persist: false },
    );
  }

  private mintRawProgramForPlexMovie(
    serverName: string,
    plexMovie: PlexMovie,
  ): NewRawProgram {
    const file = first(first(plexMovie.Media)?.Part ?? []);
    return {
      uuid: v4(),
      sourceType: ProgramSourceType.PLEX,
      originalAirDate: plexMovie.originallyAvailableAt ?? null,
      duration: plexMovie.duration,
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

  private mintRawProgramForJellyfinItem(
    serverName: string,
    item: Omit<JellyfinItem, 'Type'> & { Type: 'Movie' | 'Episode' | 'Audio' },
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
        .with('Movie', () => ProgramType.Movie)
        .with('Episode', () => ProgramType.Episode)
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

  private mintEpisodeProgramForPlex(
    serverName: string,
    plexEpisode: PlexEpisode,
  ): Program {
    const program = this.#em.create(
      Program,
      {
        ...this.mintRawProgramForPlexEpisode(serverName, plexEpisode),
        sourceType: ProgramSourceType.PLEX,
        type: ProgramType.Episode,
        createdAt: dayjs().toDate(),
        updatedAt: dayjs().toDate(),
      },
      { persist: false },
    );

    return program;
  }

  private mintRawProgramForPlexEpisode(
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
    };
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
    return this.#em.create(
      Program,
      {
        ...this.mintRawProgramForPlexTrack(serverName, plexTrack),
        sourceType: ProgramSourceType.PLEX,
        type: ProgramType.Track,
        createdAt: dayjs().toDate(),
        updatedAt: dayjs().toDate(),
      },
      { persist: false },
    );
  }

  private mintRawProgramForPlexTrack(
    serverName: string,
    plexTrack: PlexMusicTrack,
  ): NewRawProgram {
    const file = first(first(plexTrack.Media)?.Part ?? []);
    return {
      uuid: v4(),
      createdAt: +dayjs(),
      updatedAt: +dayjs(),
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
    };
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

  mintRawExternalIds(
    serverName: string,
    programId: string,
    originalProgram: ContentProgramOriginalProgram,
  ) {
    return match(originalProgram)
      .with({ sourceType: 'plex' }, ({ program: originalProgram }) =>
        this.mintRawExternalIdsForPlex(serverName, programId, originalProgram),
      )
      .with({ sourceType: 'jellyfin' }, ({ program: originalProgram }) =>
        this.mintRawExternalIdsForJellyfin(
          serverName,
          programId,
          originalProgram,
        ),
      )
      .exhaustive();
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
        const parsed = mintExternalIdForPlexGuid(externalGuid.id);
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

  mintRawExternalIdsForPlex(
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
      },
      { persist: false },
    );

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

  mintRawExternalIdsForJellyfin(
    serverName: string,
    programId: string,
    media: JellyfinItem,
  ) {
    const ratingId = {
      uuid: v4(),
      createdAt: +dayjs(),
      updatedAt: +dayjs(),
      externalKey: media.Id,
      sourceType: ProgramExternalIdType.JELLYFIN,
      programUuid: programId,
      externalSourceId: serverName,
    } satisfies NewProgramExternalId;

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
  static create(em: EntityManager): ProgramDaoMinter {
    return new ProgramDaoMinter(em);
  }
}
