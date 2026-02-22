import { inject, injectable } from 'inversify';
import { IProgramDB } from '../db/interfaces/IProgramDB.ts';
import { ProgramOrm } from '../db/schema/Program.ts';
import { ProgramGroupingOrm } from '../db/schema/ProgramGrouping.ts';
import { MediaSourceScanCoordinator } from '../services/scanner/MediaSourceScanCoordinator.ts';
import {
  GenericBadRequestError,
  GenericError,
  GenericNotFoundError,
} from '../types/errors.ts';
import { KEYS } from '../types/inject.ts';
import { Result } from '../types/result.ts';
import { Maybe } from '../types/util.ts';
import { Command } from './Command.ts';

@injectable()
export class ForceScanCommand implements Command<string, Result<void>> {
  constructor(
    @inject(KEYS.ProgramDB) private programDB: IProgramDB,
    @inject(MediaSourceScanCoordinator)
    private mediaSourceScanCoordinator: MediaSourceScanCoordinator,
  ) {}

  async run(id: string): Promise<Result<void>> {
    let program: Maybe<ProgramGroupingOrm | ProgramOrm> =
      await this.programDB.getProgramById(id);
    if (!program) {
      program = await this.programDB.getProgramGrouping(id);
    }
    if (!program) {
      return Result.forError(new GenericNotFoundError(id, 'program'));
    }

    if (!program.libraryId) {
      return Result.forError(
        new GenericBadRequestError(
          `Program ${id} does not have a library ID set.`,
        ),
      );
    } else if (!program.externalKey) {
      return Result.forError(
        new GenericBadRequestError(
          `Program ${id} does not have an external key set`,
        ),
      );
    } else if (program.sourceType === 'local' && !program.mediaSourceId) {
      return Result.forError(
        new GenericBadRequestError(
          `Program ${id} is a local program but has no media source ID set.`,
        ),
      );
    }

    const queued =
      program.sourceType === 'local'
        ? await this.mediaSourceScanCoordinator.addLocal({
            forceScan: true,
            mediaSourceId: program.mediaSourceId!,
            pathFilter: program.externalKey,
          })
        : await this.mediaSourceScanCoordinator.add({
            forceScan: true,
            libraryId: program.libraryId,
            pathFilter: program.externalKey,
          });

    if (!queued) {
      return Result.forError(
        new GenericError(`Failed to queue program ${id} for scanning`),
      );
    }

    return Result.void();
  }
}
