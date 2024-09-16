import retry from 'async-retry';
import dayjs, { Dayjs } from 'dayjs';
import { filter, isError, isString, map, some } from 'lodash-es';
import fs from 'node:fs/promises';
import path, { basename, extname } from 'node:path';
import { Channel } from '../../dao/direct/derivedTypes';
import { Result } from '../../types/result';
import { isNodeError } from '../../util';
import { Session, SessionOptions } from '../Session';

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

  constructor(channel: Channel, options: HlsSessionOptsT) {
    super(channel, options);

    this._workingDirectory = path.resolve(
      process.cwd(),
      'streams',
      `stream_${this.channel.uuid}`,
    );
    this._m3u8PlaylistPath = path.join(this._workingDirectory, 'stream.m3u8');
    // Direct players back to the /hls URL which will return the playlist
    this._serverPath = `/stream/channels/${this.channel.uuid}.m3u8`;
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
    this.logger.debug(`Creating stream directory: ${this._workingDirectory}`);

    try {
      await fs.stat(this._workingDirectory);
      await this.cleanupDirectory();
    } catch (e) {
      if (isNodeError(e) && e.code === 'ENOENT') {
        this.logger.debug(
          "[Session %s]: Stream directory doesn't exist.",
          this.channel.uuid,
        );
        await fs.mkdir(this._workingDirectory);
      }
    }

    this.transcodedUntil = dayjs();
  }

  protected async cleanupDirectory() {
    try {
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
        'Failed to cleanup stream: %s %O',
        this.channel.uuid,
      );
    }
  }

  protected override async waitForStreamReady(): Promise<Result<void>> {
    // Wait for the stream to become ready
    try {
      this.logger.debug(
        'Waiting for HLS stream session to be ready... %s',
        this.state,
      );
      await retry(
        async (bail) => {
          const workingDirectoryFiles = await Result.attemptAsync(() =>
            fs.readdir(this._workingDirectory),
          );

          if (workingDirectoryFiles.isFailure()) {
            const e = workingDirectoryFiles.error;
            if (isNodeError(e) && e.code === 'ENOENT') {
              this.logger.debug("Session working directory doesn't exist yet!");
              throw e; // Retry
            } else {
              this.state === 'error';
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
          retries: 10,
          factor: 1.2,
        },
      );

      this.logger.debug('Stream successfully started!');

      return Result.success(void 0);
    } catch (e) {
      this.logger.error(e, 'Error starting stream after retrying');
      this.state = 'error';
      return Result.failure(
        isError(e) ? e : new Error(isString(e) ? e : 'Unknown error'),
      );
    }
  }
}

export type BaseHlsSessionOptions = SessionOptions & {
  sessionType: 'hls' | 'hls_slower';
  // The number of segments to wait for before returning
  // the stream to the consumer.
  initialSegmentCount: number;
};
