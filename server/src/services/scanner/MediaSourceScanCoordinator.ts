import { E_ALREADY_LOCKED, tryAcquire } from 'async-mutex';
import { inject, injectable } from 'inversify';
import PQueue from 'p-queue';
import { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import { KEYS } from '../../types/inject.ts';
import { Result } from '../../types/result.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';
import { EntityMutex } from '../EntityMutex.ts';
import { GenericMediaSourceScannerFactory } from './MediaSourceScanner.ts';

@injectable()
export class MediaSourceScanCoordinator {
  private static queue: PQueue = new PQueue({ concurrency: 1 });

  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(MediaSourceDB) private mediaSourceDB: MediaSourceDB,
    @inject(EntityMutex) private entityMutex: EntityMutex,
    @inject(KEYS.MediaSourceLibraryScanner)
    private scannerFactory: GenericMediaSourceScannerFactory,
  ) {}

  async add({ libraryId, forceScan }: ScanRequest): Promise<boolean> {
    const library = await this.mediaSourceDB.getLibrary(libraryId);

    if (!library) {
      this.logger.error('No library found with ID %s', libraryId);
      return false;
    }

    try {
      const lock = tryAcquire(
        await this.entityMutex.getLockForLibrary(library),
      );
      const releaser = await lock.acquire();
      const scanner = Result.attempt(() =>
        this.scannerFactory(library.mediaSource.type, library.mediaType),
      ).orNull();

      if (!scanner) {
        this.logger.error('Could not create scanner for library: %O', library);
        return false;
      }

      MediaSourceScanCoordinator.queue
        .add(async () => {
          try {
            await scanner.scan({ library, force: forceScan });
          } finally {
            releaser();
          }
        })
        .catch((e) =>
          this.logger.error(e, 'Error scanning library %s', library.uuid),
        );

      return true;
    } catch (e) {
      if (e === E_ALREADY_LOCKED) {
        this.logger.error(
          'Could not acquire lock for library: %s',
          library.uuid,
        );
      } else {
        this.logger.error(
          e,
          'Error while scheduling scan for library: %s',
          library.uuid,
        );
      }
      return false;
    }
  }
}

type ScanRequest = {
  libraryId: string;
  forceScan: boolean;
};
