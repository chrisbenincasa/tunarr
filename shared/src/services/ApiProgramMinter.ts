import type {
  EpisodeWithHierarchy,
  Identifier,
  Movie,
  MusicTrackWithHierarchy,
  MusicVideo,
  OtherVideo,
  TerminalProgram,
} from '@tunarr/types';
import {
  isEpisodeWithHierarchy,
  isMusicTrackWithHierarchy,
  tag,
  type ContentProgram,
  type ExternalId,
  type MultiExternalId,
  type SingleExternalId,
} from '@tunarr/types';
import { type EmbyItem } from '@tunarr/types/emby';
import { type JellyfinItem } from '@tunarr/types/jellyfin';
import { type PlexTerminalMedia } from '@tunarr/types/plex';
import {
  ContentProgramTypeSchema,
  isValidMultiExternalIdType,
  isValidSingleExternalIdType,
  type ContentProgramOriginalProgram,
  type SingleExternalIdType,
} from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import { compact, isNil } from 'lodash-es';
import { match } from 'ts-pattern';
import { createExternalId } from '../index.js';
import { isNonEmptyString, seq } from '../util/index.js';
import { parsePlexGuid } from '../util/plexUtil.js';

export class ApiProgramMinter {
  private constructor() {}

  static mintProgram2(item: TerminalProgram): ContentProgram | null {
    switch (item.type) {
      case 'movie':
        return this.mintForMovie(item);
      case 'episode': {
        if (!isEpisodeWithHierarchy(item)) {
          return null;
        }
        return this.mintForEpisode(item);
      }
      case 'track':
        if (!isMusicTrackWithHierarchy(item)) {
          return null;
        }
        return this.mintForTrack(item);
      case 'other_video':
        return this.mintForOtherVideo(item);
      case 'music_video':
        return this.mintForMusicVideo(item);
    }
  }

  private static mintForMovie(movie: Movie): ContentProgram {
    const id =
      movie.sourceType === 'local'
        ? movie.uuid
        : createExternalId(
            movie.sourceType,
            tag(movie.mediaSourceId),
            movie.externalId,
          );
    return {
      type: 'content',
      externalSourceType: movie.sourceType,
      externalSourceId: movie.mediaSourceId,
      externalSourceName: '',
      date: movie.releaseDateString ?? undefined,
      duration: movie.duration ?? 0,
      externalKey: movie.externalId,
      rating: movie.rating ?? undefined,
      summary: movie.summary ?? undefined,
      title: movie.title,
      subtype: 'movie',
      persisted: false,
      externalIds: identifiersToExternalIds(movie.identifiers),
      uniqueId: id,
      id,
      canonicalId: movie.canonicalId,
      libraryId: movie.libraryId,
    };
  }

  private static mintForMusicVideo(musicVideo: MusicVideo): ContentProgram {
    const id =
      musicVideo.sourceType === 'local'
        ? musicVideo.uuid
        : createExternalId(
            musicVideo.sourceType,
            tag(musicVideo.mediaSourceId),
            musicVideo.externalId,
          );
    return {
      type: 'content',
      externalSourceType: musicVideo.sourceType,
      externalSourceId: musicVideo.mediaSourceId,
      externalSourceName: '',
      date: musicVideo.releaseDateString ?? undefined,
      duration: musicVideo.duration ?? 0,
      externalKey: musicVideo.externalId,
      // rating: musicVideo.rating ?? undefined,
      // summary: musicVideo.summary ?? undefined,
      title: musicVideo.title,
      subtype: 'movie',
      persisted: false,
      externalIds: identifiersToExternalIds(musicVideo.identifiers),
      uniqueId: id,
      id,
      canonicalId: musicVideo.canonicalId,
      libraryId: musicVideo.libraryId,
    };
  }

  private static mintForOtherVideo(otherVideo: OtherVideo): ContentProgram {
    const id =
      otherVideo.sourceType === 'local'
        ? otherVideo.uuid
        : createExternalId(
            otherVideo.sourceType,
            tag(otherVideo.mediaSourceId),
            otherVideo.externalId,
          );
    return {
      type: 'content',
      externalSourceType: otherVideo.sourceType,
      externalSourceId: otherVideo.mediaSourceId,
      externalSourceName: '',
      date: otherVideo.releaseDateString ?? undefined,
      duration: otherVideo.duration ?? 0,
      externalKey: otherVideo.externalId,
      // rating: otherVideo.rating ?? undefined,
      // summary: otherVideo.summary ?? undefined,
      title: otherVideo.title,
      subtype: 'movie',
      persisted: false,
      externalIds: identifiersToExternalIds(otherVideo.identifiers),
      uniqueId: id,
      id,
      canonicalId: otherVideo.canonicalId,
      libraryId: otherVideo.libraryId,
    };
  }

