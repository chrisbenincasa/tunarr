import type {
  MediaSourceLibraryUpdate,
  NewMediaSourceLibrary,
} from '@/db/schema/MediaSourceLibrary.js';
import { EmbyItem } from '@tunarr/types/emby';
import { JellyfinItem } from '@tunarr/types/jellyfin';
import { PlexLibrarySection } from '@tunarr/types/plex';
import { inject, injectable } from 'inversify';
import { isString } from 'lodash-es';
import { v4 } from 'uuid';
import { MediaSourceDB } from '../db/mediaSourceDB.js';
import { MediaSourceId } from '../db/schema/base.js';
import type { MediaSourceWithRelations } from '../db/schema/derivedTypes.js';
import type { MediaLibraryType } from '../db/schema/MediaSource.ts';
import { MediaSourceApiFactory } from '../external/MediaSourceApiFactory.js';
import { KEYS } from '../types/inject.ts';
import { Maybe } from '../types/util.ts';
import { groupByUniq, isDefined } from '../util/index.ts';
import { Logger } from '../util/logging/LoggerFactory.ts';
import { booleanToNumber } from '../util/sqliteUtil.ts';

@injectable()
export class MediaSourceLibraryRefresher {
  constructor(
    @inject(KEYS.Logger) private logger: Logger,
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

    const plexLibraries = plexLibrariesResult
      .get()
      .MediaContainer.Directory.filter((lib) =>
        isDefined(this.plexLibraryTypeToTunarrType(lib)),
      );
    const plexLibraryKeys = new Set(plexLibraries.map((lib) => lib.key));
    const existingLibraries = new Set(
      mediaSource.libraries.map((lib) => lib.externalKey),
    );
    const incomingLibrariesById = groupByUniq(plexLibraries, (lib) => lib.key);

    const newLibraries = plexLibraryKeys.difference(existingLibraries);
    const removedLibraries = existingLibraries.difference(plexLibraryKeys);
    const updatedLibraries = plexLibraryKeys.intersection(existingLibraries);

    const librariesToAdd: NewMediaSourceLibrary[] = [];
    for (const newLibraryKey of newLibraries) {
      const plexLibrary = plexLibraries.find(
        (lib) => lib.key === newLibraryKey,
      );
      if (!plexLibrary) {
        // Don't know why this would happen
        continue;
      }

      librariesToAdd.push({
        mediaSourceId: mediaSource.uuid,
        externalKey: plexLibrary.key,
        // Checked above
        mediaType: this.plexLibraryTypeToTunarrType(plexLibrary)!,
        uuid: v4(),
        enabled: booleanToNumber(false),
        name: plexLibrary.title,
      } satisfies NewMediaSourceLibrary);
    }

    const librariesToRemove = mediaSource.libraries.filter((existing) =>
      removedLibraries.has(existing.externalKey),
    );

    const librariesToUpdate = mediaSource.libraries
      .filter((existing) => updatedLibraries.has(existing.externalKey))
      .map((existing) => {
        const updatedApiLibrary = incomingLibrariesById[existing.externalKey];
        return {
          externalKey: existing.externalKey,
          name: updatedApiLibrary?.title ?? existing.name,
          mediaType: updatedApiLibrary
            ? this.plexLibraryTypeToTunarrType(updatedApiLibrary)
            : existing.mediaType,
          uuid: existing.uuid,
        } satisfies MediaSourceLibraryUpdate;
      });

    this.logger.debug(
      'Found %d new Plex libraries, %d removed libraries for media source %s',
      librariesToAdd.length,
      librariesToRemove.length,
      mediaSource.uuid,
    );

    await this.mediaSourceDB.updateLibraries({
      addedLibraries: librariesToAdd,
      deletedLibraries: librariesToRemove.map(({ uuid }) => uuid),
      updatedLibraries: librariesToUpdate,
    });
  }

