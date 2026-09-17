import { inject, injectable } from 'inversify';
import type { Kysely } from 'kysely';
import type { DB } from '../../db/schema/db.ts';
import { KEYS } from '../../types/inject.ts';
import { InjectLogger } from '../../util/inject.ts';
import type { Logger } from '../../util/logging/LoggerFactory.ts';
import Fixer from './fixer.ts';

/**
 * Some Jellyfin and Emby show/season groupings have their external ID row stored with
 * `source_type = 'plex'` while `media_source_id` points at the correct Jellyfin/Emby source.
 * The API converter looks up the external ID matching the grouping's own source type, finds
 * none, and throws, which fails whole guide, lineup and programming responses.
 *
 * Relabel those rows from their media source. A row is left alone when the grouping already
 * has a correctly labelled external ID for the same media source: relabelling it would violate
 * the (group_uuid, source_type, media_source_id) unique index, and the correct row already
 * satisfies the converter.
 */
@injectable()
export class FixMislabeledGroupingExternalIdSourceType extends Fixer {
  @InjectLogger() declare protected readonly logger: Logger;

  constructor(@inject(KEYS.Database) private db: Kysely<DB>) {
    super();
  }

  protected async runInternal(): Promise<void> {
    const result = await this.db
      .updateTable('programGroupingExternalId')
      .set({
        sourceType: (eb) =>
          eb
            .selectFrom('mediaSource')
            .whereRef(
              'mediaSource.uuid',
              '=',
              'programGroupingExternalId.mediaSourceId',
            )
            .where('mediaSource.type', 'in', ['jellyfin', 'emby'])
            .select('mediaSource.type')
            .$narrowType<{ type: 'jellyfin' | 'emby' }>()
            .limit(1),
      })
      .where('programGroupingExternalId.sourceType', '=', 'plex')
      .where('programGroupingExternalId.mediaSourceId', 'is not', null)
      .where((eb) =>
        eb.exists(
          eb
            .selectFrom('mediaSource')
            .whereRef(
              'mediaSource.uuid',
              '=',
              'programGroupingExternalId.mediaSourceId',
            )
            .where('mediaSource.type', 'in', ['jellyfin', 'emby'])
            .select('mediaSource.uuid'),
        ),
      )
      .where((eb) =>
        eb.not(
          eb.exists(
            eb
              .selectFrom('programGroupingExternalId as existing')
              .whereRef(
                'existing.groupUuid',
                '=',
                'programGroupingExternalId.groupUuid',
              )
              .whereRef(
                'existing.mediaSourceId',
                '=',
                'programGroupingExternalId.mediaSourceId',
              )
              .where('existing.sourceType', 'in', ['jellyfin', 'emby'])
              .select('existing.uuid'),
          ),
        ),
      )
      .executeTakeFirst();

    const relabelled = Number(result.numUpdatedRows);
    if (relabelled > 0) {
      this.logger.info(
        'Relabelled %d Jellyfin/Emby grouping external IDs stored as plex',
        relabelled,
      );
    }
  }
}
