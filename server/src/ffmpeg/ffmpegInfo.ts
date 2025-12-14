import { FfprobeMediaInfoSchema } from '@/types/ffmpeg.js';
import { KEYS } from '@/types/inject.js';
import { Result } from '@/types/result.js';
import { Nullable } from '@/types/util.js';
import {
  ChildProcessHelper,
  GetStdoutOptions,
} from '@/util/ChildProcessHelper.js';
import { cacheGetOrSet } from '@/util/cache.js';
import dayjs from '@/util/dayjs.js';
import { Logger } from '@/util/logging/LoggerFactory.js';
import { seq } from '@tunarr/shared/util';
import { inject, injectable } from 'inversify';
import {
  drop,
  filter,
  isEmpty,
  isError,
  map,
  nth,
  reject,
  some,
  split,
  trim,
} from 'lodash-es';
import NodeCache from 'node-cache';
import { format } from 'node:util';
import type { ISettingsDB } from '../db/interfaces/ISettingsDB.ts';
import { attempt, isNonEmptyString, parseIntOrNull } from '../util/index.ts';
import { FfmpegCapabilities } from './builder/capabilities/FfmpegCapabilities.ts';

const CacheKeys = {
  ENCODERS: 'encoders',
  HWACCELS: 'hwaccels',
  OPTIONS: 'options',
  NVIDIA: 'nvidia',
  VAINFO: 'vainfo_%s_%s',
  FILTERS: 'filters',
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

const VersionExtractionPattern = /version\s+([^\s]+)\s+.*Copyright/;
const VersionNumberExtractionPattern = /n?(\d+)\.(\d+)(\.(\d+))?[_\-.]*(.*)/;
const CoderExtractionPattern = /[A-Z.]+\s([a-z0-9_-]+)\s*(.*)$/;
export const FFmpegOptionsExtractionPattern = /^-([a-z_]+)\s+.*/m;
const FfmpegFilterExtractionPattern = /^\s*?[A-Z.]+\s+(\w+).*/m;

@injectable()
export class FfmpegInfo {
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

  constructor(
    @inject(KEYS.SettingsDB) private settingsDB: ISettingsDB,
    @inject(KEYS.Logger) private logger: Logger,
  ) {}

  private get ffmpegPath() {
    return this.settingsDB.ffmpegSettings().ffmpegExecutablePath;
  }

  private get ffprobePath() {
    return this.settingsDB.ffmpegSettings().ffprobeExecutablePath;
  }

  async seed() {
    this.logger.debug('Seeding ffmpeg info');
    try {
      return await Promise.allSettled([
        this.getAvailableAudioEncoders(),
        this.getAvailableVideoEncoders(),
        this.getHwAccels(),
        this.getOptions(),
        this.getFilters(),
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
    const versionString = m[1]!;

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
        FfmpegInfo.resultCache,
        this.cacheKey('ENCODERS'),
        () => this.getFfmpegStdout(['-hide_banner', '-encoders']),
      );

      const matchingLines = seq.collect(
        filter(split(out, '\n'), (line) => /^\s*?A/.test(line)),
        (line) => line.trim().match(CoderExtractionPattern),
      );
      return map(
        reject(matchingLines, (arr) => arr.length < 3),
        (arr) => ({ ffmpegName: arr[1]!, name: arr[2]! }),
      );
    });
  }

  async getAvailableVideoEncoders(): Promise<Result<FfmpegEncoder[]>> {
    return Result.attemptAsync(async () => {
      const out = await cacheGetOrSet(
        FfmpegInfo.resultCache,
        this.cacheKey('ENCODERS'),
        () => this.getFfmpegStdout(['-hide_banner', '-encoders']),
      );

      const matchingLines = seq.collect(
        filter(split(out, '\n'), (line) => /^\s*?V/.test(line)),
        (line) => line.trim().match(CoderExtractionPattern),
      );

      return map(
        reject(matchingLines, (arr) => arr.length < 3),
        (arr) => ({ ffmpegName: arr[1]!, name: arr[2]! }),
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
        FfmpegInfo.resultCache,
        this.cacheKey('HWACCELS'),
        () => this.getFfmpegStdout(['-hide_banner', '-hwaccels']),
      );

      return reject(map(drop(split(out, '\n'), 1), trim), (s) => isEmpty(s));
    });

    return isError(res) ? [] : res;
  }

  async getOptions() {
    return Result.attemptAsync(async () => {
      const out = await cacheGetOrSet(
        FfmpegInfo.resultCache,
        this.cacheKey('OPTIONS'),
        () => this.getFfmpegStdout(['-hide_banner', '-help', 'long']),
      );

      const nonEmptyLines = reject(map(drop(split(out, '\n'), 1), trim), (s) =>
        isEmpty(s),
      );

      return seq.collect(nonEmptyLines, (line) => {
        return line.match(FFmpegOptionsExtractionPattern)?.[1];
      });
    });
  }

  async getFilters() {
    return Result.attemptAsync(async () => {
      const out = await cacheGetOrSet(
        FfmpegInfo.resultCache,
        this.cacheKey('FILTERS'),
        () => this.getFfmpegStdout(['-hide_banner', '-filters']),
      );

      const nonEmptyLines = reject(map(drop(split(out, '\n'), 1), trim), (s) =>
        isEmpty(s),
      );

      return seq.collect(nonEmptyLines, (line) => {
        return line.match(FfmpegFilterExtractionPattern)?.[1];
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

  async getCapabilities() {
    const [optionsResult, encodersResult, filtersResult] =
      await Promise.allSettled([
        this.getOptions(),
        this.getAvailableVideoEncoders(),
        this.getFilters(),
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
      filtersResult.status === 'rejected'
        ? new Set()
        : filtersResult.value
            .map((arr) => new Set(arr))
            .getOrElse(() => new Set()),
    );
  }

  async probeFile(path: string, timeout?: number) {
    const output = await this.getFfprobeStdout(
      [
        '-hide_banner',
        '-print_format',
        'json',
        '-show_format',
        '-show_chapters',
        '-show_streams',
        `${path}`,
      ],
      { timeout, swallowError: false },
    );

    const result = await FfprobeMediaInfoSchema.safeParseAsync(
      JSON.parse(output),
      { reportInput: true },
    );

    if (!result.success) {
      this.logger.warn(
        result.error,
        'Unable to parse ffprobe output for file %s. Raw output: %s',
        path,
        output,
      );
      return;
    }

    return result.data;
  }

  private getFfmpegStdout(
    args: string[],
    opts: GetStdoutOptions = { swallowError: false },
  ): Promise<string> {
    return this.getStdout(this.ffmpegPath, args, opts);
  }

  private getFfprobeStdout(
    args: string[],
    opts: GetStdoutOptions = { swallowError: false },
  ): Promise<string> {
    return this.getStdout(this.ffprobePath, args, opts);
  }

  private getStdout(
    executable: string,
    args: string[],
    opts?: GetStdoutOptions,
  ): Promise<string> {
    return new ChildProcessHelper().getStdout(executable, args, opts);
  }

  private cacheKey(key: keyof typeof CacheKeys): string {
    return FfmpegInfo.makeCacheKey(this.ffmpegPath, key);
  }
}
