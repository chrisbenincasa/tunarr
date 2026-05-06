import { CustomShowDB } from '@/db/CustomShowDB.js';
import type { MediaSourceId } from '@/db/schema/base.js';
import { MediaSourceApiFactory } from '@/external/MediaSourceApiFactory.js';
import { KEYS } from '@/types/inject.js';
import { InjectLogger } from '@/util/inject.js';
import { Logger } from '@/util/logging/LoggerFactory.js';
import { MutexMap } from '@/util/mutexMap.js';
import { ApiProgramMinter } from '@tunarr/shared';
import { seq } from '@tunarr/shared/util';
import { isTerminalItemType, tag, type ContentProgram } from '@tunarr/types';
import { inject, injectable } from 'inversify';
import { PlexHierarchyTraversal } from './PlexItemEnumerator.ts';

@injectable()
export class CustomShowSyncService {
  @InjectLogger() private declare readonly logger: Logger;

  constructor(
    @inject(CustomShowDB) private customShowDB: CustomShowDB,
    @inject(MediaSourceApiFactory)
    private mediaSourceApiFactory: MediaSourceApiFactory,
    @inject(KEYS.MutexMap) private locks: MutexMap,
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
      this.customShowDB.upsertCustomShowContent(show.uuid, programs);
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

  private async fetchPlaylistPrograms(
    sourceType: string,
    mediaSourceId: MediaSourceId,
    playlistId: string,
  ): Promise<ContentProgram[]> {
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
  ): Promise<ContentProgram[]> {
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

    return seq.collect(expandedItems, (item) =>
      ApiProgramMinter.mintProgram(item),
    );
  }
}
