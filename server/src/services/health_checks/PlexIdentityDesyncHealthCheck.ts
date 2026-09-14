import { inject, injectable } from 'inversify';
import { Kysely } from 'kysely';
import { DB } from '../../db/schema/db.ts';
import { KEYS } from '../../types/inject.ts';
import {
  type HealthCheck,
  type HealthCheckResult,
  HealthyHealthCheckResult,
  healthCheckResult,
} from './HealthCheck.ts';

@injectable()
export class PlexIdentityDesyncHealthCheck implements HealthCheck {
  readonly id: string = this.constructor.name;

  constructor(@inject(KEYS.Database) private db: Kysely<DB>) {}

  async getStatus(): Promise<HealthCheckResult> {
    const staleLineupPrograms = await this.db
      .selectFrom('channelPrograms as cp')
      .innerJoin('program as p', 'p.uuid', 'cp.programUuid')
      .select(({ fn }) => fn.countAll<number>().as('count'))
      .where('p.state', '=', 'missing')
      .executeTakeFirst();

    const missingCount = staleLineupPrograms?.count ?? 0;
    if (missingCount > 0) {
      return healthCheckResult({
        type: 'warning',
        context: `${missingCount} active channel lineup reference(s) point at programs marked missing — playback may fail until lineups are rebuilt or Plex identity is reconciled.`,
      });
    }

    return HealthyHealthCheckResult;
  }
}
