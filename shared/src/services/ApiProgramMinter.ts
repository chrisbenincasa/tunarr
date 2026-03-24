import type { TerminalProgram } from '@tunarr/types';
import {
  isEpisodeWithHierarchy,
  isMusicTrackWithHierarchy,
  tag,
  type ContentProgram,
  type ExternalId,
} from '@tunarr/types';
import { type EmbyItem } from '@tunarr/types/emby';
import { type JellyfinItem } from '@tunarr/types/jellyfin';
import { type PlexTerminalMedia } from '@tunarr/types/plex';
import {
  type ContentProgramOriginalProgram,
  type SingleExternalIdType,
} from '@tunarr/types/schemas';
import { isNil } from 'lodash-es';
import { match } from 'ts-pattern';
import { createExternalId } from '../index.js';
import { seq } from '../util/index.js';
import { parsePlexGuid } from '../util/plexUtil.js';

export class ApiProgramMinter {
  private constructor() {}

  static mintProgram2(item: TerminalProgram): ContentProgram | null {
    const id =
      item.sourceType === 'local'
        ? item.uuid
        : createExternalId(
            item.sourceType,
            tag(item.mediaSourceId),
            item.externalId,
          );
    const base = {
      duration: item.duration,
      persisted: false,
      type: 'content' as const,
      uniqueId: id,
      program: item,
    };
    switch (item.type) {
      case 'movie':
        return base;
      case 'episode': {
        if (!isEpisodeWithHierarchy(item)) {
          console.warn(
            'Episode program is missing hierarchy details and cannot be minted',
            item,
          );
          return null;
        }
        return base;
      }
      case 'track':
        if (!isMusicTrackWithHierarchy(item)) {
          console.warn(
            'Track program is missing hierarchy details and cannot be minted',
            item,
          );
          return null;
        }
        return base;
      case 'other_video':
        return base;
      case 'music_video':
        return base;
    }
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
