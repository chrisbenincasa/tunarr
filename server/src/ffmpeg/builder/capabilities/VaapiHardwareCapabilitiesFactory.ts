import { TranscodeConfig } from '@/db/schema/TranscodeConfig.ts';
import { FfmpegHardwareCapabilitiesFactory } from '@/ffmpeg/builder/capabilities/BaseFfmpegHardwareCapabilities.ts';
import { DefaultHardwareCapabilities } from '@/ffmpeg/builder/capabilities/DefaultHardwareCapabilities.ts';
import { NoHardwareCapabilities } from '@/ffmpeg/builder/capabilities/NoHardwareCapabilities.ts';
import { VaapiHardwareCapabilitiesParser } from '@/ffmpeg/builder/capabilities/VaapiHardwareCapabilitiesParser.ts';
import { ChildProcessHelper } from '@/util/ChildProcessHelper.ts';
import { cacheGetOrSet } from '@/util/cache.ts';
import dayjs from '@/util/dayjs.ts';
import { attempt, isLinux, isNonEmptyString } from '@/util/index.ts';
import { LoggerFactory } from '@/util/logging/LoggerFactory.ts';
import { isEmpty, isError, isNull, isUndefined } from 'lodash-es';
import NodeCache from 'node-cache';

export class VaapiHardwareCapabilitiesFactory
  implements FfmpegHardwareCapabilitiesFactory
{
  private static logger = LoggerFactory.child({
    className: VaapiHardwareCapabilitiesFactory.name,
  });

  private static cache = new NodeCache({
    stdTTL: +dayjs.duration({ hours: 1 }),
  });

  private static vaInfoCacheKey(driver: string, device: string) {
    return `vainfo_${driver}_${device}`;
  }

  constructor(private transcodeConfig: TranscodeConfig) {}

  async getCapabilities() {
    const vaapiDevice = isNonEmptyString(this.transcodeConfig.vaapiDevice)
      ? this.transcodeConfig.vaapiDevice
      : isLinux()
      ? '/dev/dri/renderD128'
      : undefined;

    if (isUndefined(vaapiDevice) || isEmpty(vaapiDevice)) {
      this.logger.error('Cannot detect VAAPI capabilities without a device');
      return new NoHardwareCapabilities();
    }

    // windows check bail!
    if (process.platform === 'win32') {
      return new DefaultHardwareCapabilities();
    }

    const driver =
      this.transcodeConfig.vaapiDriver !== 'system'
        ? this.transcodeConfig.vaapiDriver
        : '';

    return await cacheGetOrSet(
      VaapiHardwareCapabilitiesFactory.cache,
      VaapiHardwareCapabilitiesFactory.vaInfoCacheKey(vaapiDevice, driver),
      async () => {
        const result = await attempt(() =>
          new ChildProcessHelper().getStdout(
            'vainfo',
            ['--display', 'drm', '--device', vaapiDevice, '-a'],
            false,
            isNonEmptyString(driver)
              ? { LIBVA_DRIVER_NAME: driver }
              : undefined,
            false,
          ),
        );

        if (isError(result)) {
          this.logger.error(result, 'Error while running vainfo');
          return new NoHardwareCapabilities();
        }

        if (!isNonEmptyString(result)) {
          this.logger.warn(
            'Unable to find VAAPI capabilities via vainfo. Please make sure it is installed.',
          );
          return new DefaultHardwareCapabilities();
        }

        try {
          const capabilities =
            VaapiHardwareCapabilitiesParser.extractAllFromVaInfo(result);
          if (isNull(capabilities)) {
            return new NoHardwareCapabilities();
          }
          return capabilities;
        } catch (e) {
          this.logger.error(e, 'Error while detecting VAAPI capabilities.');
          return new NoHardwareCapabilities();
        }
      },
    );
  }

  private get logger() {
    return VaapiHardwareCapabilitiesFactory.logger;
  }
}
