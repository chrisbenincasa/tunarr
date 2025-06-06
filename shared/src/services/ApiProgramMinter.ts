import {
  type ContentProgram,
  type ExternalId,
  type MultiExternalId,
  type SingleExternalId,
} from '@tunarr/types';
import { type EmbyItem } from '@tunarr/types/emby';
import { type JellyfinItem } from '@tunarr/types/jellyfin';
import {
  type PlexEpisode,
  type PlexMovie,
  type PlexMusicTrack,
  type PlexTerminalMedia,
} from '@tunarr/types/plex';
import {
  type ContentProgramOriginalProgram,
  ContentProgramTypeSchema,
  ExternalSourceTypeSchema,
  type SingleExternalIdType,
} from '@tunarr/types/schemas';
import { compact, find, first, isError, isNil } from 'lodash-es';
import type { StrictOmit } from 'ts-essentials';
import { P, match } from 'ts-pattern';
import { createExternalId } from '../index.js';
import { nullToUndefined, seq } from '../util/index.js';
import { parsePlexGuid } from '../util/plexUtil.js';

type MediaSourceDetails = { id: string; name: string };

export class ApiProgramMinter {
  private constructor() {}
  /**
   * Creates an non-persisted, ephemeral ContentProgram for the given
   * EnrichedPlexMedia. These are handed off to the server to persist
   * to the database (if they don't already exist). They are also useful
   * in order to deal with a common type for programming throughout other
   * parts of the UI
   */
  static mintProgram(
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
          program: {
            Type: P.union('Movie', 'Audio', 'Episode', 'Video', 'MusicVideo'),
          },
        },
        ({ program }) => this.mintProgramForJellyfinItem(mediaSource, program),
      )
      .with(
        {
          sourceType: 'emby',
          program: {
            Type: P.union('Movie', 'Audio', 'Episode', 'Video', 'MusicVideo'),
          },
        },
        ({ program }) => this.mintProgramForEmbyItem(mediaSource, program),
      )
      .otherwise(() => new Error('Unexpected program type'));
    if (isError(ret)) {
      throw ret;
    }
    return ret;
  }

  private static mintFromPlexMovie(
    server: MediaSourceDetails,
    plexMovie: PlexMovie,
  ): ContentProgram {
    const id = createExternalId('plex', server.name, plexMovie.ratingKey);
    const file = first(first(plexMovie.Media)?.Part ?? []);
    return {
      type: 'content',
      externalSourceType: 'plex',
      externalSourceId: server.id,
      externalSourceName: server.name,
      date: plexMovie.originallyAvailableAt,
      duration: plexMovie.duration ?? 0,
      serverFileKey: file?.key,
      serverFilePath: file?.file,
      externalKey: plexMovie.ratingKey,
      rating: plexMovie.contentRating,
      summary: plexMovie.summary,
      title: plexMovie.title,
      subtype: 'movie',
      persisted: false,
      externalIds: this.mintExternalIdsForPlex(server.name, plexMovie),
      uniqueId: id,
      id,
    };
  }

  private static mintFromPlexEpisode(
    server: MediaSourceDetails,
    plexEpisode: PlexEpisode,
  ): ContentProgram {
    const id = createExternalId('plex', server.name, plexEpisode.ratingKey);
    const file = first(first(plexEpisode.Media)?.Part ?? []);
    return {
      date: plexEpisode.originallyAvailableAt,
      duration: plexEpisode.duration ?? 0,
      index: plexEpisode.index,
      externalKey: plexEpisode.ratingKey,
      externalSourceName: server.name,
      externalSourceId: server.id,
      externalSourceType: ExternalSourceTypeSchema.enum.plex,
      parent: {
        title: plexEpisode.parentTitle,
        index: plexEpisode.parentIndex,
        externalKey: plexEpisode.parentRatingKey,
        guids: plexEpisode.parentGuid ? [plexEpisode.parentGuid] : [],
        externalIds: compact([
          plexEpisode.parentRatingKey
            ? ({
                type: 'multi',
                id: plexEpisode.parentRatingKey,
                source: 'plex',
                sourceId: server.name,
              } satisfies MultiExternalId)
            : null,
          plexEpisode.parentGuid
            ? ({
                type: 'single',
                id: plexEpisode.parentGuid,
                source: 'plex-guid',
              } satisfies SingleExternalId)
            : null,
        ]),
      },
      grandparent: {
        title: plexEpisode.grandparentTitle,
        externalKey: plexEpisode.grandparentRatingKey,
        guids: plexEpisode.grandparentGuid ? [plexEpisode.grandparentGuid] : [],
        externalIds: compact([
          plexEpisode.grandparentRatingKey
            ? ({
                type: 'multi',
                id: plexEpisode.grandparentRatingKey,
                source: 'plex',
                sourceId: server.name,
              } satisfies MultiExternalId)
            : null,
          plexEpisode.grandparentGuid
            ? ({
                type: 'single',
                id: plexEpisode.grandparentGuid,
                source: 'plex-guid',
              } satisfies SingleExternalId)
            : null,
        ]),
      },
      rating: plexEpisode.contentRating,
      seasonNumber: plexEpisode.parentIndex,
      serverFilePath: file?.file,
      subtype: ContentProgramTypeSchema.enum.episode,
      summary: plexEpisode.summary,
      title: plexEpisode.title,
      type: 'content',
      externalIds: this.mintExternalIdsForPlex(server.name, plexEpisode),
      persisted: false,
      id: id,
      uniqueId: id,
    };
  }

  private static mintFromPlexMusicTrack(
    server: MediaSourceDetails,
    plexTrack: PlexMusicTrack,
  ): ContentProgram {
    const id = createExternalId('plex', server.name, plexTrack.ratingKey);
    const file = first(first(plexTrack.Media)?.Part ?? []);
    return {
      duration: plexTrack.duration ?? 0,
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
        externalIds: compact([
          plexTrack.parentRatingKey
            ? ({
                type: 'multi',
                id: plexTrack.parentRatingKey,
                source: 'plex',
                sourceId: server.name,
              } satisfies MultiExternalId)
            : null,
          plexTrack.parentGuid
            ? ({
                type: 'single',
                id: plexTrack.parentGuid,
                source: 'plex-guid',
              } satisfies SingleExternalId)
            : null,
        ]),
      },
      grandparent: {
        title: plexTrack.grandparentTitle,
        externalKey: plexTrack.grandparentRatingKey,
        guids: plexTrack.grandparentGuid ? [plexTrack.grandparentGuid] : [],
        externalIds: compact([
          plexTrack.grandparentRatingKey
            ? ({
                type: 'multi',
                id: plexTrack.grandparentRatingKey,
                source: 'plex',
                sourceId: server.name,
              } satisfies MultiExternalId)
            : null,
          plexTrack.grandparentGuid
            ? ({
                type: 'single',
                id: plexTrack.grandparentGuid,
                source: 'plex-guid',
              } satisfies SingleExternalId)
            : null,
        ]),
      },
      seasonNumber: plexTrack.parentIndex,
      serverFilePath: file?.file,
      subtype: ContentProgramTypeSchema.enum.track,
      summary: plexTrack.summary,
      title: plexTrack.title,
      type: 'content',
      externalIds: this.mintExternalIdsForPlex(server.name, plexTrack),
      persisted: false,
      uniqueId: id,
      id,
      externalSourceId: server.id,
    };
  }

  private static mintProgramForJellyfinItem(
    server: MediaSourceDetails,
    item: Omit<JellyfinItem, 'Type'> & {
      Type: 'Movie' | 'Episode' | 'Audio' | 'Video' | 'MusicVideo';
    },
  ): ContentProgram {
    const id = createExternalId('jellyfin', server.name, item.Id);
    const parentIdentifier = item.ParentId ?? item.SeasonId ?? item.AlbumId;
    const grandparentIdentifier = item.SeriesId ?? item.AlbumArtist;
    return {
      externalSourceType: ExternalSourceTypeSchema.enum.jellyfin,
      date: nullToUndefined(item.PremiereDate),
      duration: (item.RunTimeTicks ?? 0) / 10_000,
      externalSourceId: server.id,
      externalKey: item.Id,
      rating: nullToUndefined(item.OfficialRating),
      summary: nullToUndefined(item.Overview),
      title: item.Name ?? '',
      type: 'content',
      subtype: match(item.Type)
        .with('Movie', () => ContentProgramTypeSchema.enum.movie)
        .with('MusicVideo', () => ContentProgramTypeSchema.enum.music_video)
        .with('Video', () => ContentProgramTypeSchema.enum.other_video)
        .with('Episode', () => ContentProgramTypeSchema.enum.episode)
        .with('Audio', () => ContentProgramTypeSchema.enum.track)
        .exhaustive(),
      year: nullToUndefined(item.ProductionYear),
      parent: {
        title: nullToUndefined(item.SeasonName ?? item.Album),
        index: nullToUndefined(item.ParentIndexNumber),
        externalKey: nullToUndefined(parentIdentifier),
        externalIds: compact([
          parentIdentifier
            ? ({
                type: 'multi',
                id: parentIdentifier,
                source: 'jellyfin',
                sourceId: server.name,
              } satisfies MultiExternalId)
            : null,
        ]),
      },
      grandparent: {
        title: nullToUndefined(item.SeriesName ?? item.AlbumArtist),
        externalKey:
          item.SeriesId ??
          find(item.AlbumArtists, { Name: item.AlbumArtist })?.Id,
        externalIds: compact([
          grandparentIdentifier
            ? ({
                type: 'multi',
                id: grandparentIdentifier,
                source: 'jellyfin',
                sourceId: server.name,
              } satisfies MultiExternalId)
            : null,
        ]),
      },
      seasonNumber: nullToUndefined(item.ParentIndexNumber),
      episodeNumber: nullToUndefined(item.IndexNumber),
      index: nullToUndefined(item.IndexNumber),
      externalIds: this.mintExternalIdsForJellyfin(server.name, item),
      uniqueId: id,
      id,
      externalSourceName: server.name,
      persisted: false,
    };
  }

  private static mintProgramForEmbyItem(
    server: MediaSourceDetails,
    item: StrictOmit<EmbyItem, 'Type'> & {
      Type: 'Movie' | 'Episode' | 'Audio' | 'Video' | 'MusicVideo';
    },
  ): ContentProgram {
    const id = createExternalId('emby', server.name, item.Id);
    const parentIdentifier = item.ParentId ?? item.SeasonId ?? item.AlbumId;
    const grandparentIdentifier = item.SeriesId ?? item.AlbumArtist;
    return {
      externalSourceType: ExternalSourceTypeSchema.enum.emby,
      date: nullToUndefined(item.PremiereDate),
      duration: (item.RunTimeTicks ?? 0) / 10_000,
      externalSourceId: server.id,
      externalKey: item.Id,
      rating: nullToUndefined(item.OfficialRating),
      summary: nullToUndefined(item.Overview),
      title: item.Name ?? '',
      type: 'content',
      subtype: match(item.Type)
        .with('Movie', () => ContentProgramTypeSchema.enum.movie)
        .with('MusicVideo', () => ContentProgramTypeSchema.enum.music_video)
        .with('Video', () => ContentProgramTypeSchema.enum.other_video)
        .with('Episode', () => ContentProgramTypeSchema.enum.episode)
        .with('Audio', () => ContentProgramTypeSchema.enum.track)
        .exhaustive(),
      year: nullToUndefined(item.ProductionYear),
      parent: {
        title: nullToUndefined(item.SeasonName ?? item.Album),
        index: nullToUndefined(item.ParentIndexNumber),
        externalKey: nullToUndefined(parentIdentifier),
        externalIds: compact([
          parentIdentifier
            ? ({
                type: 'multi',
                id: parentIdentifier,
                source: 'emby',
                sourceId: server.name,
              } satisfies MultiExternalId)
            : null,
        ]),
      },
      grandparent: {
        title: nullToUndefined(item.SeriesName ?? item.AlbumArtist),
        externalKey:
          item.SeriesId ??
          find(item.AlbumArtists, { Name: item.AlbumArtist })?.Id?.toString(),
        externalIds: compact([
          grandparentIdentifier
            ? ({
                type: 'multi',
                id: grandparentIdentifier,
                source: 'plex',
                sourceId: server.name,
              } satisfies MultiExternalId)
            : null,
        ]),
      },
      seasonNumber: nullToUndefined(item.ParentIndexNumber),
      episodeNumber: nullToUndefined(item.IndexNumber),
      index: nullToUndefined(item.IndexNumber),
      externalIds: this.mintExternalIdsForEmby(server.name, item),
      uniqueId: id,
      id,
      externalSourceName: server.name,
      persisted: false,
    };
  }

  static mintExternalIds(
    serverName: string,
    originalProgram: ContentProgramOriginalProgram,
  ): ExternalId[] {
    return match(originalProgram)
      .with({ sourceType: 'plex' }, ({ program: originalProgram }) =>
        this.mintExternalIdsForPlex(serverName, originalProgram),
      )
      .with({ sourceType: 'jellyfin' }, ({ program: originalProgram }) =>
        this.mintExternalIdsForJellyfin(serverName, originalProgram),
      )
      .with({ sourceType: 'emby' }, ({ program: originalProgram }) =>
        this.mintExternalIdsForEmby(serverName, originalProgram),
      )
      .exhaustive();
  }

  static mintExternalIdsForPlex(
    serverName: string,
    media: PlexTerminalMedia,
  ): ExternalId[] {
    // const file = first(first(media.Media)?.Part ?? []);
    // TODO: add file details and stuff.
    const ratingId = {
      source: 'plex',
      id: media.ratingKey,
      sourceId: serverName,
      type: 'multi',
    } satisfies ExternalId;

    const guidId = {
      type: 'single',
      source: 'plex-guid',
      id: media.guid,
    } satisfies ExternalId;

    const externalGuids = seq.collect(media.Guid, (externalGuid) => {
      // Plex returns these in a URI form, so we can attempt to parse them
      return parsePlexGuid(externalGuid.id);
    });

    return [ratingId, guidId, ...externalGuids];
  }

  static mintJellyfinExternalId(serverName: string, media: JellyfinItem) {
    return {
      type: 'multi',
      id: media.Id,
      source: 'jellyfin',
      sourceId: serverName,
    } satisfies ExternalId;
  }

  static mintEmbyExternalId(serverName: string, media: EmbyItem) {
    return {
      type: 'multi',
      id: media.Id,
      source: 'emby',
      sourceId: serverName,
    } satisfies ExternalId;
  }

  static mintExternalIdsForJellyfin(
    serverName: string,
    media: JellyfinItem,
  ): ExternalId[] {
    const ratingId = this.mintJellyfinExternalId(serverName, media);

    const externalGuids = seq.collectMapValues(
      media.ProviderIds,
      (externalGuid, guidType) => {
        if (isNil(externalGuid)) {
          return;
        }

        let source: SingleExternalIdType | null = null;
        const normalizedType = guidType.toLowerCase();
        switch (normalizedType) {
          case 'tmdb':
          case 'imdb':
          case 'tvdb':
            source = normalizedType as SingleExternalIdType;
            break;
          default:
            return null;
        }

        if (source) {
          return {
            id: externalGuid,
            source,
            type: 'single',
          } satisfies ExternalId;
        }

        return;
      },
    );

    return [ratingId, ...externalGuids];
  }

  static mintExternalIdsForEmby(
    serverName: string,
    media: EmbyItem,
  ): ExternalId[] {
    const ratingId = this.mintEmbyExternalId(serverName, media);

    const externalGuids = seq.collectMapValues(
      media.ProviderIds,
      (externalGuid, guidType) => {
        if (isNil(externalGuid)) {
          return;
        }

        let source: SingleExternalIdType | null = null;
        const normalizedType = guidType.toLowerCase();
        switch (normalizedType) {
          case 'tmdb':
          case 'imdb':
          case 'tvdb':
            source = normalizedType as SingleExternalIdType;
            break;
          default:
            return null;
        }

        if (source) {
          return {
            id: externalGuid,
            source,
            type: 'single',
          } satisfies ExternalId;
        }

        return;
      },
    );

    return [ratingId, ...externalGuids];
  }
}
