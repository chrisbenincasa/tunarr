import { inject, injectable } from 'inversify';
import type { Kysely } from 'kysely';
import type { DB } from '../../db/schema/db.ts';
import { KEYS } from '../../types/inject.ts';
import { InjectLogger } from '../../util/inject.ts';
import type { Logger } from '../../util/logging/LoggerFactory.ts';
import { sumBy } from 'lodash-es';
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
    // Rows minted after #1106 (2025-02-28) carry the right media_source_id, so the
    // media source itself says what the label should have been.
    const byMediaSource = await this.db
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
      .execute();

    // Rows minted between #910 (2025-01-21) and #1106 (2025-02-28) have no
    // media_source_id at all, only the media source name in external_source_id.
    // BackfillMediaSourceIdFixer cannot repair them either: it matches
    // mediaSource.type against the (wrong) 'plex' label. So match on the name, and
    // set the media source id in the same statement rather than leaving a second
    // pass to infer it.
    //
    // A name identifies a media source only by convention: media_source is unique on
    // (type, name, uri), so a Plex source and a Jellyfin source may share a name, and
    // so may a Jellyfin and an Emby one. Relabelling from an ambiguous name would move
    // a row to a type its grouping never had, which is worse than leaving it. Hence the
    // "exactly one media source carries this name" guard below; anything ambiguous is
    // left for a human.
    const byMediaSourceName = await this.db
      .updateTable('programGroupingExternalId')
      .set({
        sourceType: (eb) =>
          eb
            .selectFrom('mediaSource')
            .whereRef(
              'mediaSource.name',
              '=',
              'programGroupingExternalId.externalSourceId',
            )
            .where('mediaSource.type', 'in', ['jellyfin', 'emby'])
            .select('mediaSource.type')
            .$narrowType<{ type: 'jellyfin' | 'emby' }>()
            .limit(1),
        mediaSourceId: (eb) =>
          eb
            .selectFrom('mediaSource')
            .whereRef(
              'mediaSource.name',
              '=',
              'programGroupingExternalId.externalSourceId',
            )
            .where('mediaSource.type', 'in', ['jellyfin', 'emby'])
            .select('mediaSource.uuid')
            .limit(1),
      })
      .where('programGroupingExternalId.sourceType', '=', 'plex')
      .where('programGroupingExternalId.mediaSourceId', 'is', null)
      .where((eb) =>
        eb.exists(
          eb
            .selectFrom('mediaSource')
            .whereRef(
              'mediaSource.name',
              '=',
              'programGroupingExternalId.externalSourceId',
            )
            .where('mediaSource.type', 'in', ['jellyfin', 'emby'])
            .select('mediaSource.uuid'),
        ),
      )
      // Exactly one media source may carry the name: a second one of any type (a Plex
      // source sharing it, or a Jellyfin and an Emby source sharing it) makes the
      // relabel a guess.
      .where((eb) =>
        eb.not(
          eb.exists(
            eb
              .selectFrom(['mediaSource as candidate', 'mediaSource as other'])
              .whereRef(
                'candidate.name',
                '=',
                'programGroupingExternalId.externalSourceId',
              )
              .whereRef('other.name', '=', 'candidate.name')
              .whereRef('other.uuid', '!=', 'candidate.uuid')
              .select('candidate.uuid'),
          ),
        ),
      )
      // Leave the row alone when the grouping already carries a jellyfin/emby external
      // id, whatever its media source id: relabelling would duplicate it rather than
      // repair anything. This is about ambiguity, not about a constraint - the partial
      // index on (group_uuid, source_type, media_source_id) WHERE media_source_id IS
      // NULL does not enforce uniqueness in SQLite, because every indexed row has NULL
      // in the key column.
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
              .where('existing.sourceType', 'in', ['jellyfin', 'emby'])
              .select('existing.uuid'),
          ),
        ),
      )
      .execute();

    const relabelled =
      sumBy(byMediaSource, (result) => Number(result.numUpdatedRows)) +
      sumBy(byMediaSourceName, (result) => Number(result.numUpdatedRows));
    if (relabelled > 0) {
      this.logger.info(
        'Relabelled %d Jellyfin/Emby grouping external IDs stored as plex',
        relabelled,
      );
    }
  }
}
