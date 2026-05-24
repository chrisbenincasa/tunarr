import { ProgramDaoMinter } from '@/db/converters/ProgramMinter.js';
import { CustomShowDB } from '@/db/CustomShowDB.js';
import type { IProgramDB } from '@/db/interfaces/IProgramDB.js';
import { MediaSourceDB } from '@/db/mediaSourceDB.js';
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
import { castArray } from 'lodash-es';
import { PlexHierarchyTraversal } from './PlexItemEnumerator.ts';

@injectable()
export class CustomShowSyncService {
  @InjectLogger() declare private readonly logger: Logger;

  constructor(
    @inject(CustomShowDB) private customShowDB: CustomShowDB,
    @inject(MediaSourceApiFactory)
    private mediaSourceApiFactory: MediaSourceApiFactory,
    @inject(KEYS.MutexMap) private locks: MutexMap,
    @inject(KEYS.ProgramDB) private programDB: IProgramDB,
    @inject(ProgramDaoMinter) private programMinter: ProgramDaoMinter,
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

  /**
   * Ensures that the programs referenced by the given ContentProgram[]
   * exist in the program table, upserting them if necessary. Mutates
   * each ContentProgram's `id` to match the actual DB UUID.
   */
  private async ensureProgramsExist(
    mediaSourceId: MediaSourceId,
    programs: ContentProgram[],
  ): Promise<void> {
    const mediaSource = await this.mediaSourceDB.getById(mediaSourceId);
    if (!mediaSource) {
      throw new Error(`Media source ${mediaSourceId} not found`);
    }

    const librariesById = new Map(
      mediaSource.libraries.map((lib) => [lib.uuid, lib]),
    );

    const mintedPrograms = seq.collect(programs, (cp) => {
      const library = librariesById.get(cp.program.libraryId);
      if (!library) {
        this.logger.warn(
          'Library %s not found for program %s, skipping upsert',
          cp.program.libraryId,
          cp.id,
        );
        return null;
      }
      return this.programMinter.mint(mediaSource, library, cp.program);
    });

    if (mintedPrograms.length === 0) {
      return;
    }

    const upserted = castArray(
      await this.programDB.upsertPrograms(mintedPrograms),
    );

    // Build a lookup from (sourceType, mediaSourceId, externalKey) -> actual DB UUID
    const keyToUuid = new Map(
      upserted.map((p) => [
        `${p.sourceType}:${p.mediaSourceId}:${p.externalKey}`,
        p.uuid,
      ]),
    );

    // Update each ContentProgram's id to match the actual DB UUID
    for (const cp of programs) {
      const key = `${cp.program.sourceType}:${cp.program.mediaSourceId}:${cp.program.externalId}`;
      const actualUuid = keyToUuid.get(key);
      if (actualUuid !== undefined) {
        cp.id = actualUuid;
      }
    }
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
