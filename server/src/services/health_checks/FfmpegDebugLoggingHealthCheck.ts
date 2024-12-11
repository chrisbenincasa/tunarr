import { SettingsDB } from '@/db/SettingsDB.ts';
import { DB } from '@/db/schema/db.ts';
import { FfmpegNumericLogLevels } from '@tunarr/types/schemas';
import { Kysely } from 'kysely';
import {
  HealthCheck,
  HealthCheckResult,
  HealthyHealthCheckResult,
  healthCheckResult,
} from './HealthCheck.ts';

export class FfmpegDebugLoggingHealthCheck implements HealthCheck {
  readonly id: string = 'FfmpegDebugLogging';

  constructor(
    _db: Kysely<DB>,
    private settingsDB: SettingsDB,
  ) {}

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
