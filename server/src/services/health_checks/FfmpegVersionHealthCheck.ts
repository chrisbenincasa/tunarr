import type { ISettingsDB } from '@/db/interfaces/ISettingsDB.js';
import { FfmpegInfo, FfmpegVersionResult } from '@/ffmpeg/ffmpegInfo.js';
import { KEYS } from '@/types/inject.js';
import { fileExists } from '@/util/fsUtil.js';
import { inject, injectable } from 'inversify';
import { every, isNil, some } from 'lodash-es';
import { P, match } from 'ts-pattern';
import {
  type HealthCheck,
  type HealthCheckResult,
  HealthyHealthCheckResult,
  healthCheckResult,
} from './HealthCheck.ts';

@injectable()
export class FfmpegVersionHealthCheck implements HealthCheck {
  readonly id: string = 'FfmpegVersion';

  private static minVersion = '7.1';

  constructor(
    @inject(KEYS.SettingsDB) private settingsDB: ISettingsDB,
    @inject(FfmpegInfo) private ffmpegInfo: FfmpegInfo,
  ) {}

  async getStatus(): Promise<HealthCheckResult> {
    const settings = this.settingsDB.ffmpegSettings();

    const ffmpegExists = await fileExists(settings.ffmpegExecutablePath);
    const ffprobeExists = await fileExists(settings.ffprobeExecutablePath);

    const warningResult = match([ffmpegExists, ffprobeExists] as const)
      .with([false, true], () =>
        healthCheckResult({
          type: 'error',
          context: `ffmpeg doesn't exist at configured path ${settings.ffmpegExecutablePath}. Tunarr requires ffmpeg to function. The path can be configured in Settings > FFMPEG`,
        }),
      )
      .with([true, false], () =>
        healthCheckResult({
          type: 'error',
          context: `ffprobe doesn't exist at configured path ${settings.ffprobeExecutablePath}. Tunarr requires ffprobe to function. The path can be configured in Settings > FFMPEG`,
        }),
      )
      .with([false, false], () =>
        healthCheckResult({
          type: 'error',
          context: `Neither ffmpeg nor ffprobe exists at configured paths (ffmpeg=${settings.ffmpegExecutablePath}, ffprobe=${settings.ffprobeExecutablePath}). Tunarr requires both programs to function. The paths can be configured in Settings > FFMPEG`,
        }),
      )
      .otherwise(() => null);

    if (warningResult) {
      return warningResult;
    }

    const version = await this.ffmpegInfo.getVersion();
    const ffmpegVersionError = this.isVersionValid(version, 'ffmpeg');
    if (ffmpegVersionError) {
      return ffmpegVersionError;
    }

    const ffprobeVersionError = this.isVersionValid(
      await this.ffmpegInfo.getFfprobeVersion(),
      'ffprobe',
    );
    if (ffprobeVersionError) {
      return ffprobeVersionError;
    }

    return HealthyHealthCheckResult;
  }

  private isVersionValid(version: FfmpegVersionResult, app: string) {
    const versionString = version.versionString;

    // Try to use the parsed major/minor versions first
    if (!isNil(version.majorVersion) && !isNil(version.minorVersion)) {
      const result = match([version.majorVersion, version.minorVersion])
        .with(
          [P.number.lt(6), P._],
          () =>
            `${app} version ${versionString} is too old. Please install at least version ${FfmpegVersionHealthCheck.minVersion} of ${app}`,
        )
        .with(
          [6, 0],
          () =>
            `${app} version ${versionString} is too old. Please install at least version ${FfmpegVersionHealthCheck.minVersion} of ${app}`,
        )
        .otherwise(() => null);
      if (result) {
        return healthCheckResult({ context: result, type: 'error' });
      } else {
        return HealthyHealthCheckResult;
      }
    }

    if (
      some(
        ['3.', '4.', '5.'],
        (prefix) =>
          versionString.startsWith(prefix) ||
          versionString.startsWith(`n${prefix}`),
      )
    ) {
      return healthCheckResult({
        type: 'error',
        context: `${app} version ${versionString} is too old. Please install at least version ${FfmpegVersionHealthCheck.minVersion} of ${app}`,
      });
    }

    if (
      every(
        [
          FfmpegVersionHealthCheck.minVersion,
          `n${FfmpegVersionHealthCheck.minVersion}`,
        ],
        (prefix) => !versionString.startsWith(prefix),
      )
    ) {
      return healthCheckResult({
        type: 'warning',
        context: `${app} version ${versionString} is unrecognized and may have issues.`,
      });
    }

    return null;
  }
}
