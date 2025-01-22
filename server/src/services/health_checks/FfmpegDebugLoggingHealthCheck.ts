import type { ISettingsDB } from '@/db/interfaces/ISettingsDB.js';
import { KEYS } from '@/types/inject.js';
import { FfmpegNumericLogLevels } from '@tunarr/types/schemas';
import { inject, injectable } from 'inversify';
import {
  type HealthCheck,
  type HealthCheckResult,
  HealthyHealthCheckResult,
  healthCheckResult,
} from './HealthCheck.ts';

@injectable()
export class FfmpegDebugLoggingHealthCheck implements HealthCheck {
  readonly id: string = 'FfmpegDebugLogging';

  constructor(@inject(KEYS.SettingsDB) private settingsDB: ISettingsDB) {}

  getStatus(): Promise<HealthCheckResult> {
    const settings = this.settingsDB.ffmpegSettings();

    if (
      settings.enableLogging &&
      FfmpegNumericLogLevels[settings.logLevel] >
        FfmpegNumericLogLevels['warning']
    ) {
      return Promise.resolve(
        healthCheckResult({
          type: 'warning',
          context:
            'ffmpeg logging to console is enabled at a granularity finer than "warning", which can affect ffmpeg performance.',
        }),
      );
    } else if (settings.enableFileLogging) {
      return Promise.resolve(
        healthCheckResult({
          type: 'warning',
          context:
            'ffmpeg report logging is enabled which could use a lot of disk space.',
        }),
      );
    }

    return Promise.resolve(HealthyHealthCheckResult);
  }
}
