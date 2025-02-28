import { inject, injectable } from 'inversify';
import { getDatabase } from '../../db/DBAccess.ts';
import { KEYS } from '../../types/inject.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';
import Fixer from './fixer.ts';

@injectable()
export class BackfillMediaSourceIdFixer extends Fixer {
  constructor(@inject(KEYS.Logger) protected logger: Logger) {
    super();
  }

  protected async runInternal(): Promise<void> {
    const db = getDatabase();

    await db
      .updateTable('program')
      .set({
        mediaSourceId: (eb) =>
          eb
            .selectFrom('mediaSource')
            .whereRef('mediaSource.name', '=', 'program.externalSourceId')
            .whereRef('mediaSource.type', '=', 'program.sourceType')
            .select('mediaSource.uuid')
            .limit(1),
      })
      .where('program.mediaSourceId', 'is', null)
      .execute();

    await db
      .updateTable('programExternalId')
      .set({
        mediaSourceId: (eb) =>
          eb
            .selectFrom('mediaSource')
            .whereRef(
              'mediaSource.name',
              '=',
              'programExternalId.externalSourceId',
            )
            .whereRef('mediaSource.type', '=', 'programExternalId.sourceType')
            .select('mediaSource.uuid')
            .limit(1),
      })
      .where('programExternalId.mediaSourceId', 'is', null)
      .where('programExternalId.sourceType', 'in', ['plex', 'emby', 'jellyfin'])
      .execute();

    await db
      .updateTable('programGroupingExternalId')
      .set({
        mediaSourceId: (eb) =>
          eb
            .selectFrom('mediaSource')
            .whereRef(
              'mediaSource.name',
              '=',
              'programGroupingExternalId.externalSourceId',
            )
            .whereRef(
              'mediaSource.type',
              '=',
              'programGroupingExternalId.sourceType',
            )
            .select('mediaSource.uuid')
            .limit(1),
      })
      .where('programGroupingExternalId.mediaSourceId', 'is', null)
      .where('programGroupingExternalId.sourceType', 'in', [
        'plex',
        'emby',
        'jellyfin',
      ])
      .execute();
  }
}
