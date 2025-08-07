import { inject, injectable } from 'inversify';
import PQueue from 'p-queue';
import { container } from '../../container.ts';
import { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import { KEYS } from '../../types/inject.ts';
import { Result } from '../../types/result.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';
import { GenericMediaSourceScannerFactory } from './MediaSourceScanner.ts';

@injectable()
export class MediaSourceScanCoordinator {
  private static queue: PQueue = new PQueue({ concurrency: 1 });

  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(MediaSourceDB) private mediaSourceDB: MediaSourceDB,
  ) {}

  async add({ libraryId, forceScan }: ScanRequest): Promise<boolean> {
    const library = await this.mediaSourceDB.getLibrary(libraryId);

    if (!library) {
      this.logger.error('No library found with ID %s', libraryId);
      return false;
    }

    const scanner = Result.attempt(() =>
      container.get<GenericMediaSourceScannerFactory>(
        KEYS.MediaSourceLibraryScanner,
      )(library.mediaSource.type, library.mediaType),
    ).orNull();

    if (!scanner) {
      this.logger.error('Could not create scanner for library: %O', library);
      return false;
    }

    MediaSourceScanCoordinator.queue
      .add(async () => {
        await scanner.scan({ library, force: forceScan });
      })
      .catch((e) =>
        this.logger.error(e, 'Error scanning library %s', library.uuid),
      );

    return true;
  }
}

type ScanRequest = {
  libraryId: string;
  forceScan: boolean;
};