  private plexLibraryTypeToTunarrType(
    plexLibrary: PlexLibrarySection,
  ): Maybe<MediaLibraryType> {
    switch (plexLibrary.type) {
      case 'movie':
        // Other video plex libraries have type=movie but a tv.plex.agents.none agent, AFAICT.
        return plexLibrary.agent.includes('none') ? 'other_videos' : 'movies';
      case 'show':
        return 'shows';
      case 'artist':
      case 'track':
        return 'tracks';
      case 'photo':
        return;
    }
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

    const jellyfinLibraries = jellyfinLibrariesResult
      .get()
      .filter(
        (lib) =>
          lib.CollectionType &&
          isDefined(this.jellyfinLibraryTypeToTunarrType(lib.CollectionType)),
      );
    this.logger.trace('Existing Jellyfin libraries: %O', mediaSource.libraries);
    const jellyfinLibraryKeys = new Set(
      jellyfinLibraries.map((lib) => lib.ItemId),
    );
    const existingLibraries = new Set(
      mediaSource.libraries.map((lib) => lib.externalKey),
    );

    const newLibraries = jellyfinLibraryKeys.difference(existingLibraries);
    const removedLibraries = existingLibraries.difference(jellyfinLibraryKeys);
    // const updatedLibraries =
    //   jellyfinLibraryKeys.intersection(existingLibraries);

    const librariesToAdd: NewMediaSourceLibrary[] = [];
    for (const newLibraryKey of newLibraries) {
      const jellyfinLibrary = jellyfinLibraries.find(
        (lib) => lib.ItemId === newLibraryKey,
      );
      if (!jellyfinLibrary) {
        // Don't know why this would happen
        continue;
      }

      librariesToAdd.push({
        mediaSourceId: mediaSource.uuid,
        externalKey: jellyfinLibrary.ItemId,
        // Checked above
        mediaType: this.jellyfinLibraryTypeToTunarrType(
          jellyfinLibrary.CollectionType,
        )!,
        uuid: v4(),
        enabled: booleanToNumber(false),
        name: jellyfinLibrary.Name ?? '',
      } satisfies NewMediaSourceLibrary);
    }

    const seenExternalIds = new Set<string>();
    const dupeLibrariesToRemove: string[] = [];
    for (const library of mediaSource.libraries) {
      if (seenExternalIds.has(library.externalKey)) {
        dupeLibrariesToRemove.push(library.uuid);
      } else {
        seenExternalIds.add(library.externalKey);
      }
    }

    const librariesToRemove = mediaSource.libraries.filter(
      (existing) =>
        removedLibraries.has(existing.externalKey) ||
        dupeLibrariesToRemove.includes(existing.uuid),
    );

    this.logger.debug(
      'Found %d new Jellyfin libraries, %d removed libraries for media source %s',
      librariesToAdd.length,
      librariesToRemove.length,
      mediaSource.uuid,
    );

    await this.mediaSourceDB.updateLibraries({
      addedLibraries: librariesToAdd,
      deletedLibraries: librariesToRemove.map(({ uuid }) => uuid),
      updatedLibraries: [],
    });
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

    if (embyLibrariesResult.get().Items.length === 0) {
      this.logger.error('Got no libraries from Emby server: %O', mediaSource);
      return;
    }

    const embyLibraries = embyLibrariesResult
      .get()
      .Items.filter(
        (lib) =>
          lib.CollectionType &&
          isDefined(this.embyLibraryTypeToTunarrType(lib.CollectionType)),
      );
    const embyLibraryKeys = new Set(embyLibraries.map((lib) => lib.Id));
    const existingLibraries = new Set(
      mediaSource.libraries.map((lib) => lib.externalKey),
    );

    const newLibraries = embyLibraryKeys.difference(existingLibraries);
    const removedLibraries = existingLibraries.difference(embyLibraryKeys);

    const librariesToAdd: NewMediaSourceLibrary[] = [];
    for (const newLibraryKey of newLibraries) {
      const embyLibrary = embyLibraries.find((lib) => lib.Id === newLibraryKey);
      if (!embyLibrary) {
        // Don't know why this would happen
        continue;
      }

      librariesToAdd.push({
        mediaSourceId: mediaSource.uuid,
        externalKey: embyLibrary.Id,
        // Checked above
        mediaType: this.embyLibraryTypeToTunarrType(
          embyLibrary.CollectionType,
        )!,
        uuid: v4(),
        enabled: booleanToNumber(false),
        name: embyLibrary.Name ?? '',
      } satisfies NewMediaSourceLibrary);
    }

    const librariesToRemove = mediaSource.libraries.filter((existing) =>
      removedLibraries.has(existing.externalKey),
    );

    this.logger.debug(
      'Found %d new Emby libraries, %d removed libraries for media source %s',
      librariesToAdd.length,
      librariesToRemove.length,
      mediaSource.uuid,
    );

    await this.mediaSourceDB.updateLibraries({
      addedLibraries: librariesToAdd,
      deletedLibraries: librariesToRemove.map(({ uuid }) => uuid),
      updatedLibraries: [],
    });
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
