import { FfmpegSettings } from '@tunarr/types';
import { exec } from 'child_process';
import _, { isEmpty, isError, nth, some, trim } from 'lodash-es';
import NodeCache from 'node-cache';
import PQueue from 'p-queue';
import { Nullable } from '../types/util.js';
import { cacheGetOrSet } from '../util/cache.js';
import { attempt, isNonEmptyString, parseIntOrNull } from '../util/index.js';
import { LoggerFactory } from '../util/logging/LoggerFactory';
import { NvidiaHardwareCapabilities } from './NvidiaHardwareCapabilities.js';

const CacheKeys = {
  ENCODERS: 'encoders',
  HWACCELS: 'hwaccels',
  OPTIONS: 'options',
  NVIDIA: 'nvidia',
} as const;

export type FfmpegVersionResult = {
  versionString: string;
  majorVersion?: Nullable<number>;
  minorVersion?: Nullable<number>;
  patchVersion?: Nullable<number>;
  versionDetails?: Nullable<string>;
};

const execQueue = new PQueue({ concurrency: 2 });

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

  private static resultCache: NodeCache = new NodeCache({ stdTTL: 5 * 6000 });

  private static makeCacheKey(
    path: string,
    command: keyof typeof CacheKeys,
  ): string {
    return `${path}_${CacheKeys[command]}`;
  }

  private ffmpegPath: string;
  private ffprobePath: string;

  constructor(opts: FfmpegSettings) {
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
        this.getNvidiaCapabilities(),
      ]);
    } catch (e) {
      this.logger.error(e, 'Unexpected error during ffmpeg info seed');
      return;
    }
  }

  async getVersion(): Promise<FfmpegVersionResult> {
    try {
      const s = await this.getFfmpegStdout(['-version']);
      return this.parseVersion(s, 'ffmpeg');
    } catch (err) {
      this.logger.error(err);
      return { versionString: 'unknown' };
    }
  }

  async getFfprobeVersion(): Promise<FfmpegVersionResult> {
    try {
      const s = await this.getFfprobeStdout(['-version']);
      return this.parseVersion(s, 'ffprobe');
    } catch (err) {
      this.logger.error(err);
      return { versionString: 'unknown' };
    }
  }

  private parseVersion(output: string, app: string) {
    const m = output.match(VersionExtractionPattern);
    if (!m) {
      this.logger.warn(
        `${app} -version command output not in the expected format: ${output}`,
      );
      return { versionString: output };
    }
    const versionString = m[1];

    const extractedNums = versionString.match(VersionNumberExtractionPattern);

    if (!extractedNums) {
      return { versionString };
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
    };
  }

  async getAvailableAudioEncoders() {
    return attempt(async () => {
      const out = await cacheGetOrSet(
        FFMPEGInfo.resultCache,
        this.cacheKey('ENCODERS'),
        () => this.getFfmpegStdout(['-hide_banner', '-encoders']),
      );

      return _.chain(out)
        .split('\n')
        .filter((line) => /^\s*A/.test(line))
        .map((line) => line.trim().match(CoderExtractionPattern))
        .compact()
        .reject((arr) => arr.length < 3)
        .map((arr) => ({ ffmpegName: arr[1], name: arr[2] }))
        .value();
    });
  }

  async getAvailableVideoEncoders() {
    return attempt(async () => {
      const out = await cacheGetOrSet(
        FFMPEGInfo.resultCache,
        this.cacheKey('ENCODERS'),
        () => this.getFfmpegStdout(['-hide_banner', '-encoders']),
      );

      return _.chain(out)
        .split('\n')
        .filter((line) => /^\s*V/.test(line))
        .map((line) => line.trim().match(CoderExtractionPattern))
        .compact()
        .reject((arr) => arr.length < 3)
        .map((arr) => ({ ffmpegName: arr[1], name: arr[2] }))
        .value();
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
      return _.chain(out).split('\n').drop(1).map(trim).reject(isEmpty).value();
    });
    return isError(res) ? [] : res;
  }

  async getOptions() {
    return attempt(async () => {
      const out = await cacheGetOrSet(
        FFMPEGInfo.resultCache,
        this.cacheKey('OPTIONS'),
        () => this.getFfmpegStdout(['-hide_banner', '-help', 'long']),
      );

      return _.chain(out)
        .split('\n')
        .drop(1)
        .map(trim)
        .reject(isEmpty)
        .map((line) => {
          return line.match(OptionsExtractionPattern);
        })
        .compact()
        .map((match) => {
          return match[1];
        })
        .value();
    });
  }

  async getNvidiaCapabilities() {
    return attempt(async () => {
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

      const lines = _.chain(out)
        .split('\n')
        .drop(1)
        .map(trim)
        .reject(isEmpty)
        .value();

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

      throw new Error('Could not parse ffmepg output for Nvidia capabilities');
    });
  }

  async hasOption(
    option: string,
    defaultOnMissing: boolean = false,
    defaultOnError: boolean = false,
  ) {
    const opts = await this.getOptions();
    if (isError(opts)) {
      return defaultOnError;
    }
    return opts.includes(option) ? true : defaultOnMissing;
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
  ): Promise<string> {
    return execQueue.add(
      async () =>
        await new Promise((resolve, reject) => {
          exec(
            `"${executable}" ${args.join(' ')}`,
            function (error, stdout, stderr) {
              if (error !== null && !swallowError) {
                reject(error);
              }
              resolve(isNonEmptyString(stdout) ? stdout : stderr);
            },
          );
        }),
      { throwOnTimeout: true },
    );
  }

  private cacheKey(key: keyof typeof CacheKeys): string {
    return FFMPEGInfo.makeCacheKey(this.ffmpegPath, key);
  }
}
