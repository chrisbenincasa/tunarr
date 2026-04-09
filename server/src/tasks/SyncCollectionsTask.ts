import type { Tag } from '@tunarr/types';
import { inject, injectable } from 'inversify';
import { MediaSourceDB } from '../db/mediaSourceDB.ts';
import type { MediaSourceType } from '../db/schema/base.ts';
import type { GenericExternalCollectionScanner } from '../services/scanner/ExternalCollectionScanner.ts';
import { KEYS } from '../types/inject.ts';
import type { Maybe } from '../types/util.ts';
import { InjectLogger } from '../util/inject.ts';
import { Logger } from '../util/logging/LoggerFactory.ts';
import type { TaskMetadata } from './Task.ts';
import { SimpleTask } from './Task.ts';
import { simpleTaskDef } from './TaskRegistry.ts';

@injectable()
@simpleTaskDef({
  description:
    'Syncs collections from all configured external media sources (Plex, Jellyfin, Emby)',
})
export class SyncCollectionsTask extends SimpleTask {
  static KEY = Symbol.for(SyncCollectionsTask.name);
  static ID = SyncCollectionsTask.name;
  public ID = SyncCollectionsTask.ID as Tag<
    typeof SyncCollectionsTask.name,
    TaskMetadata
  >;

  @InjectLogger() declare protected readonly logger: Logger;

  constructor(
    @inject(MediaSourceDB) private mediaSourceDB: MediaSourceDB,
    @inject(KEYS.ExternalCollectionScannerFactory)
    private collectionScannerFactory: (
      sourceType: MediaSourceType,
    ) => Maybe<GenericExternalCollectionScanner>,
  ) {
    super();
  }

  protected async runInternal(): Promise<void> {
    const allSources = await this.mediaSourceDB.getAll();

    for (const source of allSources) {
      if (source.type === 'local') {
        continue;
      }

      const scanner = this.collectionScannerFactory(source.type);
      if (!scanner) {
        this.logger.warn(
          'No collection scanner available for media source type %s',
          source.type,
        );
        continue;
      }

      this.logger.info(
        'Scanning collections for %s media source %s (ID = %s)',
        source.type,
        source.name,
        source.uuid,
      );

      try {
        await scanner.scan({
          mediaSourceId: source.uuid,
        });
      } catch (e) {
        this.logger.error(
          e,
          'Error scanning collections for %s media source %s (ID = %s)',
          source.type,
          source.name,
          source.uuid,
        );
      }
    }
  }
}
