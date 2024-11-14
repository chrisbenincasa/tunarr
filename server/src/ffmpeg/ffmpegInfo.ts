import { seq } from '@tunarr/shared/util';
import { FfmpegSettings } from '@tunarr/types';
import { ExecOptions, exec } from 'child_process';
import {
  drop,
  filter,
  isEmpty,
  isError,
  isNull,
  isUndefined,
  map,
  nth,
  reject,
  some,
  split,
  trim,
} from 'lodash-es';
import NodeCache from 'node-cache';
import PQueue from 'p-queue';
import { format } from 'util';
import { Result } from '../types/result.ts';
import { Nullable } from '../types/util.js';
import { cacheGetOrSet } from '../util/cache.js';
import dayjs from '../util/dayjs.js';
import { fileExists } from '../util/fsUtil.js';
import {
  attempt,
  isLinux,
  isNonEmptyString,
  parseIntOrNull,
} from '../util/index.ts';
import { LoggerFactory } from '../util/logging/LoggerFactory.ts';
import { sanitizeForExec } from '../util/strings.js';
import { BaseFfmpegHardwareCapabilities } from './builder/capabilities/BaseFfmpegHardwareCapabilities.ts';
import { DefaultHardwareCapabilities } from './builder/capabilities/DefaultHardwareCapabilities.js';
import { FfmpegCapabilities } from './builder/capabilities/FfmpegCapabilities.ts';
import { NoHardwareCapabilities } from './builder/capabilities/NoHardwareCapabilities.js';
import { NvidiaHardwareCapabilities } from './builder/capabilities/NvidiaHardwareCapabilities.js';
import { VaapiHardwareCapabilitiesFactory } from './builder/capabilities/VaapiHardwareCapabilities.ts';
import { HardwareAccelerationMode } from './builder/types.js';

const CacheKeys = {
  ENCODERS: 'encoders',
  HWACCELS: 'hwaccels',
  OPTIONS: 'options',
  NVIDIA: 'nvidia',
  VAINFO: 'vainfo_%s_%s',
} as const;

export type FfmpegVersionResult = {
  versionString: string;
  majorVersion?: Nullable<number>;
  minorVersion?: Nullable<number>;
  patchVersion?: Nullable<number>;
  versionDetails?: Nullable<string>;
  isUnknown: boolean;
};

export type FfmpegEncoder = {
  ffmpegName: string;
  name: string;
};

const execQueue = new PQueue({ concurrency: 3 });

const VersionExtractionPattern = /version\s+([^\s]+)\s+.*Copyright/;
const VersionNumberExtractionPattern = /n?(\d+)\.(\d+)(\.(\d+))?[_\-.]*(.*)/;
const CoderExtractionPattern = /[A-Z.]+\s([a-z0-9_-]+)\s*(.*)$/;
const OptionsExtractionPattern = /^-([a-z_]+)\s+.*/;
const NvidiaGpuArchPattern = /SM\s+(\d\.\d)/;
const NvidiaGpuModelPattern = /(GTX\s+[0-9a-zA-Z]+[\sTtIi]+)/;

export class FFMPEGInfo {
  private logger = LoggerFactory.child({
    caller: import.meta,
    className: this.constructor.name,
  });

  private static resultCache: NodeCache = new NodeCache({
    stdTTL: dayjs.duration({ hours: 1 }).asSeconds(),
  });

  private static makeCacheKey(
    path: string,
    command: keyof typeof CacheKeys,
    ...args: string[]
  ): string {
    return format(`${path}_${CacheKeys[command]}`, ...args);
  }

  private static vaInfoCacheKey(driver: string, device: string) {
    return `${CacheKeys.VAINFO}_${driver}_${device}`;
  }

  private ffmpegPath: string;
  private ffprobePath: string;

  constructor(private opts: FfmpegSettings) {
    this.ffmpegPath = opts.ffmpegExecutablePath;
    this.ffprobePath = opts.ffprobeExecutablePath;
  }

  async seed() {
    this.logger.debug('Seeding ffmpeg info');
    try {
      return await Promise.allSettled([
        this.getAvailableAudioEncoders(),
        this.getAvailableVideoEncoders(),
        this.getHwAccels(),
        this.getOptions(),
        ...(this.opts.hardwareAccelerationMode === 'cuda'
          ? [this.getNvidiaCapabilities()]
          : []),
      ]);
    } catch (e) {
      this.logger.error(e, 'Unexpected error during ffmpeg info seed');
      return;
    }
  }

