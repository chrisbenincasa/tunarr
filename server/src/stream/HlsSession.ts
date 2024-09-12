import retry from 'async-retry';
import dayjs from 'dayjs';
import { filter, isEmpty, isError, isString, some } from 'lodash-es';
import fs from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { StrictOmit } from 'ts-essentials';
import { Channel } from '../dao/direct/derivedTypes';
import { getSettings } from '../dao/settings';
import { FfmpegTranscodeSession } from '../ffmpeg/FfmpegTrancodeSession';
import { serverContext } from '../serverContext';
import { Result } from '../types/result';
import { isDefined, isNodeError } from '../util';
import { ConcatStream } from './ConcatStream';
import { GetPlayerContextRequest, PlayerContext } from './PlayerStreamContext';
import { ProgramStream } from './ProgramStream';
import { ProgramStreamFactory } from './ProgramStreamFactory';
import { StreamProgramCalculator } from './StreamProgramCalculator';
import { SessionOptions, StreamSession } from './StreamSession';

export type HlsSessionOptions = SessionOptions & {
  sessionType: 'hls';
  // The number of segments to wait for before returning
  // the stream to the consumer.
  initialSegmentCount: number;
};

/**
 * Initializes an ffmpeg process that concatenates via the /playlist
 * endpoint and outputs an HLS format + segments
 */
export class HlsSession extends StreamSession<HlsSessionOptions> {
  #outPath: string;
  // Absolute path to the stream directory
  #streamPath: string;
  // The path to request streaming assets from the server
  #serverPath: string;
  #transcodedUntil: number;
  // Start in lookahead mode
  #realtimeTranscode: boolean = false;
  #programCalculator: StreamProgramCalculator;
  #stream: FfmpegTranscodeSession;

  constructor(
    channel: Channel,
    options: HlsSessionOptions,
    programCalculator: StreamProgramCalculator = serverContext().streamProgramCalculator(),
    private settingsDB = getSettings(),
  ) {
    super(channel, options);
    this.#outPath = resolve(
      process.cwd(),
      'streams',
      `stream_${this.channel.uuid}`,
    );
    this.#streamPath = join(this.#outPath, 'stream.m3u8');
    // Direct players back to the /hls URL which will return the playlist
    this.#serverPath = `/media-player/${this.channel.uuid}/hls`;
    this.#programCalculator = programCalculator;
  }

  get workingDirectory() {
    return this.#outPath;
  }

  get streamPath() {
    return this.#streamPath;
  }

  get serverPath() {
    return this.#serverPath;
  }

  async getNextItemStream(
    request: StrictOmit<GetPlayerContextRequest, 'channelId'>,
  ): Promise<Result<ProgramStream>> {
    const { startTime: now, session } = request;

    const lineupItemResult = await this.#programCalculator.getCurrentLineupItem(
      {
        allowSkip: true,
        channelId: this.channel.uuid,
        startTime: this.#transcodedUntil,
        session,
      },
    );

    return lineupItemResult.mapAsync(async (result) => {
      const { lineupItem } = result;
      const transcodeBuffer = dayjs
        .duration(dayjs(this.#transcodedUntil).diff(now))
        .asSeconds();

      if (transcodeBuffer < 30) {
        this.#realtimeTranscode = false;
      } else {
        this.#realtimeTranscode = true;
      }

      const context = new PlayerContext(
        result.lineupItem,
        result.channelContext,
        request.audioOnly,
        lineupItem.type === 'loading',
        this.#realtimeTranscode,
      );

      const programStream = ProgramStreamFactory.create(
        context,
        this.settingsDB,
      );

      const transcodeSession = await programStream.setup();

      this.#transcodedUntil = transcodeSession.streamEndTime;

      return programStream;
    });
  }

  isStale(): boolean {
    const remainingConnections = this.removeStaleConnections();
    return isEmpty(remainingConnections);
  }

  protected async initializeStream() {
    this.logger.debug(`Creating stream directory: ${this.#outPath}`);

    try {
      await fs.stat(this.#outPath);
      await this.cleanupDirectory();
    } catch (e) {
      if (isNodeError(e) && e.code === 'ENOENT') {
        this.logger.debug(
          "[Session %s]: Stream directory doesn't exist.",
          this.channel.uuid,
        );
      }
    } finally {
      await fs.mkdir(this.#outPath);
    }

    this.#transcodedUntil = dayjs().valueOf();

    const sessionResult = await new ConcatStream({
      enableHls: true,
      hlsOptions: {
        streamBasePath: `stream_${this.channel.uuid}`,
        hlsTime: 4,
        hlsListSize: 25,
      },
      logOutput: false,
      parentProcessType: 'hls',
    }).startStream(this.channel.uuid, /* audioOnly */ false);

    if (sessionResult.isFailure()) {
      return sessionResult;
    }

    this.#stream = sessionResult.get();

    return sessionResult;
  }

  protected override async waitForStreamReady(): Promise<Result<void>> {
    // Wait for the stream to become ready
    try {
      await retry(
        async (bail) => {
          const workingDirectoryFiles = await Result.attemptAsync(() =>
            fs.readdir(this.#outPath),
          );

          if (workingDirectoryFiles.isFailure()) {
            const e = workingDirectoryFiles.error;
            if (isNodeError(e) && e.code === 'ENOENT') {
              this.logger.debug('Still waiting for stream session to start.');
              throw e; // Retry
            } else {
              this.state === 'error';
              bail(e);
            }
          }

          const numSegments = filter(
            workingDirectoryFiles.get(),
            (f) => extname(f) === '.ts',
          ).length;
          const playlistExists = some(
            workingDirectoryFiles.get(),
            (f) => f === basename(this.#streamPath),
          );
          if (
            numSegments < this.sessionOptions.initialSegmentCount ||
            !playlistExists
          ) {
            this.logger.debug('Still waiting for stream session to start.');
            throw new Error('Stream not ready yet. Retry');
          }
        },
        {
          retries: 10,
          factor: 1.2,
        },
      );
      return Result.success(void 0);
    } catch (e) {
      this.logger.error(e, 'Error starting stream after retrying');
      this.state = 'error';
      return Result.failure(
        isError(e) ? e : new Error(isString(e) ? e : 'Unknown error'),
      );
    }
  }

  protected async stopStream(): Promise<void> {
    if (isDefined(this.#stream)) {
      this.#stream.kill();
    }

    this.logger.debug(
      `Cleaning out stream path for session: %s`,
      this.#outPath,
    );

    return await this.cleanupDirectory();
  }

  private async cleanupDirectory() {
    try {
      return await fs.rmdir(this.#outPath, {
        recursive: true,
      });
    } catch (err) {
      return this.logger.error(
        err,
        'Failed to cleanup stream: %s %O',
        this.channel.uuid,
      );
    }
  }
}
