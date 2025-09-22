import type { Tag } from '@tunarr/types';
import { inject, injectable } from 'inversify';
import { MediaSourceDB } from '../db/mediaSourceDB.ts';
import { MediaSourceScanCoordinator } from '../services/scanner/MediaSourceScanCoordinator.ts';
import { KEYS } from '../types/inject.ts';
import { Logger } from '../util/logging/LoggerFactory.ts';
import type { TaskMetadata } from './Task.ts';
import { Task } from './Task.ts';

@injectable()
export class ScanLibrariesTask extends Task {
  static KEY = Symbol.for(ScanLibrariesTask.name);
  static ID = ScanLibrariesTask.name;
  public ID = ScanLibrariesTask.ID as Tag<
    typeof ScanLibrariesTask.name,
    TaskMetadata
  >;

  constructor(
    @inject(KEYS.Logger) logger: Logger,
    @inject(MediaSourceDB) private mediaSourceDB: MediaSourceDB,
    @inject(MediaSourceScanCoordinator)
    private coordinator: MediaSourceScanCoordinator,
  ) {
    super(logger);
  }

  protected async runInternal(): Promise<unknown> {
    const allSources = await this.mediaSourceDB.getAll();

    // Very simple impl - we can probably fan out by source
    for (const source of allSources) {
      if (source.type === 'local') {
        const scheduled = await this.coordinator.addLocal({
          mediaSourceId: source.uuid,
          forceScan: false,
        });

        if (!scheduled) {
          this.logger.warn(
            'Unable to schedule local media source ID %s for scanning',
            source.uuid,
          );
        }
      } else {
        for (const library of source.libraries) {
          if (!library.enabled) {
            this.logger.debug('Skipping disabled library: %O', library);
            continue;
          }

          const scheduled = await this.coordinator.add({
            libraryId: library.uuid,
            forceScan: false,
          });

          if (!scheduled) {
            this.logger.warn(
              'Unable to schedule library ID %s for scanning',
              library.uuid,
            );
          }
        }
      }
    }

    return;
  }
}
