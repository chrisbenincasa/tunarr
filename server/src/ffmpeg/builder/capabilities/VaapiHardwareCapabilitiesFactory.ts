import type { TranscodeConfig } from '@/db/schema/TranscodeConfig.js';
import type { FfmpegHardwareCapabilitiesFactory } from '@/ffmpeg/builder/capabilities/BaseFfmpegHardwareCapabilities.js';
import { DefaultHardwareCapabilities } from '@/ffmpeg/builder/capabilities/DefaultHardwareCapabilities.js';
import { NoHardwareCapabilities } from '@/ffmpeg/builder/capabilities/NoHardwareCapabilities.js';
import { VaapiHardwareCapabilitiesParser } from '@/ffmpeg/builder/capabilities/VaapiHardwareCapabilitiesParser.js';
import { cacheGetOrSet } from '@/util/cache.js';
import dayjs from '@/util/dayjs.js';
import { attempt, isLinux, isNonEmptyString, isWindows } from '@/util/index.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { isEmpty, isError, isNull, isUndefined } from 'lodash-es';
import NodeCache from 'node-cache';
import { VainfoProcessHelper } from './VainfoProcessHelper.ts';

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
    // windows check bail!
    if (isWindows()) {
      this.logger.debug(
        'Cannot detect VAAPI capabilities on Windows. Using default hw capabilities',
      );
      return new DefaultHardwareCapabilities();
    }

    const vaapiDevice = isNonEmptyString(this.transcodeConfig.vaapiDevice)
      ? this.transcodeConfig.vaapiDevice
      : isLinux()
        ? '/dev/dri/renderD128'
        : undefined;

    if (isUndefined(vaapiDevice) || isEmpty(vaapiDevice)) {
      this.logger.error('Cannot detect VAAPI capabilities without a device');
      return new NoHardwareCapabilities();
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
          new VainfoProcessHelper().getVainfoOutput('drm', vaapiDevice, driver),
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
