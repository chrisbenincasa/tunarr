import { SettingsDB } from '@/db/SettingsDB.ts';
import { DB } from '@/db/schema/db.ts';
import { mapToObj } from '@/util/index.ts';
import { LoggerFactory } from '@/util/logging/LoggerFactory.ts';
import { Kysely } from 'kysely';
import { difference, keys, map, reduce, values } from 'lodash-es';
import {
  HealthCheck,
  HealthCheckConstructable,
  HealthCheckResult,
  healthCheckResult,
} from './health_checks/HealthCheck.ts';

export class HealthCheckService {
  #logger = LoggerFactory.child({ className: this.constructor.name });
  #checks: Record<string, HealthCheck> = {};

  constructor(
    private db: Kysely<DB>,
    private settingsDB: SettingsDB,
  ) {}

  registerCheck(checkBuilder: HealthCheckConstructable) {
    const check = new checkBuilder(this.db, this.settingsDB);
    if (this.#checks[check.id]) {
      this.#logger.debug('Duplicate health check registration. Overwriting.');
    }

    this.#checks[check.id] = check;
  }

  async runAll() {
    const allResults = await Promise.allSettled(
      map(values(this.#checks), async (check) => {
        const result = await check.getStatus();
        return [check.id, result] as const;
      }),
    );

    const nonErrorResults = reduce(
      allResults,
      (prev, cur) => {
        switch (cur.status) {
          case 'rejected':
            break;
          case 'fulfilled': {
            const [id, result] = cur.value;
            prev[id] = result;
          }
        }
        return prev;
      },
      {} as Record<string, HealthCheckResult>,
    );

    // Any checks that failed to run are treated as errors. They should've logged themselves!
    const missingKeys: Record<string, HealthCheckResult> = mapToObj(
      difference(keys(this.#checks), keys(nonErrorResults)),
      (key) =>
        ({
          [key]: healthCheckResult({
            type: 'error',
            context: 'Health check failed to run. Check the server logs.',
          }),
        }) as const,
    );

    return {
      ...nonErrorResults,
      ...missingKeys,
    };
  }
}