  private static mintForEpisode(episode: EpisodeWithHierarchy): ContentProgram {
    const id =
      episode.sourceType === 'local'
        ? episode.uuid
        : createExternalId(
            episode.sourceType,
            tag(episode.mediaSourceId),
            episode.externalId,
          );

    const season = episode.season;
    const show = season.show;

    return {
      date: episode.releaseDate
        ? dayjs(episode.releaseDate).format()
        : undefined,
      duration: episode.duration ?? 0,
      index: episode.episodeNumber,
      externalKey: episode.externalId,
      externalSourceName: '',
      externalSourceId: episode.mediaSourceId,
      externalSourceType: episode.sourceType,
      parent: {
        title: season.title,
        index: season.index,
        externalKey: season.externalId,
        // Plex-specific
        guids: compact([
          season.identifiers.find(({ type }) => type === 'plex-guid')?.id,
        ]),
        type: 'season',
        summary: season.summary ?? undefined,
        externalIds: identifiersToExternalIds(season.identifiers),
        year: season.year ?? undefined,
      },
      grandparent: {
        title: show.title,
        externalKey: show.externalId,
        guids: compact([
          show.identifiers.find(({ type }) => type === 'plex-guid')?.id,
        ]),
        type: 'show',
        externalIds: identifiersToExternalIds(show.identifiers),
        summary: show.summary ?? undefined,
        year: show.year ?? undefined,
      },
      rating: show.rating ?? undefined,
      seasonNumber: season.index,
      // serverFilePath: file?.file,
      subtype: ContentProgramTypeSchema.enum.episode,
      summary: episode.summary ?? undefined,
      title: episode.title,
      type: 'content',
      externalIds: identifiersToExternalIds(episode.identifiers),
      persisted: false,
      id: id,
      uniqueId: id,
      canonicalId: episode.canonicalId,
      libraryId: episode.libraryId,
    };
  }

  private static mintForTrack(track: MusicTrackWithHierarchy): ContentProgram {
    const id =
      track.sourceType === 'local'
        ? track.uuid
        : createExternalId(
            track.sourceType,
            tag(track.mediaSourceId),
            track.externalId,
          );

    const album = track.album;
    const artist = album.artist;

    return {
      date: track.releaseDate ? dayjs(track.releaseDate).format() : undefined,
      duration: track.duration ?? 0,
      index: track.trackNumber,
      externalKey: track.externalId,
      externalSourceName: '',
      externalSourceId: track.mediaSourceId,
      externalSourceType: track.sourceType,
      parent: {
        title: album.title,
        index: album.index,
        externalKey: album.externalId,
        // Plex-specific
        guids: compact([
          album.identifiers.find(({ type }) => type === 'plex-guid')?.id,
        ]),
        type: 'season',
        summary: album.summary ?? undefined,
        externalIds: identifiersToExternalIds(album.identifiers),
        year: album.year ?? undefined,
      },
      grandparent: {
        title: artist.title,
        externalKey: artist.externalId,
        guids: compact([
          artist.identifiers.find(({ type }) => type === 'plex-guid')?.id,
        ]),
        type: 'show',
        externalIds: identifiersToExternalIds(artist.identifiers),
        summary: artist.summary ?? undefined,
      },
      // rating: artist.rating ?? undefined,
      seasonNumber: album.index,
      // serverFilePath: file?.file,
      subtype: ContentProgramTypeSchema.enum.episode,
      // summary: track.summary ?? undefined,
      title: track.title,
      type: 'content',
      externalIds: identifiersToExternalIds(track.identifiers),
      persisted: false,
      id: id,
      uniqueId: id,
      canonicalId: track.canonicalId,
      libraryId: track.libraryId,
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

function identifiersToExternalIds(identifiers: Identifier[]): ExternalId[] {
  return seq.collect(identifiers, (id) => {
    if (isValidMultiExternalIdType(id.type) && isNonEmptyString(id.sourceId)) {
      return {
        type: 'multi',
        sourceId: id.sourceId,
        source: id.type,
        id: id.id,
      } satisfies MultiExternalId;
    } else if (isValidSingleExternalIdType(id.type)) {
      return {
        type: 'single',
        id: id.id,
        source: id.type,
      } satisfies SingleExternalId;
    }
    return;
  });
}
