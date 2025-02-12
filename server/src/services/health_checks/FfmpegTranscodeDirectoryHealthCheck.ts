import { inject, injectable } from 'inversify';
import fs from 'node:fs/promises';
import { dirname } from 'node:path';
import { ISettingsDB } from '../../db/interfaces/ISettingsDB.ts';
import { KEYS } from '../../types/inject.ts';
import { Result } from '../../types/result.ts';
import { fileExists } from '../../util/fsUtil.ts';
import { isNodeError, isNonEmptyString } from '../../util/index.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';
import {
  HealthCheck,
  HealthCheckResult,
  healthCheckResult,
} from './HealthCheck.ts';

@injectable()
export class FfmpegTranscodeDirectoryHealthCheck implements HealthCheck {
  readonly id: string = 'FfmpegTranscodeDirectory';

  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(KEYS.SettingsDB) private settingsDB: ISettingsDB,
  ) {}

  async getStatus(): Promise<HealthCheckResult> {
    const settings = this.settingsDB.ffmpegSettings();

    if (isNonEmptyString(settings.transcodeDirectory)) {
      const parentDir = dirname(settings.transcodeDirectory);
      const parentStatResult = await Result.attemptAsync(() =>
        fs.stat(parentDir),
      );
      if (parentStatResult.isFailure()) {
        const err = parentStatResult.error;
        if (isNodeError(err.cause) && err.cause.code === 'ENOENT') {
          return healthCheckResult({
            type: 'error',
            context: `Parent directory of configured transcode directory ${settings.transcodeDirectory} does not exist. Tunarr will not be able to create the transcode directory`,
          });
        } else {
          this.logger.error(parentStatResult.error);
          return healthCheckResult({
            type: 'error',
            context: `Error accessing parent directory (${parentDir}) of configured FFmpeg transcode directory`,
          });
        }
      } else {
        const parentStat = parentStatResult.get();
        if (!parentStat.isDirectory()) {
          return healthCheckResult({
            type: 'error',
            context: `FFmpeg transcode path parent is not a directory: ${settings.transcodeDirectory}`,
          });
        }

        const transcodeDirectoryExists = await fileExists(
          settings.transcodeDirectory,
        );
        const writable = (parentStat.mode & 0o200) === 0;
        if (!transcodeDirectoryExists && !writable) {
          return healthCheckResult({
            type: 'warning',
            context: `FFmpeg transcode parent directory may not be writable by Tunarr`,
          });
        }
      }
    }

    return {
      type: 'healthy',
    };
  }
}
