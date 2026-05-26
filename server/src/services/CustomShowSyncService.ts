import { CustomShowDB } from '@/db/CustomShowDB.js';
import type { IProgramDB } from '@/db/interfaces/IProgramDB.js';
import { MediaSourceDB } from '@/db/mediaSourceDB.js';
import type { MediaSourceId, RemoteSourceType } from '@/db/schema/base.js';
import type {
  MediaLibraryType,
  RemoteMediaSourceType,
} from '@/db/schema/MediaSource.js';
import { MediaSourceApiFactory } from '@/external/MediaSourceApiFactory.js';
import { KEYS } from '@/types/inject.js';
import { InjectLogger } from '@/util/inject.js';
import { Logger } from '@/util/logging/LoggerFactory.js';
import { MutexMap } from '@/util/mutexMap.js';
import { seq } from '@tunarr/shared/util';
import {
  CondensedContentProgram,
  isTerminalItemType,
  tag,
  type Episode,
  type MusicTrack,
  type TerminalProgram,
} from '@tunarr/types';
import { inject, injectable } from 'inversify';
import { groupBy } from 'lodash-es';
import { PlexHierarchyTraversal } from './PlexItemEnumerator.ts';
import type { GenericMediaSourceScannerFactory } from './scanner/MediaSourceScanner.ts';

@injectable()
export class CustomShowSyncService {
  @InjectLogger() declare private readonly logger: Logger;

  constructor(
    @inject(CustomShowDB) private customShowDB: CustomShowDB,
    @inject(MediaSourceApiFactory)
    private mediaSourceApiFactory: MediaSourceApiFactory,
    @inject(KEYS.MutexMap) private locks: MutexMap,
    @inject(KEYS.MediaSourceLibraryScanner)
    private scannerFactory: GenericMediaSourceScannerFactory,
    @inject(KEYS.ProgramDB) private programDB: IProgramDB,
    @inject(MediaSourceDB) private mediaSourceDB: MediaSourceDB,
  ) {}

  async syncAll(): Promise<void> {
    const syncedShows = await this.customShowDB.getSyncedShows();

    if (syncedShows.length === 0) {
      this.logger.debug('No synced custom shows to process');
      return;
    }

    this.logger.info('Syncing %d custom show(s)', syncedShows.length);

    for (const show of syncedShows) {
      try {
        await this.locks.runWithLockId(show.uuid, () =>
          this.syncShow(show.uuid),
        );
      } catch (e) {
        this.logger.error(
          e,
          'Failed to sync custom show %s (%s)',
          show.name,
          show.uuid,
        );
      }
    }
  }

  async syncShow(customShowId: string): Promise<void> {
    const show = await this.customShowDB.getShow(customShowId);
    if (!show) {
      throw new Error(`Custom show ${customShowId} not found`);
    }

    if (
      !show.syncMediaSourceId ||
      !show.syncMediaSourceType ||
      !show.syncExternalPlaylistId
    ) {
      throw new Error(`Custom show ${show.name} is not configured for sync`);
    }

    this.logger.info(
      'Syncing custom show "%s" from %s playlist %s',
      show.name,
      show.syncMediaSourceType,
      show.syncExternalPlaylistId,
    );

    const programs = await this.fetchPlaylistPrograms(
      show.syncMediaSourceType,
      tag<MediaSourceId>(show.syncMediaSourceId),
      show.syncExternalPlaylistId,
    );

    if (programs.length > 0) {
      await this.ensureProgramsExist(
        tag<MediaSourceId>(show.syncMediaSourceId),
        programs,
      );
      await this.customShowDB.upsertCustomShowContent(
        show.uuid,
        programs.map(
          (program) =>
            ({
              duration: program.duration,
              id: program.uuid,
              type: 'content',
            }) satisfies CondensedContentProgram,
        ),
      );
    } else {
      this.logger.warn(
        'Got 0 items from external playlist (type = %s id = %s)',
        show.syncMediaSourceType,
        show.syncExternalPlaylistId,
      );
    }

    await this.customShowDB.updateLastSyncedAt(show.uuid);

    this.logger.info(
      'Synced custom show "%s" with %d program(s)',
      show.name,
      programs.length,
    );
  }

  isShowSyncing(id: string) {
    return this.locks.isLocked(id);
  }

