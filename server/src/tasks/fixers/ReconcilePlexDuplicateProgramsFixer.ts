import { inject, injectable } from 'inversify';
import { sql } from 'kysely';
import { Kysely } from 'kysely';
import type { IChannelDB } from '@/db/interfaces/IChannelDB.js';
import type { IProgramDB } from '@/db/interfaces/IProgramDB.js';
import { DB } from '../../db/schema/db.ts';
import { KEYS } from '../../types/inject.ts';
import { InjectLogger } from '../../util/inject.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';
import Fixer from './fixer.ts';

type DuplicateRow = {
  canonicalId: string;
  libraryId: string;
  uuids: string;
};

@injectable()
export class ReconcilePlexDuplicateProgramsFixer extends Fixer {
  @InjectLogger() protected declare readonly logger: Logger;

  canRunInBackground = true;

  constructor(
    @inject(KEYS.Database) private db: Kysely<DB>,
    @inject(KEYS.ProgramDB) private programDB: IProgramDB,
    @inject(KEYS.ChannelDB) private channelDB: IChannelDB,
  ) {
    super();
  }

  protected async runInternal(): Promise<void> {
    const duplicateGroups = await sql<DuplicateRow>`
      SELECT canonical_id AS canonicalId,
             library_id AS libraryId,
             group_concat(uuid) AS uuids
      FROM program
      WHERE canonical_id IS NOT NULL
        AND source_type = 'plex'
        AND state != 'missing'
      GROUP BY canonical_id, library_id
      HAVING COUNT(*) > 1
    `.execute(this.db);

    for (const row of duplicateGroups.rows) {
      const uuids = row.uuids.split(',').filter(Boolean);
      if (uuids.length < 2) {
        continue;
      }

      const keeper = await this.pickKeeperUuid(uuids);
      const duplicates = uuids.filter((id) => id !== keeper);

      for (const duplicateUuid of duplicates) {
        await this.channelDB.replaceProgramUuidInAllLineups(
          duplicateUuid,
          keeper,
        );
        await this.programDB.updateProgramsState([duplicateUuid], 'missing');
        this.logger.info(
          'Merged duplicate Plex program %s into keeper %s (canonicalId=%s)',
          duplicateUuid,
          keeper,
          row.canonicalId,
        );
      }
    }
  }

  private async pickKeeperUuid(uuids: string[]): Promise<string> {
    const withLineups = await this.db
      .selectFrom('channelPrograms')
      .select('programUuid')
      .where('programUuid', 'in', uuids)
      .groupBy('programUuid')
      .orderBy(sql`count(*)`, 'desc')
      .limit(1)
      .executeTakeFirst();

    if (withLineups?.programUuid) {
      return withLineups.programUuid;
    }

    const oldest = await this.db
      .selectFrom('program')
      .select('uuid')
      .where('uuid', 'in', uuids)
      .orderBy('createdAt', 'asc')
      .limit(1)
      .executeTakeFirstOrThrow();

    return oldest.uuid;
  }
}
