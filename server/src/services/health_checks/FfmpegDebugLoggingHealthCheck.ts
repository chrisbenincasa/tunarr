import { FfmpegNumericLogLevels } from '@tunarr/types/schemas';
import { SettingsDB, getSettings } from '../../dao/settings';
import {
  HealthCheck,
  HealthCheckResult,
  HealthyHealthCheckResult,
  healthCheckResult,
} from './HealthCheck';

export class FfmpegDebugLoggingHealthCheck implements HealthCheck {
  readonly id: string = 'FfmpegDebugLogging';

  constructor(private settingsDB: SettingsDB = getSettings()) {}

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
