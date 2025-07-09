import { injectable } from 'inversify';
import { BASE_IMAGE_TAG_ENV_VAR, getEnvVar } from '../../util/env.ts';
import {
  HealthCheck,
  healthCheckResult,
  HealthCheckResult,
} from './HealthCheck.ts';

@injectable()
export class BaseImageHealthCheck implements HealthCheck {
  readonly id = BaseImageHealthCheck.name;

  getStatus(): Promise<HealthCheckResult> {
    const baseImage = getEnvVar(BASE_IMAGE_TAG_ENV_VAR);
    if (!baseImage) {
      return Promise.resolve(healthCheckResult({ type: 'healthy' }));
    }

    if (baseImage.endsWith('vaapi') || baseImage.endsWith('nvidia')) {
      const newImage = baseImage.split('-')[0];
      return Promise.resolve(
        healthCheckResult({
          type: 'warning',
          context: `Using deprecated docker image tag: chrisbenincasa/tunarr:${baseImage}. Please use chrisbenincasa/tunarr:${newImage} instead. Hardware-accel specific tags are deprecated, will not receive updates, and will be removed in a future version. Non-suffixed tags contain everything necessary for hardware acceleration.`,
        }),
      );
    }

    return Promise.resolve(healthCheckResult({ type: 'healthy' }));
  }
}
