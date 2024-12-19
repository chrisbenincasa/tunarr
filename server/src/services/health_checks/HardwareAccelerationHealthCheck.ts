import { SettingsDB, getSettings } from '@/db/SettingsDB.ts';
import { FfmpegInfo } from '@/ffmpeg/ffmpegInfo.ts';
import { SupportedHardwareAccels } from '@tunarr/types/schemas';
import { intersection, isEmpty, reject } from 'lodash-es';
import {
  HealthCheck,
  HealthCheckResult,
  HealthyHealthCheckResult,
  healthCheckResult,
} from './HealthCheck.ts';

export class HardwareAccelerationHealthCheck implements HealthCheck {
  readonly id: string = 'HardwareAcceleration';

  constructor(private settings: SettingsDB = getSettings()) {}

  async getStatus(): Promise<HealthCheckResult> {
    const supported = reject(SupportedHardwareAccels, (hw) => hw === 'none');
    const info = new FfmpegInfo(this.settings.ffmpegSettings());
    const hwAccels = await info.getHwAccels();

    if (intersection(supported, hwAccels).length === 0) {
      return healthCheckResult({
        type: 'info',
        context: `No compatible hardware acceleration modes were found in the configured ffmpeg. (Supported modes = [${supported.join(
          ', ',
        )}], found modes = ${
          isEmpty(hwAccels) ? 'NONE' : hwAccels.join(', ')
        })`,
      });
    }
    return HealthyHealthCheckResult;
  }
}
