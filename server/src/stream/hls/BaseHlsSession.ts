import type { ChannelOrmWithTranscodeConfig } from '@/db/schema/derivedTypes.js';
import type { SessionOptions, StopOptions } from '@/stream/Session.js';
import { Session } from '@/stream/Session.js';
import { Result } from '@/types/result.js';
import type { FfmpegTranscodeSession } from '@/ffmpeg/FfmpegTrancodeSession.js';
import { isNonEmptyString, timeoutPromise } from '@/util/index.js';
import retry from 'async-retry';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { filter, isError, isNaN, isString, some } from 'lodash-es';
import fs from 'node:fs/promises';
import path, { basename, extname } from 'node:path';
import type { DeepRequired } from 'ts-essentials';
import type { HlsOptions } from '../../ffmpeg/builder/constants.ts';
import { defaultHlsOptions } from '../../ffmpeg/builder/constants.ts';
import { serverOptions } from '../../globals.ts';

export const SegmentNameRegex = /\D+(\d+)\.(ts|mp4|vtt)/;

// FfmpegProcess escalates to SIGKILL after 15s, so this leaves room for the
// kill to land.
const ExitWaitTimeoutMs = 30_000;

// Tracks the most recently requested segment number per client IP, split by
// numbering space: video (.ts/.mp4) and subtitle (.vtt) segments are produced
// at very different cadences and must not be conflated into a single floor.
type SegmentRequestRecord = {
  video?: number;
  subtitle?: number;
};

export abstract class BaseHlsSession<
  HlsSessionOptsT extends BaseHlsSessionOptions = BaseHlsSessionOptions,
