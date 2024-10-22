import { ContentProgram } from '@tunarr/types';
import { JellyfinItem } from '@tunarr/types/jellyfin';
import { PlexEpisode, PlexMovie, PlexMusicTrack } from '@tunarr/types/plex';
import {
  ContentProgramOriginalProgram,
  ContentProgramTypeSchema,
  ExternalSourceTypeSchema,
} from '@tunarr/types/schemas';
import { find, first, isError } from 'lodash-es';
import { P, match } from 'ts-pattern';
import { createExternalId } from '../index.js';
import { nullToUndefined } from '../util/index.js';

type MediaSourceDetails = { id: string; name: string };

export class ProgramMinter {
  /**
   * Creates an non-persisted, ephemeral ContentProgram for the given
   * EnrichedPlexMedia. These are handed off to the server to persist
   * to the database (if they don't already exist). They are also useful
   * in order to deal with a common type for programming throughout other
   * parts of the UI
   */

  mintProgram(
    mediaSource: { id: string; name: string },
    program: ContentProgramOriginalProgram,
  ): ContentProgram {
    const ret = match(program)
      .with(
        { sourceType: 'plex', program: { type: 'movie' } },
        ({ program: movie }) => this.mintFromPlexMovie(mediaSource, movie),
      )
      .with(
        { sourceType: 'plex', program: { type: 'episode' } },
        ({ program: episode }) =>
          this.mintFromPlexEpisode(mediaSource, episode),
      )
      .with(
        { sourceType: 'plex', program: { type: 'track' } },
        ({ program: track }) => this.mintFromPlexMusicTrack(mediaSource, track),
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

  private mintFromPlexMovie(
    server: MediaSourceDetails,
    plexMovie: PlexMovie,
  ): ContentProgram {
    const file = first(first(plexMovie.Media)?.Part ?? []);
    return {
      type: 'content',
      externalSourceType: 'plex',
      externalSourceName: server.name,
      date: plexMovie.originallyAvailableAt,
      duration: plexMovie.duration,
      serverFileKey: file?.key,
      serverFilePath: file?.file,
      externalKey: plexMovie.ratingKey,
      rating: plexMovie.contentRating,
      summary: plexMovie.summary,
      title: plexMovie.title,
      subtype: 'movie',
      persisted: false,
      externalIds: [], // mint,
      externalSourceId: server.name,
      uniqueId: createExternalId('plex', server.name, plexMovie.ratingKey),
    };
  }

  private mintFromPlexEpisode(
    server: MediaSourceDetails,
    plexEpisode: PlexEpisode,
  ): ContentProgram {
    const file = first(first(plexEpisode.Media)?.Part ?? []);
    return {
      date: plexEpisode.originallyAvailableAt,
      duration: plexEpisode.duration,
      index: plexEpisode.index,
      externalKey: plexEpisode.ratingKey,
      externalSourceName: server.name,
      externalSourceId: server.name,
      externalSourceType: ExternalSourceTypeSchema.enum.plex,
      parent: {
        title: plexEpisode.parentTitle,
        index: plexEpisode.parentIndex,
        externalKey: plexEpisode.parentRatingKey,
        guids: plexEpisode.parentGuid ? [plexEpisode.parentGuid] : [],
      },
      grandparent: {
        title: plexEpisode.grandparentTitle,
        externalKey: plexEpisode.grandparentRatingKey,
        guids: plexEpisode.grandparentGuid ? [plexEpisode.grandparentGuid] : [],
      },
      rating: plexEpisode.contentRating,
      seasonNumber: plexEpisode.parentIndex,
      serverFilePath: file?.file,
      subtype: ContentProgramTypeSchema.enum.episode,
      summary: plexEpisode.summary,
      title: plexEpisode.title,
      type: 'content',
      externalIds: [], // MINT
      persisted: false,
      uniqueId: createExternalId('plex', server.name, plexEpisode.ratingKey),
    };
  }

  private mintFromPlexMusicTrack(
    server: MediaSourceDetails,
    plexTrack: PlexMusicTrack,
  ): ContentProgram {
    const file = first(first(plexTrack.Media)?.Part ?? []);
    return {
      duration: plexTrack.duration,
      index: plexTrack.index,
      externalKey: plexTrack.ratingKey,
      externalSourceName: server.name,
      externalSourceType: ExternalSourceTypeSchema.enum.plex,
      parent: {
        title: plexTrack.parentTitle,
        index: plexTrack.parentIndex,
        externalKey: plexTrack.parentRatingKey,
        guids: plexTrack.parentGuid ? [plexTrack.parentGuid] : [],
        year: plexTrack.parentYear,
      },
      grandparent: {
        title: plexTrack.grandparentTitle,
        externalKey: plexTrack.grandparentRatingKey,
        guids: plexTrack.grandparentGuid ? [plexTrack.grandparentGuid] : [],
      },
      // grandparentExternalKey: plexTrack.grandparentRatingKey,
      // grandparentTitle: plexTrack.grandparentTitle,
      seasonNumber: plexTrack.parentIndex,
      serverFilePath: file?.file,
      subtype: ContentProgramTypeSchema.enum.track,
      summary: plexTrack.summary,
      title: plexTrack.title,
      type: 'content',
      externalIds: [], // MINT
      persisted: false,
      uniqueId: createExternalId('plex', server.name, plexTrack.ratingKey),
      externalSourceId: server.name,
    };
  }

  private mintRawProgramForJellyfinItem(
    server: MediaSourceDetails,
    item: Omit<JellyfinItem, 'Type'> & { Type: 'Movie' | 'Episode' | 'Audio' },
  ): ContentProgram {
    return {
      externalSourceType: ExternalSourceTypeSchema.enum.jellyfin,
      date: nullToUndefined(item.PremiereDate),
      duration: (item.RunTimeTicks ?? 0) / 10_000,
      externalSourceId: server.name,
      externalKey: item.Id,
      rating: nullToUndefined(item.OfficialRating),
      summary: nullToUndefined(item.Overview),
      title: item.Name ?? '',
      type: 'content',
      subtype: match(item.Type)
        .with('Movie', () => ContentProgramTypeSchema.enum.movie)
        .with('Episode', () => ContentProgramTypeSchema.enum.episode)
        .with('Audio', () => ContentProgramTypeSchema.Enum.track)
        .exhaustive(),
      year: nullToUndefined(item.ProductionYear),
      parent: {
        title: nullToUndefined(item.SeasonName ?? item.Album),
        index: nullToUndefined(item.ParentIndexNumber),
        externalKey: nullToUndefined(
          item.ParentId ?? item.SeasonId ?? item.AlbumId,
        ),
      },
      grandparent: {
        title: nullToUndefined(item.SeriesName ?? item.AlbumArtist),
        externalKey:
          item.SeriesId ??
          find(item.AlbumArtists, { Name: item.AlbumArtist })?.Id,
      },
      seasonNumber: nullToUndefined(item.ParentIndexNumber),
      episodeNumber: nullToUndefined(item.IndexNumber),
      index: nullToUndefined(item.IndexNumber),
      externalIds: [], // MINT
      uniqueId: createExternalId('jellyfin', server.name, item.Id),
      externalSourceName: server.name,
      persisted: false,
    };
  }

  // private mintPlexProgramParentExternalIds(
  //   server: MediaSourceDetails,
  //   item: PlexEpisode | PlexMusicTrack,
  // ) {}
}
