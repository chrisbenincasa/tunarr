import { FfmpegSettings } from '@tunarr/types';
import { exec } from 'child_process';
import { LoggerFactory } from '../util/logging/LoggerFactory';
import { attempt } from '../util/index.js';
import _, { isEmpty, isError, some, trim } from 'lodash-es';
import NodeCache from 'node-cache';
import PQueue from 'p-queue';
import { cacheGetOrSet } from '../util/cache.js';

const CacheKeys = {
  ENCODERS: 'encoders',
  HWACCELS: 'hwaccels',
  OPTIONS: 'options',
} as const;

const execQueue = new PQueue({ concurrency: 2 });

const VersionExtractionPattern = /version\s+([^\s]+)\s+.*Copyright/;
const CoderExtractionPattern = /[A-Z.]+\s([a-z0-9_-]+)\s*(.*)$/;
const OptionsExtractionPattern = /^-([a-z_]+)\s+.*/;

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

  constructor(opts: FfmpegSettings) {
    this.ffmpegPath = opts.ffmpegExecutablePath;
  }

  async seed() {
    try {
      return await Promise.allSettled([
        this.getAvailableAudioEncoders(),
        this.getAvailableVideoEncoders(),
        this.getHwAccels(),
        this.getOptions(),
      ]);
    } catch (e) {
      this.logger.error(e, 'Unexpected error during ffmpeg info seed');
      return;
    }
  }

  async getVersion() {
    try {
      const s = await this.getFfmpegStdout(['-hide_banner', '-version']);
      const m = s.match(VersionExtractionPattern);
      if (m == null) {
        this.logger.error(
          'ffmpeg -version command output not in the expected format: ' + s,
        );
        return s;
      }
      return m[1];
    } catch (err) {
      this.logger.error(err);
      return 'unknown';
    }
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

  private getFfmpegStdout(args: string[]): Promise<string> {
    return execQueue.add(
      async () =>
        await new Promise((resolve, reject) => {
          exec(
            `"${this.ffmpegPath}" ${args.join(' ')}`,
            function (error, stdout) {
              if (error !== null) {
                reject(error);
              }
              resolve(stdout);
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
