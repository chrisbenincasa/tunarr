import { SupportedHardwareAccels } from '@tunarr/types/schemas';
import { intersection, isEmpty, reject } from 'lodash-es';
import { SettingsDB, getSettings } from '../../dao/settings';
import { FFMPEGInfo } from '../../ffmpeg/ffmpegInfo';
import {
  HealthCheck,
  HealthCheckResult,
  HealthyHealthCheckResult,
  healthCheckResult,
} from './HealthCheck';

export class HardwareAccelerationHealthCheck implements HealthCheck {
  readonly id: string = 'HardwareAcceleration';

  constructor(private settings: SettingsDB = getSettings()) {}

  async getStatus(): Promise<HealthCheckResult> {
    const supported = reject(SupportedHardwareAccels, (hw) => hw === 'none');
    const info = new FFMPEGInfo(this.settings.ffmpegSettings());
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
