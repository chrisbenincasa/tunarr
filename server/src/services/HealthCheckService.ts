import { difference, keys, map, reduce, values } from 'lodash-es';
import { mapToObj } from '../util';
import { LoggerFactory } from '../util/logging/LoggerFactory';
import {
  HealthCheck,
  HealthCheckResult,
  healthCheckResult,
} from './health_checks/HealthCheck';

export class HealthCheckService {
  #logger = LoggerFactory.child({ className: this.constructor.name });
  #checks: Record<string, HealthCheck> = {};

  registerCheck(check: HealthCheck) {
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
