import type { ExpressionBuilder } from 'kysely';
import { jsonArrayFrom } from 'kysely/helpers/sqlite';
import type { DB } from './schema/db.ts';
import { MediaSourceLibraryColumns } from './schema/MediaSource.ts';

export function withLibraries(eb: ExpressionBuilder<DB, 'mediaSource'>) {
  return jsonArrayFrom(
    eb
      .selectFrom('mediaSourceLibrary')
      .whereRef('mediaSourceLibrary.mediaSourceId', '=', 'mediaSource.uuid')
      .select(MediaSourceLibraryColumns),
  ).as('libraries');
}