  async getVersion(): Promise<FfmpegVersionResult> {
    try {
      const s = await this.getFfmpegStdout(['-version']);
      return this.parseFfmpegVersion(s, 'ffmpeg');
    } catch (err) {
      this.logger.error(err);
      return { versionString: 'unknown', isUnknown: true };
    }
  }

  async getFfprobeVersion(): Promise<FfmpegVersionResult> {
    try {
      const s = await this.getFfprobeStdout(['-version']);
      return this.parseFfmpegVersion(s, 'ffprobe');
    } catch (err) {
      this.logger.error(err);
      return { versionString: 'unknown', isUnknown: true };
    }
  }

  parseFfmpegVersion(
    output: string,
    app: string = 'ffmpeg',
  ): FfmpegVersionResult {
    const m = output.match(VersionExtractionPattern);
    if (!m) {
      this.logger.warn(
        `${app} -version command output not in the expected format: ${output}`,
      );
      return { versionString: 'unknown', isUnknown: true };
    }
    const versionString = m[1];

    const extractedNums = versionString.match(VersionNumberExtractionPattern);

    if (!extractedNums) {
      return { versionString, isUnknown: true };
    }

    const majorString = nth(extractedNums, 1);
    const minorString = nth(extractedNums, 2);
    const patchString = nth(extractedNums, 4);
    const rest = nth(extractedNums, 5);
    const majorNum = isNonEmptyString(majorString)
      ? parseIntOrNull(majorString)
      : null;
    const minorNum = isNonEmptyString(minorString)
      ? parseIntOrNull(minorString)
      : null;
    const patchNum = isNonEmptyString(patchString)
      ? parseIntOrNull(patchString)
      : null;

    return {
      versionString,
      majorVersion: majorNum,
      minorVersion: minorNum,
      patchVersion: patchNum,
      versionDetails: rest,
      isUnknown: false,
    };
  }

  async getAvailableAudioEncoders(): Promise<Result<FfmpegEncoder[]>> {
    return Result.attemptAsync(async () => {
      const out = await cacheGetOrSet(
        FFMPEGInfo.resultCache,
        this.cacheKey('ENCODERS'),
        () => this.getFfmpegStdout(['-hide_banner', '-encoders']),
      );

      const matchingLines = seq.collect(
        filter(split(out, '\n'), (line) => /^\s*A/.test(line)),
        (line) => line.trim().match(CoderExtractionPattern),
      );
      return map(
        reject(matchingLines, (arr) => arr.length < 3),
        (arr) => ({ ffmpegName: arr[1], name: arr[2] }),
      );
    });
  }

  async getAvailableVideoEncoders(): Promise<Result<FfmpegEncoder[]>> {
    return Result.attemptAsync(async () => {
      const out = await cacheGetOrSet(
        FFMPEGInfo.resultCache,
        this.cacheKey('ENCODERS'),
        () => this.getFfmpegStdout(['-hide_banner', '-encoders']),
      );

      const matchingLines = seq.collect(
        filter(split(out, '\n'), (line) => /^\s*V/.test(line)),
        (line) => line.trim().match(CoderExtractionPattern),
      );

      return map(
        reject(matchingLines, (arr) => arr.length < 3),
        (arr) => ({ ffmpegName: arr[1], name: arr[2] }),
      );
    });
  }

  async hasVideoDecoder(name: string) {
    const available = await this.getAvailableVideoEncoders();
    // TODO should we be throwing here?
    if (isError(available)) {
      throw available;
    }
    return some(available, { name });
  }

  async getHwAccels() {
    const res = await attempt(async () => {
      const out = await cacheGetOrSet(
        FFMPEGInfo.resultCache,
        this.cacheKey('HWACCELS'),
        () => this.getFfmpegStdout(['-hide_banner', '-hwaccels']),
      );

      return reject(map(drop(split(out, '\n'), 1), trim), (s) => isEmpty(s));
    });

    return isError(res) ? [] : res;
  }

  async getHardwareCapabilities(
    hwMode: HardwareAccelerationMode,
  ): Promise<BaseFfmpegHardwareCapabilities> {
    // TODO Check for hw availability
    // if (isEmpty(await this.getHwAccels())) {

    // }

    switch (hwMode) {
      case 'none':
        return new NoHardwareCapabilities();
      case 'cuda':
        return await this.getNvidiaCapabilities();
      case 'qsv':
      case 'vaapi':
        return await this.getVaapiCapabilities();
      case 'videotoolbox':
        return new DefaultHardwareCapabilities();
    }
  }