  private async ensureProgramsExist(
    mediaSourceId: MediaSourceId,
    programs: TerminalProgram[],
  ): Promise<void> {
    const mediaSource = await this.mediaSourceDB.getById(mediaSourceId);
    if (!mediaSource) {
      throw new Error(`Media source ${mediaSourceId} not found`);
    }

    const librariesById = new Map(
      mediaSource.libraries.map((lib) => [lib.uuid, lib]),
    );

    const sourceType = mediaSource.type as RemoteMediaSourceType;

    // Group programs by terminal type so we can select the right scanner
    const programsByType = groupBy(programs, (p) => p.type);

    for (const [type, typePrograms] of Object.entries(programsByType)) {
      const programType = type as TerminalProgram['type'];
      const libraryType = terminalTypeToLibraryType(programType);
      const scanner = this.scannerFactory(sourceType, libraryType);

      switch (programType) {
        case 'episode': {
          // scanSingle for shows takes the show's externalId, so group
          // episodes by their parent show and scan once per show.
          const byShow = groupBy(
            typePrograms as Episode[],
            (ep) => `${ep.libraryId}:${ep.show?.externalId}`,
          );
          for (const [, episodes] of Object.entries(byShow)) {
            const showExternalId = (episodes[0] as Episode).show?.externalId;
            if (showExternalId === undefined) {
              this.logger.warn(
                'Episode %s has no show externalId, skipping',
                episodes[0]!.externalId,
              );
              continue;
            }
            const library = librariesById.get(episodes[0]!.libraryId);
            if (!library) continue;
            const result = await scanner.scanSingle({
              library,
              externalId: showExternalId,
            });
            if (result.isFailure()) {
              this.logger.warn(
                result.error,
                'Failed to scan show %s',
                showExternalId,
              );
            }
          }
          break;
        }
        case 'track': {
          // scanSingle for music takes the artist's externalId, so group
          // tracks by their parent artist and scan once per artist.
          const byArtist = groupBy(
            typePrograms as MusicTrack[],
            (t) => `${t.libraryId}:${t.artist?.externalId}`,
          );
          for (const [, tracks] of Object.entries(byArtist)) {
            const artistExternalId = (tracks[0] as MusicTrack).artist
              ?.externalId;
            if (artistExternalId === undefined) {
              this.logger.warn(
                'Track %s has no artist externalId, skipping',
                tracks[0]!.externalId,
              );
              continue;
            }
            const library = librariesById.get(tracks[0]!.libraryId);
            if (!library) continue;
            const result = await scanner.scanSingle({
              library,
              externalId: artistExternalId,
            });
            if (result.isFailure()) {
              this.logger.warn(
                result.error,
                'Failed to scan artist %s',
                artistExternalId,
              );
            }
          }
          break;
        }
        default: {
          // movies, other_videos, music_videos — scan each individually
          for (const program of typePrograms) {
            const library = librariesById.get(program.libraryId);
            if (!library) continue;
            const result = await scanner.scanSingle({
              library,
              externalId: program.externalId,
            });
            if (result.isFailure()) {
              this.logger.warn(
                result.error,
                'Failed to scan %s %s',
                programType,
                program.externalId,
              );
            }
          }
          break;
        }
      }
    }

    // After scanning, look up the Tunarr DB UUIDs for all programs
    const lookupIds = new Set(
      programs.map(
        (p) =>
          [
            p.sourceType as RemoteSourceType,
            mediaSourceId,
            p.externalId,
          ] as const,
      ),
    );
    const dbPrograms = await this.programDB.lookupByExternalIds(lookupIds);
    const keyToUuid = new Map(
      dbPrograms.map((p) => [
        `${p.sourceType}:${p.externalSourceId}:${p.externalKey}`,
        p.uuid,
      ]),
    );

    for (const program of programs) {
      const key = `${program.sourceType}:${program.mediaSourceId}:${program.externalId}`;
      const dbUuid = keyToUuid.get(key);
      if (dbUuid !== undefined) {
        program.uuid = dbUuid;
      }
    }
  }

  private async fetchPlaylistPrograms(
    sourceType: string,
    mediaSourceId: MediaSourceId,
    playlistId: string,
  ): Promise<TerminalProgram[]> {
    switch (sourceType) {
      case 'plex':
        return this.fetchPlexPlaylistPrograms(mediaSourceId, playlistId);
      default:
        throw new Error(`Unsupported sync source type: ${sourceType}`);
    }
  }

  private async fetchPlexPlaylistPrograms(
    mediaSourceId: MediaSourceId,
    playlistId: string,
  ): Promise<TerminalProgram[]> {
    const client =
      await this.mediaSourceApiFactory.getPlexApiClientById(mediaSourceId);

    if (!client) {
      throw new Error(
        `Could not get Plex client for media source ${mediaSourceId}`,
      );
    }

    const result = await client.getItemChildren(playlistId, 'playlist');

    const items = result.getOrThrow();

    const allPlaylistItems = seq.collect(items, (item) => {
      if (!isTerminalItemType(item)) {
        return null;
      }
      return item;
    });

    const expandedItems = await new PlexHierarchyTraversal(
      client,
    ).expandAncestors(allPlaylistItems);

    return expandedItems;
  }
}

function terminalTypeToLibraryType(
  type: TerminalProgram['type'],
): MediaLibraryType {
  switch (type) {
    case 'movie':
      return 'movies';
    case 'episode':
      return 'shows';
    case 'track':
      return 'tracks';
    case 'other_video':
      return 'other_videos';
    case 'music_video':
      return 'music_videos';
  }
}
