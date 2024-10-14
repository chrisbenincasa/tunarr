import { NotNull } from 'kysely';
import { chunk, head, reduce, tail } from 'lodash-es';
import { ProgramSourceType } from '../../dao/custom_types/ProgramSourceType';
import { directDbAccess } from '../../dao/direct/directDbAccess.js';
import { ProgramType } from '../../dao/entities/Program';
import { ProgramGroupingType } from '../../dao/entities/ProgramGrouping';
import { LoggerFactory } from '../../util/logging/LoggerFactory';
import { Timer } from '../../util/perf';
import Fixer from './fixer';

// TODO: Handle Jellyfin items
// Generalize and reuse the calculator
export class BackfillProgramGroupings extends Fixer {
  private logger = LoggerFactory.child({
    caller: import.meta,
    className: BackfillProgramGroupings.name,
  });
  private timer = new Timer(this.logger);

  protected async runInternal(): Promise<void> {
    // We'll try filling using the data we have first...
    const results = await this.timer.timeAsync(
      'missing groupiings db query',
      () =>
        directDbAccess()
          .selectFrom('program')
          .select(['program.uuid', 'program.tvShowUuid'])
          .where('program.seasonUuid', 'is not', null)
          .where('program.tvShowUuid', 'is not', null)
          .innerJoin('programGrouping', (join) =>
            join
              .onRef('programGrouping.uuid', '=', 'program.seasonUuid')
              .on('programGrouping.showUuid', 'is', null),
          )
          .select('programGrouping.uuid as seasonId')
          .groupBy(['program.seasonUuid', 'program.tvShowUuid'])
          .$narrowType<{ tvShowUuid: NotNull }>()
          .execute(),
    );

    await this.timer.timeAsync('update program groupings 1', async () => {
      for (const result of chunk(results, 50)) {
        const first = head(result)!;
        const rest = tail(result);
        await directDbAccess()
          .transaction()
          .execute((tx) =>
            tx
              .updateTable('programGrouping')
              .set(({ eb }) => {
                return {
                  showUuid: reduce(
                    rest,
                    (ebb, r) =>
                      ebb
                        .when('programGrouping.uuid', '=', r.seasonId)
                        .then(r.tvShowUuid),
                    eb
                      .case()
                      .when('programGrouping.uuid', '=', first.seasonId)
                      .then(first.tvShowUuid),
                  ).end(),
                };
              })
              .executeTakeFirst(),
          );
      }
    });

    // Update program -> show mappings with existing information
    const updatedShows = await directDbAccess()
      .transaction()
      .execute((tx) =>
        tx
          .updateTable('program')
          .set(({ selectFrom }) => ({
            tvShowUuid: selectFrom('programGroupingExternalId')
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
              eb('program.sourceType', '=', ProgramSourceType.PLEX),
            ]),
          )
          .execute(),
      );

    this.logger.debug(
      'Fixed %s program->show mappings',
      reduce(updatedShows, (n, { numUpdatedRows }) => n + numUpdatedRows, 0n),
    );

    // Update show -> season mappings with existing information
    // Do this in the background since it is less important.
    directDbAccess()
      .transaction()
      .execute((tx) =>
        tx
          .updateTable('program')
          .set(({ selectFrom }) => ({
            seasonUuid: selectFrom('programGroupingExternalId')
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
              eb('program.sourceType', '=', ProgramSourceType.PLEX),
            ]),
          )
          .execute(),
      )
      .then((updatedSeasons) => {
        this.logger.debug(
          'Fixed %s program->season mappings',
          reduce(
            updatedSeasons,
            (n, { numUpdatedRows }) => n + numUpdatedRows,
            0n,
          ),
        );
      })
      .catch((e) => {
        this.logger.error(
          e,
          'Error while updating season associations. Will try again on restart',
        );
      });

    directDbAccess()
      .transaction()
      .execute((tx) =>
        tx
          .updateTable('programGrouping')
          .set(({ selectFrom }) => ({
            showUuid: selectFrom('program')
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
          .where('programGrouping.type', '=', ProgramGroupingType.TvShowSeason)
          .where('programGrouping.showUuid', 'is', null)
          .executeTakeFirst(),
      )
      .then((res) => {
        this.logger.debug(
          'Fixed %s show->season associations',
          res.numUpdatedRows,
        );
      })
      .catch((e) => {
        this.logger.error(e, 'Error while updating show->season associations');
      });

    const stillMissing = await directDbAccess()
      .selectFrom('program')
      .select(({ fn }) => fn.count<number>('program.uuid').as('count'))
      .where((eb) =>
        eb.or([eb('tvShowUuid', 'is', null), eb('seasonUuid', 'is', null)]),
      )
      .where('type', '=', ProgramType.Episode)
      .executeTakeFirst();

    this.logger.debug(
      'There are still %d episode programs with missing associations',
      stillMissing?.count,
    );
  }
}
