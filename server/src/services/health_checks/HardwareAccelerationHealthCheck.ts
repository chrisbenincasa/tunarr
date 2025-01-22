import { FfmpegInfo } from '@/ffmpeg/ffmpegInfo.js';
import { SupportedHardwareAccels } from '@tunarr/types/schemas';
import { inject, injectable } from 'inversify';
import { intersection, isEmpty, reject } from 'lodash-es';
import {
  type HealthCheck,
  type HealthCheckResult,
  HealthyHealthCheckResult,
  healthCheckResult,
} from './HealthCheck.ts';

@injectable()
export class HardwareAccelerationHealthCheck implements HealthCheck {
  readonly id: string = 'HardwareAcceleration';

  constructor(@inject(FfmpegInfo) private ffmpegInfo: FfmpegInfo) {}

  async getStatus(): Promise<HealthCheckResult> {
    const supported = reject(SupportedHardwareAccels, (hw) => hw === 'none');
    const hwAccels = await this.ffmpegInfo.getHwAccels();

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
