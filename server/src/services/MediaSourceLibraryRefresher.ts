import type { EmbyItem } from '@tunarr/types/emby';
import type { JellyfinItem } from '@tunarr/types/jellyfin';
import type { PlexLibrarySection } from '@tunarr/types/plex';
import { inject, injectable } from 'inversify';
import { isString } from 'lodash-es';
import { MediaSourceDB } from '../db/mediaSourceDB.js';
import type { MediaSourceId } from '../db/schema/base.js';
import type { MediaSourceWithRelations } from '../db/schema/derivedTypes.js';
import type { MediaLibraryType } from '../db/schema/MediaSource.ts';
import { MediaSourceApiFactory } from '../external/MediaSourceApiFactory.js';

import type { Maybe } from '../types/util.ts';
import { InjectLogger } from '../util/inject.ts';
import type { Logger } from '../util/logging/LoggerFactory.ts';
import {
  reconcileLibraries,
  type ReportedLibrary,
} from './reconcileLibraries.ts';

@injectable()
export class MediaSourceLibraryRefresher {
  @InjectLogger() declare private readonly logger: Logger;

  constructor(
    @inject(MediaSourceDB) private mediaSourceDB: MediaSourceDB,
    @inject(MediaSourceApiFactory)
    private mediaSourceApiFactory: MediaSourceApiFactory,
  ) {}

  async refreshAll() {
    const mediaSources = await this.mediaSourceDB.getAll();

    for (const mediaSource of mediaSources) {
      await this.refreshMediaSource(mediaSource);
    }

    return;
  }

  async refreshMediaSource(
    idOrSource: MediaSourceWithRelations | MediaSourceId,
  ) {
    let source: MediaSourceWithRelations;
    if (isString(idOrSource)) {
      const maybeSource = await this.mediaSourceDB.getById(idOrSource);
      if (!maybeSource) {
        this.logger.warn('No media source found for ID: %s', idOrSource);
        return;
      }
      source = maybeSource;
    } else {
      source = idOrSource;
    }

    switch (source.type) {
      case 'plex': {
        await this.handlePlex(source);
        break;
      }
      case 'jellyfin':
        await this.handleJellyfin(source);
        break;
      case 'emby':
        await this.handleEmby(source);
        break;
      case 'local':
        break;
    }

    return;
  }

  private async handlePlex(mediaSource: MediaSourceWithRelations) {
    const client =
      await this.mediaSourceApiFactory.getPlexApiClientForMediaSource(
        mediaSource,
      );
    const plexLibrariesResult = await client.getLibrariesRaw();

    if (plexLibrariesResult.isFailure()) {
      this.logger.error(
        plexLibrariesResult.error,
        'Failure fetching Plex libraries',
      );
      return;
    }

    const reported = plexLibrariesResult
      .get()
      .MediaContainer.Directory.flatMap((lib): ReportedLibrary[] => {
        const mediaType = this.plexLibraryTypeToTunarrType(lib);
        return mediaType
          ? [{ externalKey: lib.key, name: lib.title, mediaType }]
          : [];
      });

    await this.reconcile(mediaSource, 'Plex', reported);
  }

  private async handleJellyfin(mediaSource: MediaSourceWithRelations) {
    const client =
      await this.mediaSourceApiFactory.getJellyfinApiClientForMediaSource(
        mediaSource,
      );
    const jellyfinLibrariesResult = await client.getUserViewsRaw();

    if (jellyfinLibrariesResult.isFailure()) {
      this.logger.error(
        jellyfinLibrariesResult.error,
        'Failure fetching Jellyfin libraries',
      );
      return;
    }

    const reported = jellyfinLibrariesResult
      .get()
      .flatMap((lib): ReportedLibrary[] => {
        const mediaType = this.jellyfinLibraryTypeToTunarrType(
          lib.CollectionType,
        );
        return mediaType
          ? [{ externalKey: lib.ItemId, name: lib.Name ?? '', mediaType }]
          : [];
      });

    await this.reconcile(mediaSource, 'Jellyfin', reported);
  }

