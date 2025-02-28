import { getDatabase } from '@/db/DBAccess.js';
import { ProgramType } from '@/db/schema/Program.js';
import { ProgramGroupingType } from '@/db/schema/ProgramGrouping.js';
import { KEYS } from '@/types/inject.js';
import { type Logger } from '@/util/logging/LoggerFactory.js';
import { inject, injectable } from 'inversify';
import Fixer from './fixer.ts';

// TODO: Handle Jellyfin items
// Generalize and reuse the calculator
@injectable()
export class BackfillProgramGroupings extends Fixer {
  constructor(@inject(KEYS.Logger) protected logger: Logger) {
    super();
  }

  protected async runInternal(): Promise<void> {
    // This clears out mismatches that might have happened on bugged earlier versions
    // There was a bug where we were setting the season ID to the show ID.
    // This should only affect seasons since the music album stuff had the fix
    console.log('backfill', getDatabase().transaction());
    const clearedSeasons = await getDatabase()
      .transaction()
      .execute((tx) =>
        tx
          .updateTable('program')
          .set(({ eb }) => ({
            seasonUuid: eb
              .case()
              .when(
                eb
                  .selectFrom('programGrouping')
                  .whereRef('programGrouping.uuid', '=', 'program.seasonUuid')
                  .where('programGrouping.type', '=', ProgramGroupingType.Show)
                  .select((eb) => eb.lit(1).as('true'))
                  .limit(1),
              )
              .then(null)
              .else(eb.ref('seasonUuid'))
              .end(),
          }))
          .executeTakeFirst(),
      );

    this.logger.debug(
      'Cleared %s bugged seasons',
      clearedSeasons.numChangedRows ?? clearedSeasons.numUpdatedRows ?? 0n,
    );

    // Update program -> show mappings with existing information
    const updatedShows = await getDatabase()
      .transaction()
      .execute((tx) =>
        tx
          .updateTable('program')
          .set(({ eb }) => ({
            tvShowUuid: eb
              .selectFrom('programGroupingExternalId')
              .whereRef(
                'programGroupingExternalId.externalSourceId',
                '=',
                'program.externalSourceId',
              )
              .whereRef(
                'programGroupingExternalId.externalKey',
                '=',
                'program.grandparentExternalKey',
              )
              .whereRef(
                'programGroupingExternalId.sourceType',
                '=',
                'program.sourceType',
              )

              .leftJoin(
                'programGrouping',
                'programGroupingExternalId.groupUuid',
                'programGrouping.uuid',
              )
              .select('programGrouping.uuid')
              .limit(1),
          }))
          .where((eb) =>
            eb.and([
              eb('program.type', '=', ProgramType.Episode),
              eb('program.grandparentExternalKey', 'is not', null),
              eb('program.tvShowUuid', 'is', null),
            ]),
          )
          .executeTakeFirst(),
      );

    this.logger.debug(
      'Fixed %s program->show mappings',
      updatedShows.numChangedRows ?? 0n,
    );

    // Update track -> artist mappings with existing information
    const updatedTrackArtists = await getDatabase()
      .transaction()
      .execute((tx) =>
        tx
          .updateTable('program')
          .set(({ eb }) => ({
            artistUuid: eb
              .selectFrom('programGroupingExternalId')
              .whereRef(
                'programGroupingExternalId.externalSourceId',
                '=',
                'program.externalSourceId',
              )
              .whereRef(
                'programGroupingExternalId.externalKey',
                '=',
                'program.grandparentExternalKey',
              )
              .whereRef(
                'programGroupingExternalId.sourceType',
                '=',
                'program.sourceType',
              )

              .leftJoin(
                'programGrouping',
                'programGroupingExternalId.groupUuid',
                'programGrouping.uuid',
              )
              .select('programGrouping.uuid')
              .limit(1),
          }))
          .where((eb) =>
            eb.and([
              eb('program.type', '=', ProgramType.Track),
              eb('program.grandparentExternalKey', 'is not', null),
              eb('program.artistUuid', 'is', null),
            ]),
          )
          .executeTakeFirst(),
      );

    this.logger.debug(
      'Fixed %s track->artist mappings',
      updatedTrackArtists.numChangedRows ?? 0n,
    );

    // Update show -> season mappings with existing information
    await getDatabase()
      .transaction()
      .execute(async (tx) => {
        const updatedSeasons = await tx
          .updateTable('program')
          .set(({ eb }) => ({
            seasonUuid: eb
              .selectFrom('programGroupingExternalId')
              .whereRef(
                'programGroupingExternalId.externalSourceId',
                '=',
                'program.externalSourceId',
              )
              .whereRef(
                'programGroupingExternalId.externalKey',
                '=',
                'program.parentExternalKey',
              )
              .whereRef(
                'programGroupingExternalId.sourceType',
                '=',
                'program.sourceType',
              )

              .leftJoin(
                'programGrouping',
                'programGroupingExternalId.groupUuid',
                'programGrouping.uuid',
              )
              .select('programGrouping.uuid')
              .limit(1),
          }))
          .where((eb) =>
            eb.and([
              eb('program.type', '=', ProgramType.Episode),
              eb('program.parentExternalKey', 'is not', null),
              eb('program.seasonUuid', 'is', null),
            ]),
          )
          .executeTakeFirst();

        this.logger.debug(
          'Fixed %s program->season mappings',
          updatedSeasons.numChangedRows ?? 0n,
        );

        const res = await tx
          .updateTable('programGrouping')
          .set(({ eb }) => ({
            showUuid: eb
              .selectFrom('program')
              .where('program.type', '=', 'episode')
              .where('program.grandparentExternalKey', 'is not', null)
              .innerJoin('programGroupingExternalId', (join) =>
                join
                  .onRef(
                    'programGroupingExternalId.externalSourceId',
                    '=',
                    'program.externalSourceId',
                  )
                  .onRef(
                    'programGroupingExternalId.sourceType',
                    '=',
                    'program.sourceType',
                  )
                  .onRef(
                    'programGroupingExternalId.externalKey',
                    '=',
                    'program.grandparentExternalKey',
                  ),
              )
              .innerJoin(
                'programGrouping',
                'programGrouping.uuid',
                'programGroupingExternalId.groupUuid',
              )
              .where('programGrouping.uuid', 'is not', null)
              .select('programGrouping.uuid')
              .limit(1),
          }))
          .where('programGrouping.type', '=', ProgramGroupingType.Season)
          .where('programGrouping.showUuid', 'is', null)
          .executeTakeFirst();

        this.logger.debug(
          'Fixed %s show->season associations',
          res.numChangedRows ?? 0n,
        );
      });

    // Update track -> album mappings with existing information
    await getDatabase()
      .transaction()
      .execute(async (tx) => {
        const updatedTracks = await tx
          .updateTable('program')
          .set(({ eb }) => ({
            albumUuid: eb
              .selectFrom('programGroupingExternalId')
              .whereRef(
                'programGroupingExternalId.externalSourceId',
                '=',
                'program.externalSourceId',
              )
              .whereRef(
                'programGroupingExternalId.externalKey',
                '=',
                'program.parentExternalKey',
              )
              .whereRef(
                'programGroupingExternalId.sourceType',
                '=',
                'program.sourceType',
              )
              .leftJoin(
                'programGrouping',
                'programGroupingExternalId.groupUuid',
                'programGrouping.uuid',
              )
              .select('programGrouping.uuid')
              .limit(1),
          }))
          .where((eb) =>
            eb.and([
              eb('program.type', '=', ProgramType.Track),
              eb('program.parentExternalKey', 'is not', null),
              eb('program.albumUuid', 'is', null),
            ]),
          )
          .executeTakeFirst();

        this.logger.debug(
          'Fixed %s track->album mappings',
          updatedTracks.numChangedRows ?? 0n,
        );

        const res = await tx
          .updateTable('programGrouping')
          .set(({ eb }) => ({
            artistUuid: eb
              .selectFrom('program')
              .where('program.type', '=', ProgramType.Track)
              .where('program.grandparentExternalKey', 'is not', null)
              .innerJoin('programGroupingExternalId', (join) =>
                join
                  .onRef(
                    'programGroupingExternalId.externalSourceId',
                    '=',
                    'program.externalSourceId',
                  )
                  .onRef(
                    'programGroupingExternalId.sourceType',
                    '=',
                    'program.sourceType',
                  )
                  .onRef(
                    'programGroupingExternalId.externalKey',
                    '=',
                    'program.grandparentExternalKey',
                  ),
              )
              .innerJoin(
                'programGrouping',
                'programGrouping.uuid',
                'programGroupingExternalId.groupUuid',
              )
              .where('programGrouping.uuid', 'is not', null)
              .select('programGrouping.uuid')
              .limit(1),
          }))
          .where('programGrouping.type', '=', ProgramGroupingType.Album)
          .where('programGrouping.artistUuid', 'is', null)
          .executeTakeFirst();

        this.logger.debug(
          'Fixed %s album->artist associations',
          res.numChangedRows ?? 0n,
        );
      });

    const stillMissing = await getDatabase()
      .selectFrom('program')
      .select(({ fn }) => fn.count<number>('program.uuid').as('count'))
      .where((eb) =>
        eb.or([
          eb.and([
            eb('type', '=', ProgramType.Episode),
            eb.or([eb('tvShowUuid', 'is', null), eb('seasonUuid', 'is', null)]),
          ]),
          eb.and([
            eb('type', '=', ProgramType.Track),
            eb.or([eb('albumUuid', 'is', null), eb('artistUuid', 'is', null)]),
          ]),
        ]),
      )
      .executeTakeFirst();

    if (stillMissing && stillMissing.count > 0) {
      this.logger.debug(
        'There are still %d programs with missing associations',
        stillMissing?.count,
      );
    }
  }
}
