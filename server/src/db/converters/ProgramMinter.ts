import { ProgramExternalIdType } from '@/db/custom_types/ProgramExternalIdType.js';
import { ProgramSourceType } from '@/db/custom_types/ProgramSourceType.js';
import { NewProgramExternalId } from '@/db/schema/ProgramExternalId.js';
import { seq } from '@tunarr/shared/util';
import { ContentProgram } from '@tunarr/types';
import { JellyfinItem } from '@tunarr/types/jellyfin';
import { PlexEpisode, PlexMovie, PlexMusicTrack } from '@tunarr/types/plex';
import { ContentProgramOriginalProgram } from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import { find, first, isError } from 'lodash-es';
import { P, match } from 'ts-pattern';
import { v4 } from 'uuid';
import {
  NewProgramDao as NewRawProgram,
  ProgramType,
} from '../schema/Program.ts';

/**
 * Generates Program DB entities for Plex media
 */
class ProgramDaoMinter {
  contentProgramDtoToDao(program: ContentProgram): NewRawProgram {
    const now = +dayjs();
    return {
      uuid: v4(),
      sourceType: program.externalSourceType,
      externalSourceId: program.externalSourceId ?? program.externalSourceName,
      externalKey: program.externalKey,
      originalAirDate: program.date ?? null,
      duration: program.duration,
      filePath: program.serverFilePath,
      plexRatingKey: program.externalKey,
      plexFilePath: program.serverFileKey,
      rating: program.rating ?? null,
      summary: program.summary ?? null,
      title: program.title,
      type: program.subtype,
      year: program.year ?? null,
      showTitle: program.grandparent?.title,
      seasonNumber: program.parent?.index,
      episode: program.index,
      parentExternalKey: program.parent?.externalKey,
      grandparentExternalKey: program.grandparent?.externalKey,
      createdAt: now,
      updatedAt: now,
    };
  }

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
    program: ContentProgram,
    // originalProgram: ContentProgramOriginalProgram,
  ) {
    return match(program)
      .with({ externalSourceType: 'plex' }, () =>
        this.mintPlexExternalIds(serverName, programId, program),
      )
      .with({ externalSourceType: 'jellyfin' }, () =>
        this.mintJellyfinExternalIds(serverName, programId, program),
      )
      .exhaustive();
  }

  mintPlexExternalIds(
    serverName: string,
    programId: string,
    program: ContentProgram,
  ): NewProgramExternalId[] {
    const now = +dayjs();

    // const file = first(first(program.Media)?.Part ?? []);
    const ids: NewProgramExternalId[] = [
      {
        uuid: v4(),
        createdAt: now,
        updatedAt: now,
        externalKey: program.externalKey,
        sourceType: ProgramExternalIdType.PLEX,
        programUuid: programId,
        externalSourceId: serverName,
        externalFilePath: program.serverFileKey,
        directFilePath: program.serverFilePath,
      },
    ];

    const plexGuid = find(program.externalIds, { source: 'plex-guid' });
    if (plexGuid) {
      ids.push({
        uuid: v4(),
        createdAt: now,
        updatedAt: now,
        externalKey: plexGuid.id,
        sourceType: ProgramExternalIdType.PLEX_GUID,
        programUuid: programId,
      });
    }

    ids.push(
      ...seq.collect(program.externalIds, (eid) => {
        switch (eid.source) {
          case 'tmdb':
          case 'imdb':
          case 'tvdb':
            return {
              uuid: v4(),
              createdAt: now,
              updatedAt: now,
              externalKey: eid.id,
              sourceType: eid.source,
              programUuid: programId,
            } satisfies NewProgramExternalId;
          default:
            return null;
        }
      }),
    );

    return ids;
  }

  mintJellyfinExternalIdForApiItem(
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

  mintJellyfinExternalIds(
    serverName: string,
    programId: string,
    program: ContentProgram,
  ) {
    const now = +dayjs();
    const ids: NewProgramExternalId[] = [
      {
        uuid: v4(),
        createdAt: now,
        updatedAt: now,
        externalKey: program.externalKey,
        sourceType: ProgramExternalIdType.JELLYFIN,
        programUuid: programId,
        externalSourceId: serverName,
        externalFilePath: program.serverFileKey,
        directFilePath: program.serverFilePath,
      },
    ];

    ids.push(
      ...seq.collect(program.externalIds, (eid) => {
        switch (eid.source) {
          case 'tmdb':
          case 'imdb':
          case 'tvdb':
            return {
              uuid: v4(),
              createdAt: now,
              updatedAt: now,
              externalKey: eid.id,
              sourceType: eid.source,
              programUuid: programId,
            } satisfies NewProgramExternalId;
          default:
            return null;
        }
      }),
    );

    return ids;
  }
}

export class ProgramMinterFactory {
  static create(): ProgramDaoMinter {
    return new ProgramDaoMinter();
  }
}
