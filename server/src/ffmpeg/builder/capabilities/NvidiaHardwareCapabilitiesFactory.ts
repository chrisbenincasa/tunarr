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
import { type Logger, LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { inject, injectable } from 'inversify';
import { drop, isEmpty, map, nth, reject, split, trim } from 'lodash-es';
import NodeCache from 'node-cache';
import { KEYS } from '../../../types/inject.ts';
import { Result } from '../../../types/result.ts';

const NvidiaGpuArchPattern = /SM\s+(\d+\.\d+)/;
const NvidiaGpuModelPattern =
  /(([G|R]TX|Quadro|Tesla)\s+[0-9a-zA-Z]+[\sTtIi]+)/;

type NvidiaGpuDetectionResponse = {
  model?: string;
  architecture?: number;
  stdout: string;
};

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
    return await cacheGetOrSet(
      NvidiaHardwareCapabilitiesFactory.cache,
      NvidiaHardwareCapabilitiesFactory.makeCacheKey(
        this.settings.ffmpegExecutablePath,
        'capabilities',
      ),
      async () => {
        const nvidiaGpuResult =
          await new NvidiaGpuDetectionHelper().getGpuFromFfmpeg(
            this.settings.ffmpegExecutablePath,
          );

        if (nvidiaGpuResult.isFailure()) {
          this.logger.warn(
            nvidiaGpuResult.error,
            'Error while attempting to determine Nvidia hardware capabilities',
          );
          return new NoHardwareCapabilities();
        }

        const nvidiaGpu = nvidiaGpuResult.get();

        if (!nvidiaGpu.model || !nvidiaGpu.architecture) {
          this.logger.warn(
            'Could not parse ffmepg output for Nvidia capabilities. Raw output: %s',
            nvidiaGpu.stdout,
          );
          return new NoHardwareCapabilities();
        }

        return new NvidiaHardwareCapabilities(
          nvidiaGpu.model,
          nvidiaGpu.architecture,
        );
      },
    );
  }

  private get logger() {
    return NvidiaHardwareCapabilitiesFactory.logger;
  }
}

@injectable()
export class NvidiaGpuDetectionHelper {
  constructor(
    @inject(KEYS.Logger)
    private logger: Logger = LoggerFactory.child({
      className: NvidiaGpuDetectionHelper.name,
    }),
  ) {}

  async getGpuFromFfmpeg(
    ffmpegExecutablePath: string,
  ): Promise<Result<NvidiaGpuDetectionResponse>> {
    return Result.attemptAsync(async () => {
      const processOutput = await new ChildProcessHelper().getStdout(
        ffmpegExecutablePath,
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
        {
          swallowError: true,
          isPath: true,
        },
      );

      const lines = reject(
        map(drop(split(processOutput, '\n'), 1), trim),
        (s) => isEmpty(s),
      );

      for (const line of lines) {
        const maybeParsed = parseNvidiaModelAndArchitecture(line);
        if (maybeParsed) {
          this.logger.debug(
            `Detected NVIDIA GPU (model = "${maybeParsed.model}", arch = "${maybeParsed.architecture}")`,
          );

          return {
            model: maybeParsed.model,
            architecture: maybeParsed.architecture,
            stdout: processOutput,
          } satisfies NvidiaGpuDetectionResponse;
        }
      }

      return {
        stdout: processOutput,
      };
    });
  }
}

export function parseNvidiaModelAndArchitecture(ffmpegDebugLine: string) {
  const archMatch = ffmpegDebugLine.match(NvidiaGpuArchPattern);
  if (archMatch && archMatch.length > 1) {
    const archString = archMatch[1]!;
    const archNum = parseInt(archString.replaceAll('.', ''));
    const model =
      nth(ffmpegDebugLine.match(NvidiaGpuModelPattern), 1)?.trim() ?? 'unknown';
    // this.logger.debug(
    //   `Detected NVIDIA GPU (model = "${model}", arch = "${archString}")`,
    // );

    return {
      model,
      architecture: archNum,
    };
    // return {
    //   model,
    //   architecture: archNum,
    //   stdout: processOutput,
    // };
  }

  return;
}
