import { ContentProgram, MediaSourceSettings } from '@tunarr/types';
import { JellyfinItem } from '@tunarr/types/jellyfin';
import { PlexEpisode, PlexMovie, PlexMusicTrack } from '@tunarr/types/plex';
import {
  ContentProgramOriginalProgram,
  ContentProgramTypeSchema,
  ExternalSourceTypeSchema,
} from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import { first, isError } from 'lodash-es';
import { P, match } from 'ts-pattern';

export class ProgramMinter {
  mintProgram(
    mediaSource: MediaSourceSettings,
    program: ContentProgramOriginalProgram,
  ): ContentProgram {
    const ret = match(program)
      .with(
        { sourceType: 'plex', program: { type: 'movie' } },
        ({ program: movie }) =>
          this.mintRawProgramForPlexMovie(mediaSource, movie),
      )
      .with(
        { sourceType: 'plex', program: { type: 'episode' } },
        ({ program: episode }) =>
          this.mintRawProgramForPlexEpisode(mediaSource, episode),
      )
      .with(
        { sourceType: 'plex', program: { type: 'track' } },
        ({ program: track }) =>
          this.mintRawProgramForPlexTrack(mediaSource, track),
      )
      .with(
        {
          sourceType: 'jellyfin',
          program: { Type: P.union('Movie', 'Audio', 'Episode') },
        },
        ({ program }) =>
          this.mintRawProgramForJellyfinItem(mediaSource, program),
      )
      .otherwise(() => new Error('Unexpected program type'));
    if (isError(ret)) {
      throw ret;
    }
    return ret;
  }

  private mintRawProgramForPlexMovie(
    server: MediaSourceSettings,
    plexMovie: PlexMovie,
  ): ContentProgram {
    const file = first(first(plexMovie.Media)?.Part ?? []);
    return {
      type: 'content',
      externalSourceType: 'plex',
      externalSourceName: server.name,
      date: plexMovie.originallyAvailableAt,
      duration: plexMovie.duration,
      serverFilePath: file?.file,
      externalKey: plexMovie.ratingKey,
      // plexFilePath: file?.key,
      rating: plexMovie.contentRating,
      summary: plexMovie.summary,
      title: plexMovie.title,
      subtype: 'movie',
      year: plexMovie.year,
      // createdAt: +dayjs(),
      // updatedAt: +dayjs(),
    };
  }

  private mintRawProgramForPlexEpisode(
    serverName: string,
    plexEpisode: PlexEpisode,
  ): ContentProgram {
    const file = first(first(plexEpisode.Media)?.Part ?? []);
    return {
      externalSourceType: ExternalSourceTypeSchema.enum.plex,
      externalSourceName: serverName,
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
      subtype: ContentProgramTypeSchema.enum.episode,
      year: plexEpisode.year,
      showTitle: plexEpisode.grandparentTitle,
      showIcon: plexEpisode.grandparentThumb,
      seasonNumber: plexEpisode.parentIndex,
      episode: plexEpisode.index,
      parentExternalKey: plexEpisode.parentRatingKey,
      grandparentExternalKey: plexEpisode.grandparentRatingKey,
    };
  }

  private mintRawProgramForPlexTrack(
    serverName: string,
    plexTrack: PlexMusicTrack,
  ): ContentProgram {
    const file = first(first(plexTrack.Media)?.Part ?? []);
    return {
      sourceType: ProgramSourceType.PLEX,
      duration: plexTrack.duration,
      filePath: file?.file,
      externalSourceId: serverName,
      externalKey: plexTrack.ratingKey,
      plexRatingKey: plexTrack.ratingKey,
      plexFilePath: file?.key,
      summary: plexTrack.summary,
      title: plexTrack.title,
      type: 'content',
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

  private mintRawProgramForJellyfinItem(
    serverName: string,
    item: Omit<JellyfinItem, 'Type'> & { Type: 'Movie' | 'Episode' | 'Audio' },
  ): ContentProgram {
    return {
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
}