> extends Session<HlsSessionOptsT> {
  protected static SegmentNameFormat = 'data%06d.ts';

  // Working directory for m3u8 playlists and fragments
  protected _workingDirectory: string;
  // Absolute path to the stream directory
  protected _m3u8PlaylistPath: string;
  // Absolute path to the HLS master playlist
  protected _masterPlaylistPath: string;
  // The path to request streaming assets from the server
  protected _serverPath: string;

  protected transcodedUntil?: Dayjs;

  protected _minByIp = new Map<string, SegmentRequestRecord>();

  private minRequestedFor(kind: keyof SegmentRequestRecord): number {
    let min: number | undefined;
    for (const record of this._minByIp.values()) {
      const value = record[kind];
      if (value === undefined) {
        continue;
      }
      if (min === undefined || value < min) {
        min = value;
      }
    }
    return min ?? 0;
  }

  protected get minSegmentRequested(): number {
    return this.minRequestedFor('video');
  }

  protected get minSubtitleSegmentRequested(): number {
    return this.minRequestedFor('subtitle');
  }

  constructor(
    channel: ChannelOrmWithTranscodeConfig,
    options: HlsSessionOptsT,
  ) {
    super(channel, options);

    // Per instance, so a replacement session never shares a directory with a
    // predecessor whose ffmpeg is still shutting down.
    this._workingDirectory = path.join(
      this.baseDirectory,
      `stream_${this.channel.uuid}_${this.instanceId}`,
    );
    this._m3u8PlaylistPath = path.join(this._workingDirectory, 'stream.m3u8');
    this._masterPlaylistPath = path.join(
      this._workingDirectory,
      'playlist.m3u8',
    );
    // Direct players back to the /hls URL which will return the playlist
    this._serverPath = `/stream/channels/${this.channel.uuid}.m3u8`;
  }

  get baseDirectory() {
    return isNonEmptyString(this.sessionOptions.transcodeDirectory)
      ? this.sessionOptions.transcodeDirectory
      : path.join(
          serverOptions().databaseDirectory,
          defaultHlsOptions.segmentBaseDirectory,
        );
  }

  get workingDirectory() {
    return this._workingDirectory;
  }

  get streamPath() {
    return this._m3u8PlaylistPath;
  }

  get serverPath() {
    return this._serverPath;
  }

  onSegmentRequested(clientIp: string, filename: string) {
    const base = basename(filename);
    const matches = base.match(SegmentNameRegex);
    if (matches && matches.length > 2) {
      const parsed = parseInt(matches[1]!);
      if (!isNaN(parsed)) {
        const kind: keyof SegmentRequestRecord =
          matches[2] === 'vtt' ? 'subtitle' : 'video';
        const existing = this._minByIp.get(clientIp) ?? {};
        this._minByIp.set(clientIp, { ...existing, [kind]: parsed });
      }
    }
  }

  override removeConnection(token: string) {
    super.removeConnection(token);
    this._minByIp.delete(token);
  }

  protected abstract getHlsOptions(): DeepRequired<HlsOptions>;

  /**
   * Returns additional filenames (basenames only) that must exist in the
   * working directory before the stream is considered ready. Subclasses
   * override this to gate on e.g. the subtitle playlist.
   */
  protected getAdditionalRequiredFiles(): string[] {
    return [];
  }

  protected async initDirectories() {
    this.logger.debug(`Creating stream directory: ${this.workingDirectory}`);
    await fs.mkdir(this.workingDirectory, { recursive: true });
    this.transcodedUntil = dayjs();
  }

  protected async cleanupDirectory() {
    try {
      this.logger.debug(
        'Removing working directory: %s',
        this._workingDirectory,
      );
      await fs.rm(this._workingDirectory, {
        recursive: true,
        force: true,
        maxRetries: 2,
      });
    } catch (err) {
      this.logger.error(err, 'Failed to cleanup stream: %s', this.channel.uuid);
      throw err;
    }
  }

  /**
   * Waits for a killed transcode to exit, so cleanup does not race its last
   * writes. Bounded because SIGKILL cannot interrupt a process stuck in a
   * driver call.
   */
  protected async waitForExit(
    transcode: FfmpegTranscodeSession,
    options: StopOptions,
  ) {
    if (options.waitForExit === false) {
      return;
    }
    try {
      await timeoutPromise(transcode.exited, ExitWaitTimeoutMs);
    } catch {
      this.logger.warn(
        'ffmpeg did not exit %dms after kill. Removing its directory anyway.',
        ExitWaitTimeoutMs,
      );
    }
  }

  protected override async waitForStreamReady(): Promise<Result<void>> {
    // Wait for the stream to become ready
    try {
      this.logger.debug('Waiting for HLS stream session to be ready...');
      await retry(
        async (bail) => {
          if (this.hasError) {
            this.logger.error(
              this.error,
              'Bailing on stream start, had error!',
            );
            bail(
              this.error ??
                new Error(
                  'Received error while waiting for stream to be ready',
                ),
            );
            return;
          }

          const workingDirectoryFiles = await Result.attemptAsync(() =>
            fs.readdir(this._workingDirectory),
          );

          if (workingDirectoryFiles.isFailure()) {
            const e = workingDirectoryFiles.error;
            if (e.nodeErrorCode() === 'ENOENT') {
              this.logger.debug("Session working directory doesn't exist yet!");
              throw e; // Retry
            } else if (this.state === 'error') {
              bail(e);
            }
          }

          const numSegments = filter(workingDirectoryFiles.get(), (f) => {
            const ext = extname(f);
            return ext === '.ts' || ext === '.mp4';
          }).length;

          const playlistExists = some(
            workingDirectoryFiles.get(),
            (f) => f === basename(this._m3u8PlaylistPath),
          );

          const additionalRequired = this.getAdditionalRequiredFiles();
          const additionalExist = additionalRequired.every((f) =>
            some(workingDirectoryFiles.get(), (wf) => wf === f),
          );

          if (
            numSegments < this.sessionOptions.initialSegmentCount ||
            !playlistExists ||
            !additionalExist
          ) {
            this.logger.debug(
              'Still waiting for stream session to start. (num segments=%d < %d, playlist exists? %s, additional=%j)',
              numSegments,
              this.sessionOptions.initialSegmentCount,
              playlistExists,
              additionalRequired,
            );
            throw new Error('Stream not ready yet. Retry');
          }
        },
        {
          retries: 15,
          factor: 1,
          minTimeout: 1000,
          maxTimeout: 1000,
          randomize: false,
        },
      );

      this.logger.debug('Stream successfully started!');

      return Result.success(void 0);
    } catch (e) {
      this.logger.error(e, 'Error starting stream after retrying');
      this.state = 'error';
      return Result.forError(
        isError(e) ? e : new Error(isString(e) ? e : 'Unknown error'),
      );
    }
  }

  get m3uPlaylistPath() {
    return this._m3u8PlaylistPath;
  }

  get masterPlaylistPath() {
    return this._masterPlaylistPath;
  }
}

export type BaseHlsSessionOptions = SessionOptions & {
  // The number of segments to wait for before returning
  // the stream to the consumer.
  initialSegmentCount: number;
  // The directory to write segments to
  transcodeDirectory?: string;
};
