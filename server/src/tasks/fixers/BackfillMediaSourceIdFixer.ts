import { inject, injectable } from 'inversify';
import { Kysely } from 'kysely';
import { DB } from '../../db/schema/db.ts';
import { KEYS } from '../../types/inject.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';
import Fixer from './fixer.ts';
import { ProgramGroupingTypes } from '@/db/schema/ProgramGrouping.js';
import { match } from 'ts-pattern';

@injectable()
export class BackfillMediaSourceIdFixer extends Fixer {
  constructor(
    @inject(KEYS.Logger) protected logger: Logger,
    @inject(KEYS.Database) private db: Kysely<DB>,
  ) {
    super();
  }

  protected async runInternal(): Promise<void> {
    await this.db
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

    await this.db
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

    await this.db
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

    for (const typ of ProgramGroupingTypes) {
      const field = match(typ)
        .returnType<'albumUuid' | 'artistUuid' | 'seasonUuid' | 'tvShowUuid'>()
        .with('album', () => 'albumUuid')
        .with('artist', () => 'artistUuid')
        .with('season', () => 'seasonUuid')
        .with('show', () => 'tvShowUuid')
        .exhaustive();

      await this.db
        .updateTable('programGrouping')
        .set({
          mediaSourceId: (eb) =>
            eb
              .selectFrom('program')
              .where('program.mediaSourceId', 'is not', null)
              .whereRef(`program.${field}`, '=', 'programGrouping.uuid')
              .select('program.mediaSourceId')
              .limit(1),
        })
        .where('programGrouping.mediaSourceId', 'is', null)
        .where('programGrouping.type', '=', typ)
        .execute();

      await this.db
        .updateTable('programGrouping')
        .set({
          sourceType: (eb) =>
            eb
              .selectFrom('program')
              .whereRef(`program.${field}`, '=', 'programGrouping.uuid')
              .select('program.sourceType')
              .limit(1),
        })
        .where('programGrouping.sourceType', 'is', null)
        .where('programGrouping.type', '=', typ)
        .execute();
    }
  }
}
