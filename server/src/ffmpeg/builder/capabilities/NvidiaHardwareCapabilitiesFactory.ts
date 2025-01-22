import type { ReadableFfmpegSettings } from '@/db/interfaces/ISettingsDB.js';
import type {
  BaseFfmpegHardwareCapabilities,
  FfmpegHardwareCapabilitiesFactory,
} from '@/ffmpeg/builder/capabilities/BaseFfmpegHardwareCapabilities.js';
import { NoHardwareCapabilities } from '@/ffmpeg/builder/capabilities/NoHardwareCapabilities.js';
import { NvidiaHardwareCapabilities } from '@/ffmpeg/builder/capabilities/NvidiaHardwareCapabilities.js';
import { ChildProcessHelper } from '@/util/ChildProcessHelper.js';
import { cacheGetOrSet } from '@/util/cache.js';
import dayjs from '@/util/dayjs.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import {
  attempt,
  drop,
  isEmpty,
  isError,
  map,
  nth,
  reject,
  split,
  trim,
} from 'lodash-es';
import NodeCache from 'node-cache';

const NvidiaGpuArchPattern = /SM\s+(\d\.\d)/;
const NvidiaGpuModelPattern = /(GTX\s+[0-9a-zA-Z]+[\sTtIi]+)/;

export class NvidiaHardwareCapabilitiesFactory
  implements FfmpegHardwareCapabilitiesFactory
{
  private static logger = LoggerFactory.child({
    className: NvidiaHardwareCapabilitiesFactory.name,
  });

  private static cache = new NodeCache({
    stdTTL: +dayjs.duration({ hours: 1 }),
  });

  private static makeCacheKey(path: string, command: string): string {
    return `${path}_${command}`;
  }

  constructor(private settings: ReadableFfmpegSettings) {}

  async getCapabilities(): Promise<BaseFfmpegHardwareCapabilities> {
    const result = await attempt(async () => {
      const out = await cacheGetOrSet(
        NvidiaHardwareCapabilitiesFactory.cache,
        NvidiaHardwareCapabilitiesFactory.makeCacheKey(
          this.settings.ffmpegExecutablePath,
          'capabilities',
        ),
        () =>
          new ChildProcessHelper().getStdout(
            this.settings.ffmpegExecutablePath,
            [
              '-hide_banner',
              '-f',
              'lavfi',
              '-i',
              'nullsrc',
              '-c:v',
              'h264_nvenc',
              '-gpu',
              'list',
              '-f',
              'null',
              '-',
            ],
            true,
          ),
      );

      const lines = reject(map(drop(split(out, '\n'), 1), trim), (s) =>
        isEmpty(s),
      );

      for (const line of lines) {
        const archMatch = line.match(NvidiaGpuArchPattern);
        if (archMatch) {
          const archString = archMatch[1];
          const archNum = parseInt(archString.replaceAll('.', ''));
          const model =
            nth(line.match(NvidiaGpuModelPattern), 1)?.trim() ?? 'unknown';
          this.logger.debug(
            `Detected NVIDIA GPU (model = "${model}", arch = "${archString}")`,
          );
          return new NvidiaHardwareCapabilities(model, archNum);
        }
      }

      this.logger.warn('Could not parse ffmepg output for Nvidia capabilities');
      return new NoHardwareCapabilities();
    });

    if (isError(result)) {
      this.logger.warn(
        result,
        'Error while attempting to determine Nvidia hardware capabilities',
      );
      return new NoHardwareCapabilities();
    }

    return result;
  }

  private get logger() {
    return NvidiaHardwareCapabilitiesFactory.logger;
  }
}
