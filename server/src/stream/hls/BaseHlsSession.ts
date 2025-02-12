import type { ChannelWithTranscodeConfig } from '@/db/schema/derivedTypes.js';
import type { SessionOptions } from '@/stream/Session.js';
import { Session } from '@/stream/Session.js';
import { Result } from '@/types/result.js';
import { isNonEmptyString } from '@/util/index.js';
import retry from 'async-retry';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { filter, isError, isString, map, some } from 'lodash-es';
import fs from 'node:fs/promises';
import path, { basename, extname } from 'node:path';
import { defaultHlsOptions } from '../../ffmpeg/builder/constants.ts';
import { serverOptions } from '../../globals.ts';
import { fileExists } from '../../util/fsUtil.ts';

export abstract class BaseHlsSession<
  HlsSessionOptsT extends BaseHlsSessionOptions = BaseHlsSessionOptions,
> extends Session<HlsSessionOptsT> {
  // Working directory for m3u8 playlists and fragments
  protected _workingDirectory: string;
  // Absolute path to the stream directory
  protected _m3u8PlaylistPath: string;
  // The path to request streaming assets from the server
  protected _serverPath: string;

  protected transcodedUntil: Dayjs;

  constructor(channel: ChannelWithTranscodeConfig, options: HlsSessionOptsT) {
    super(channel, options);

    this._workingDirectory = path.join(
      this.baseDirectory,
      `stream_${this.channel.uuid}`,
    );
    this._m3u8PlaylistPath = path.join(this._workingDirectory, 'stream.m3u8');
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

  protected async initDirectories() {
    if (!(await fileExists(this.baseDirectory))) {
      this.logger.debug(
        `Creating stream base directory: ${this.baseDirectory}`,
      );
      await fs.mkdir(this.baseDirectory);
    }

    if (!(await fileExists(this.workingDirectory))) {
      this.logger.debug(`Creating stream directory: ${this.workingDirectory}`);
      await fs.mkdir(this.workingDirectory);
    } else {
      await this.cleanupDirectory();
    }

    this.transcodedUntil = dayjs();
  }

  protected async cleanupDirectory() {
    try {
      this.logger.debug(
        'Cleaning up existing working directory: %s',
        this._workingDirectory,
      );
      const allItems = await fs.readdir(this._workingDirectory);
      await Promise.all(
        map(allItems, (item) =>
          fs.rm(path.join(this._workingDirectory, item), {
            recursive: true,
            force: true,
          }),
        ),
      );
    } catch (err) {
      return this.logger.error(
        err,
        'Failed to cleanup stream: %s',
        this.channel.uuid,
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

          if (
            numSegments < this.sessionOptions.initialSegmentCount ||
            !playlistExists
          ) {
            this.logger.debug(
              'Still waiting for stream session to start. (num segments=%d < %d, playlist exists? %s)',
              numSegments,
              this.sessionOptions.initialSegmentCount,
              playlistExists,
            );
            throw new Error('Stream not ready yet. Retry');
          }
        },
        {
          retries: 15,
          factor: 1.25,
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
}

export type BaseHlsSessionOptions = SessionOptions & {
  // The number of segments to wait for before returning
  // the stream to the consumer.
  initialSegmentCount: number;
  // The directory to write segments to
  transcodeDirectory?: string;
};
