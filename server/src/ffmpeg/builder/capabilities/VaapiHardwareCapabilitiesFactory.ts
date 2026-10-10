import type { TranscodeConfigOrm } from '@/db/schema/TranscodeConfig.js';
import { libvaDriverName } from '@/db/schema/TranscodeConfig.js';
import type { FfmpegHardwareCapabilitiesFactory } from '@/ffmpeg/builder/capabilities/BaseFfmpegHardwareCapabilities.js';
import { DefaultHardwareCapabilities } from '@/ffmpeg/builder/capabilities/DefaultHardwareCapabilities.js';
import { NoHardwareCapabilities } from '@/ffmpeg/builder/capabilities/NoHardwareCapabilities.js';
import { VaapiHardwareCapabilitiesParser } from '@/ffmpeg/builder/capabilities/VaapiHardwareCapabilitiesParser.js';
import { ChildProcessHelper } from '@/util/ChildProcessHelper.js';
import { cacheGetOrSet } from '@/util/cache.js';
import dayjs from '@/util/dayjs.js';
import { attempt, isLinux, isNonEmptyString, isWindows } from '@/util/index.js';
import type { Logger } from '@/util/logging/LoggerFactory.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { isEmpty, isError, isNull, isUndefined } from 'lodash-es';
import NodeCache from 'node-cache';
import { VainfoProcessHelper } from './VainfoProcessHelper.ts';

export class VaapiHardwareCapabilitiesFactory
  implements FfmpegHardwareCapabilitiesFactory
{
  private static _logger?: Logger;
  private static get logger() {
    return (this._logger ??= LoggerFactory.child({
      className: VaapiHardwareCapabilitiesFactory.name,
    }));
  }

  private static cache = new NodeCache({
    stdTTL: +dayjs.duration({ hours: 1 }),
  });

  private static vaInfoCacheKey(
    driver: string,
    device: string,
    openclProbePath: string | undefined,
  ) {
    return `vainfo_${driver}_${device}_${openclProbePath ?? 'noprobe'}`;
  }

  /**
   * @param ffmpegPathForOpenclProbe when set, this ffmpeg binary is used to
   * test whether an OpenCL device can be derived from the VAAPI device.
   */
  constructor(
    private transcodeConfig: TranscodeConfigOrm,
    private ffmpegPathForOpenclProbe?: string,
  ) {}

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

    const driver = libvaDriverName(this.transcodeConfig.vaapiDriver) ?? '';

    return await cacheGetOrSet(
      VaapiHardwareCapabilitiesFactory.cache,
      VaapiHardwareCapabilitiesFactory.vaInfoCacheKey(
        vaapiDevice,
        driver,
        this.ffmpegPathForOpenclProbe,
      ),
      async () => {
        const [result, openclInterop] = await Promise.all([
          attempt(() =>
            new VainfoProcessHelper().getVainfoOutput(
              'drm',
              vaapiDevice,
              driver,
            ),
          ),
          this.probeOpenclInterop(vaapiDevice, driver),
        ]);

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
            VaapiHardwareCapabilitiesParser.extractAllFromVaInfo(
              result,
              openclInterop,
            );
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

  // Mirrors the device setup VaapiHardwareAccelerationOption emits for
  // tonemap_opencl. Deriving fails when the OpenCL runtime lacks VAAPI
  // media sharing (e.g. Intel NEO on some iGPUs, or any AMD GPU).
  private async probeOpenclInterop(
    vaapiDevice: string,
    driver: string,
  ): Promise<boolean> {
    const ffmpegPath = this.ffmpegPathForOpenclProbe;
    if (!isNonEmptyString(ffmpegPath)) {
      return false;
    }

    const result = await attempt(() =>
      new ChildProcessHelper().getStdout(
        ffmpegPath,
        [
          '-hide_banner',
          '-v',
          'error',
          '-init_hw_device',
          `vaapi=va:${vaapiDevice}`,
          '-init_hw_device',
          'opencl=ocl@va',
          '-f',
          'lavfi',
          '-i',
          'nullsrc=s=16x16',
          '-frames:v',
          '1',
          '-f',
          'null',
          '-',
        ],
        {
          isPath: true,
          timeout: 10_000,
          env: isNonEmptyString(driver)
            ? { ...process.env, LIBVA_DRIVER_NAME: driver }
            : undefined,
        },
      ),
    );

    if (isError(result)) {
      this.logger.info(
        'OpenCL cannot be derived from VAAPI device %s; tonemap_opencl is unavailable. Reason: %s',
        vaapiDevice,
        result.message,
      );
      return false;
    }

    this.logger.debug(
      'OpenCL can be derived from VAAPI device %s',
      vaapiDevice,
    );
    return true;
  }

  private get logger() {
    return VaapiHardwareCapabilitiesFactory.logger;
  }
}