  async getOptions() {
    return Result.attemptAsync(async () => {
      const out = await cacheGetOrSet(
        FFMPEGInfo.resultCache,
        this.cacheKey('OPTIONS'),
        () => this.getFfmpegStdout(['-hide_banner', '-help', 'long']),
      );

      const nonEmptyLines = reject(map(drop(split(out, '\n'), 1), trim), (s) =>
        isEmpty(s),
      );

      return seq.collect(nonEmptyLines, (line) => {
        return line.match(OptionsExtractionPattern)?.[1];
      });
    });
  }

  async hasOption(
    option: string,
    defaultOnMissing: boolean = false,
    defaultOnError: boolean = false,
  ) {
    const opts = await this.getOptions();
    if (opts.isFailure()) {
      return defaultOnError;
    }
    return opts.get().includes(option) ? true : defaultOnMissing;
  }

  async getNvidiaCapabilities() {
    const result = await attempt(async () => {
      const out = await cacheGetOrSet(
        FFMPEGInfo.resultCache,
        this.cacheKey('NVIDIA'),
        () =>
          this.getFfmpegStdout(
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

  async getVaapiCapabilities() {
    const vaapiDevice = isNonEmptyString(this.opts.vaapiDevice)
      ? this.opts.vaapiDevice
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

    const driver = this.opts.vaapiDriver ?? '';

    return await cacheGetOrSet(
      FFMPEGInfo.resultCache,
      FFMPEGInfo.vaInfoCacheKey(vaapiDevice, driver),
      async () => {
        const result = await this.getStdout(
          'vainfo',
          ['--display', 'drm', '--device', vaapiDevice, '-a'],
          false,
          isNonEmptyString(driver) ? { LIBVA_DRIVER_NAME: driver } : undefined,
          false,
        );

        if (!isNonEmptyString(result)) {
          this.logger.warn(
            'Unable to find VAAPI capabilities via vainfo. Please make sure it is installed.',
          );
          return new DefaultHardwareCapabilities();
        }

        try {
          const capabilities =
            VaapiHardwareCapabilitiesFactory.extractAllFromVaInfo(result);
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

  async getCapabilities() {
    const [optionsResult, encodersResult] = await Promise.allSettled([
      this.getOptions(),
      this.getAvailableVideoEncoders(),
    ]);

    return new FfmpegCapabilities(
      optionsResult.status === 'rejected'
        ? new Set()
        : optionsResult.value
            .map((arr) => new Set(arr))
            .getOrElse(() => new Set()),
      encodersResult.status === 'rejected'
        ? new Map<string, FfmpegEncoder>()
        : encodersResult.value
            .map(
              (arr) =>
                new Map(
                  arr.map((encoder) => [encoder.ffmpegName, encoder] as const),
                ),
            )
            .getOrElse(() => new Map<string, FfmpegEncoder>()),
    );
  }

  private getFfmpegStdout(
    args: string[],
    swallowError: boolean = false,
  ): Promise<string> {
    return this.getStdout(this.ffmpegPath, args, swallowError);
  }

  private getFfprobeStdout(
    args: string[],
    swallowError: boolean = false,
  ): Promise<string> {
    return this.getStdout(this.ffprobePath, args, swallowError);
  }

  private getStdout(
    executable: string,
    args: string[],
    swallowError: boolean = false,
    env?: NodeJS.ProcessEnv,
    isPath: boolean = true,
  ): Promise<string> {
    return execQueue.add(
      async () => {
        const sanitizedPath = sanitizeForExec(executable);
        if (isPath && !(await fileExists(sanitizedPath))) {
          throw new Error(`Path at ${sanitizedPath} does not exist`);
        }

        const opts: ExecOptions = {};
        if (!isEmpty(env)) {
          opts.env = env;
        }

        return await new Promise((resolve, reject) => {
          exec(
            `"${sanitizedPath}" ${args.join(' ')}`,
            opts,
            function (error, stdout, stderr) {
              if (error !== null && !swallowError) {
                reject(error);
              }
              resolve(isNonEmptyString(stdout) ? stdout : stderr);
            },
          );
        });
      },
      { throwOnTimeout: true },
    );
  }

  private cacheKey(key: keyof typeof CacheKeys): string {
    return FFMPEGInfo.makeCacheKey(this.ffmpegPath, key);
  }
}
