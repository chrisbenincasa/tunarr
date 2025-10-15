import type { ExpressionBuilder } from 'kysely';
import { jsonArrayFrom } from 'kysely/helpers/sqlite';
import type { DB } from './schema/db.ts';
import { MediaSourceLibraryColumns } from './schema/MediaSourceLibrary.ts';

export function withLibraries(eb: ExpressionBuilder<DB, 'mediaSource'>) {
  return jsonArrayFrom(
    eb
      .selectFrom('mediaSourceLibrary')
      .whereRef('mediaSourceLibrary.mediaSourceId', '=', 'mediaSource.uuid')
      .select(MediaSourceLibraryColumns),
  ).as('libraries');
}

export function withPaths(eb: ExpressionBuilder<DB, 'mediaSource'>) {
  return jsonArrayFrom(
    eb
      .selectFrom('localMediaSourcePath')
      .whereRef('localMediaSourcePath.mediaSourceId', '=', 'mediaSource.uuid')
      .select([
        'localMediaSourcePath.uuid',
        'localMediaSourcePath.path',
        'localMediaSourcePath.lastScannedAt',
        'localMediaSourcePath.mediaSourceId',
      ]),
  ).as('paths');
}
