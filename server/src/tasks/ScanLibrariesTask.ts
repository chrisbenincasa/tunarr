import type { Tag } from '@tunarr/types';
import { inject, injectable } from 'inversify';
import z from 'zod';
import { MediaSourceDB } from '../db/mediaSourceDB.ts';
import { MediaSourceScanCoordinator } from '../services/scanner/MediaSourceScanCoordinator.ts';
import { InjectLogger } from '../util/inject.ts';
import type { Logger } from '../util/logging/LoggerFactory.ts';
import type { Maybe } from '../types/util.ts';
import type { TaskMetadata } from './Task.ts';
import { Task2 } from './Task.ts';
import { taskDef } from './TaskRegistry.ts';

const ScanLibrariesTaskRequest = z
  .object({
    // Omitted means every media source.
    mediaSourceIds: z.array(z.string()).optional(),
  })
  .optional();

export type ScanLibrariesTaskRequest = z.infer<typeof ScanLibrariesTaskRequest>;

@injectable()
@taskDef({
  description: 'Initiates a scan of all enabled libraries and media sources',
  schema: ScanLibrariesTaskRequest,
})
export class ScanLibrariesTask extends Task2<typeof ScanLibrariesTaskRequest> {
  static KEY = Symbol.for(ScanLibrariesTask.name);
  static ID = ScanLibrariesTask.name;
  public ID = ScanLibrariesTask.ID as Tag<
    typeof ScanLibrariesTask.name,
    TaskMetadata
  >;
  schema = ScanLibrariesTaskRequest;

  @InjectLogger() declare protected readonly logger: Logger;

  constructor(
    @inject(MediaSourceDB) private mediaSourceDB: MediaSourceDB,
    @inject(MediaSourceScanCoordinator)
    private coordinator: MediaSourceScanCoordinator,
  ) {
    super();
  }

  protected async runInternal(
    request: Maybe<ScanLibrariesTaskRequest>,
  ): Promise<void> {
    const allSources = await this.mediaSourceDB.getAll();
    const sourceIds = request?.mediaSourceIds;
    const sources = sourceIds
      ? allSources.filter((source) => sourceIds.includes(source.uuid))
      : allSources;

    // Very simple impl - we can probably fan out by source
    for (const source of sources) {
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