  private async handleEmby(mediaSource: MediaSourceWithRelations) {
    if (mediaSource.type !== 'emby') {
      return;
    }

    const client =
      await this.mediaSourceApiFactory.getEmbyApiClientForMediaSource(
        mediaSource,
      );
    const embyLibrariesResult = await client.getUserViewsRaw();

    if (embyLibrariesResult.isFailure()) {
      this.logger.error(
        embyLibrariesResult.error,
        'Failure fetching Emby libraries',
      );
      return;
    }

    const reported = embyLibrariesResult
      .get()
      .Items.flatMap((lib): ReportedLibrary[] => {
        const mediaType = this.embyLibraryTypeToTunarrType(lib.CollectionType);
        return mediaType
          ? [{ externalKey: lib.Id, name: lib.Name ?? '', mediaType }]
          : [];
      });

    await this.reconcile(mediaSource, 'Emby', reported);
  }

  private async reconcile(
    mediaSource: MediaSourceWithRelations,
    backend: string,
    reported: ReportedLibrary[],
  ) {
    const result = reconcileLibraries(mediaSource, reported, new Date());

    if (result.type === 'empty_response') {
      this.logger.error(
        '%s media source %s reported no supported libraries but %d are stored. The access token may be restricted or the server may still be starting. Stored libraries were left untouched.',
        backend,
        mediaSource.uuid,
        mediaSource.libraries.length,
      );
      return;
    }

    const storedById = new Map(
      mediaSource.libraries.map((library) => [library.uuid, library]),
    );

    // Counts are only queried on the transition to unavailable, so a
    // permanently removed library costs nothing on later runs.
    if (result.unavailableLibraries.length > 0) {
      const counts = new Map(
        (
          await this.mediaSourceDB.getLibraryReferenceCounts(
            result.unavailableLibraries.map(({ uuid }) => uuid),
          )
        ).map((count) => [count.libraryId, count]),
      );

      for (const { uuid } of result.unavailableLibraries) {
        this.logger.warn(
          "Library '%s' (key '%s') of media source '%s' is missing from the %s response; marking unavailable (%d programs, %d channel schedule entries preserved)",
          storedById.get(uuid)?.name,
          storedById.get(uuid)?.externalKey,
          mediaSource.uuid,
          backend,
          counts.get(uuid)?.programCount ?? 0,
          counts.get(uuid)?.channelProgramCount ?? 0,
        );
      }
    }

    for (const uuid of result.availableLibraries) {
      this.logger.info(
        "Library '%s' (key '%s') of media source '%s' is back in the %s response; marking available",
        storedById.get(uuid)?.name,
        storedById.get(uuid)?.externalKey,
        mediaSource.uuid,
        backend,
      );
    }

    for (const { keepUuid, duplicateUuids } of result.duplicateLibraries) {
      this.logger.warn(
        'Deleting duplicate libraries %O of media source %s after moving their programs to library %s',
        duplicateUuids,
        mediaSource.uuid,
        keepUuid,
      );
    }

    this.logger.debug(
      'Found %d new %s libraries for media source %s',
      result.addedLibraries.length,
      backend,
      mediaSource.uuid,
    );

    this.mediaSourceDB.updateLibraries(result);
  }

  private plexLibraryTypeToTunarrType(
    plexLibrary: PlexLibrarySection,
  ): Maybe<MediaLibraryType> {
    switch (plexLibrary.type) {
      case 'movie':
        // Other video plex libraries have type=movie but a tv.plex.agents.none agent, AFAICT.
        return plexLibrary.agent.includes('none') ? 'other_videos' : 'movies';
      case 'show':
      case 'episode':
        return 'shows';
      case 'artist':
      case 'track':
        return 'tracks';
      case 'photo':
        return;
    }
  }

  private jellyfinLibraryTypeToTunarrType(
    jellyfinLibraryType: JellyfinItem['CollectionType'],
  ): Maybe<MediaLibraryType> {
    switch (jellyfinLibraryType) {
      case 'movies':
        return 'movies';
      case 'tvshows':
        return 'shows';
      case 'musicvideos':
        return 'music_videos';
      case 'music':
        return 'tracks';
      case 'homevideos':
        return 'other_videos';
      default:
        return;
    }
  }

  private embyLibraryTypeToTunarrType(
    embyLibraryType: EmbyItem['CollectionType'],
  ): Maybe<MediaLibraryType> {
    switch (embyLibraryType) {
      case 'movies':
        return 'movies';
      case 'tvshows':
        return 'shows';
      case 'musicvideos':
        return 'music_videos';
      case 'music':
        return 'tracks';
      case 'homevideos':
        return 'other_videos';
      default:
        return;
    }
  }
}
