import { ProgramType } from '@/db/schema/Program.js';
import { ProgramGroupingType } from '@/db/schema/ProgramGrouping.js';
import { inject, injectable } from 'inversify';
import { Kysely } from 'kysely';
import { DB } from '../../db/schema/db.ts';
import { KEYS } from '../../types/inject.ts';
import {
  type HealthCheck,
  type HealthCheckResult,
  HealthyHealthCheckResult,
} from './HealthCheck.ts';

@injectable()
export class MissingSeasonNumbersHealthCheck implements HealthCheck {
  readonly id = 'MissingSeasonNumbers';

  constructor(@inject(KEYS.Database) private db: Kysely<DB>) {}

  async getStatus(): Promise<HealthCheckResult> {
    const missingFromProgramTable = await this.db
      .selectFrom('program')
      .select((eb) => eb.fn.count<number>('uuid').as('count'))
      .where('type', '=', ProgramType.Episode)
      .where((eb) => eb.or([eb('seasonNumber', 'is', null)]))
      .executeTakeFirst();

    const missingFromGroupingTable = await this.db
      .selectFrom('programGrouping')
      .select((eb) => eb.fn.count<number>('uuid').as('count'))
      .where('type', '=', ProgramGroupingType.Season)
      .where('index', 'is', null)
      .executeTakeFirst();

    const totalMissing =
      (missingFromProgramTable?.count ?? 0) +
      (missingFromGroupingTable?.count ?? 0);

    if (totalMissing === 0) {
      return HealthyHealthCheckResult;
    }

    return {
      type: 'info',
      context: `There are ${totalMissing} program(s) missing a season number`,
    };
  }
}
