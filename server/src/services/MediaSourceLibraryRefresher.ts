import { JellyfinItem } from '@tunarr/types/jellyfin';
import { PlexLibrarySection } from '@tunarr/types/plex';
import { inject, injectable } from 'inversify';
import { isString } from 'lodash-es';
import { v4 } from 'uuid';
import { MediaSourceDB } from '../db/mediaSourceDB.js';
import type {
  MediaLibraryType,
  NewMediaSourceLibrary,
} from '../db/schema/MediaSource.ts';
import type { MediaSourceWithLibraries } from '../db/schema/derivedTypes.js';
import { MediaSourceApiFactory } from '../external/MediaSourceApiFactory.js';
import { KEYS } from '../types/inject.ts';
import { Maybe } from '../types/util.ts';
import { isDefined } from '../util/index.ts';
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

  async refreshMediaSource(idOrSource: MediaSourceWithLibraries | string) {
    let source: MediaSourceWithLibraries;
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
        break;
    }

    return;
  }

  private async handlePlex(mediaSource: MediaSourceWithLibraries) {
    const client =
      await this.mediaSourceApiFactory.getPlexApiClientForMediaSource(
        mediaSource,
      );
    const plexLibrariesResult = await client.getLibraries();

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
        isDefined(this.plexLibraryTypeToTunarrType(lib.type)),
      );
    const plexLibraryKeys = new Set(plexLibraries.map((lib) => lib.key));
    const existingLibraries = new Set(
      mediaSource.libraries.map((lib) => lib.externalKey),
    );

    const newLibraries = plexLibraryKeys.difference(existingLibraries);
    const removedLibraries = existingLibraries.difference(plexLibraryKeys);
    // const updatedLibraries = plexLibraryKeys.intersection(existingLibraries);

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
        mediaType: this.plexLibraryTypeToTunarrType(plexLibrary.type)!,
        uuid: v4(),
        enabled: booleanToNumber(false),
        name: plexLibrary.title,
      } satisfies NewMediaSourceLibrary);
    }

    const librariesToRemove = mediaSource.libraries.filter((existing) =>
      removedLibraries.has(existing.externalKey),
    );

    // nothing really to update yet
    // const librariesToUpdate = mediaSource.libraries.filter(existing => updatedLibraries.has(existing.externalKey)).map(existing => {
    //   return {

    //   } satisfies MediaSourceLibraryUpdate
    // })

    this.logger.debug(
      'Found %d new Plex libraries, %d removed libraries for media source %s',
      librariesToAdd.length,
      librariesToRemove.length,
      mediaSource.uuid,
    );

    await this.mediaSourceDB.updateLibraries({
      addedLibraries: librariesToAdd,
      deletedLibraries: librariesToRemove,
      updatedLibraries: [],
    });
  }

  private plexLibraryTypeToTunarrType(
    plexLibraryType: PlexLibrarySection['type'],
  ): Maybe<MediaLibraryType> {
    switch (plexLibraryType) {
      case 'movie':
        return 'movies';
      case 'show':
        return 'shows';
      case 'artist':
        return 'tracks';
      case 'photo':
        return;
    }
  }

  private async handleJellyfin(mediaSource: MediaSourceWithLibraries) {
    const client =
      await this.mediaSourceApiFactory.getJellyfinApiClientForMediaSource(
        mediaSource,
      );
    const jellyfinLibrariesResult = await client.getUserViews();

    if (jellyfinLibrariesResult.isFailure()) {
      this.logger.error(
        jellyfinLibrariesResult.error,
        'Failure fetching Jellyfin libraries',
      );
      return;
    }

    const jellyfinLibraries = jellyfinLibrariesResult
      .get()
      .Items.filter(
        (lib) =>
          lib.CollectionType &&
          isDefined(this.jellyfinLibraryTypeToTunarrType(lib.CollectionType)),
      );
    const jellyfinLibraryKeys = new Set(jellyfinLibraries.map((lib) => lib.Id));
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
        (lib) => lib.Id === newLibraryKey,
      );
      if (!jellyfinLibrary) {
        // Don't know why this would happen
        continue;
      }

      librariesToAdd.push({
        mediaSourceId: mediaSource.uuid,
        externalKey: jellyfinLibrary.Id,
        // Checked above
        mediaType: this.jellyfinLibraryTypeToTunarrType(
          jellyfinLibrary.CollectionType,
        )!,
        uuid: v4(),
        enabled: booleanToNumber(false),
        name: jellyfinLibrary.Name ?? '',
      } satisfies NewMediaSourceLibrary);
    }

    const librariesToRemove = mediaSource.libraries.filter((existing) =>
      removedLibraries.has(existing.externalKey),
    );

    this.logger.debug(
      'Found %d new Jellyfin libraries, %d removed libraries for media source %s',
      librariesToAdd.length,
      librariesToRemove.length,
      mediaSource.uuid,
    );

    await this.mediaSourceDB.updateLibraries({
      addedLibraries: librariesToAdd,
      deletedLibraries: librariesToRemove,
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
}
