import type { ChannelWithTranscodeConfig } from '@/db/schema/derivedTypes.js';
import type { FfmpegTranscodeSession } from '@/ffmpeg/FfmpegTrancodeSession.js';
import type { ProgramStream } from '@/stream/ProgramStream.js';
import type { StreamProgramCalculator } from '@/stream/StreamProgramCalculator.js';
import type { Result } from '@/types/result.js';
import { makeFfmpegPlaylistUrl } from '@/util/serverUtil.js';
import dayjs from 'dayjs';
import { basename } from 'node:path';
import type { StrictOmit } from 'ts-essentials';
import type { FFmpegFactory } from '../../ffmpeg/FFmpegModule.ts';
import {
  defaultHlsOptions,
  HlsOutputFormat,
  NutOutputFormat,
} from '../../ffmpeg/builder/constants.ts';
import type { GetPlayerContextRequest } from '../PlayerStreamContext.ts';
import { PlayerContext } from '../PlayerStreamContext.ts';
import type { ProgramStreamFactory } from '../ProgramStreamFactory.ts';
import type { BaseHlsSessionOptions } from './BaseHlsSession.ts';
import { BaseHlsSession } from './BaseHlsSession.ts';

/**
 * Initializes an ffmpeg process that concatenates via the /playlist
 * endpoint and outputs an HLS format + segments
 */
export class HlsSlowerSession extends BaseHlsSession {
  public readonly sessionType = 'hls_slower' as const;

  // Start in lookahead mode
  #realtimeTranscode: boolean = false;
  #programCalculator: StreamProgramCalculator;
  #concatSession: FfmpegTranscodeSession;

  constructor(
    channel: ChannelWithTranscodeConfig,
    options: BaseHlsSessionOptions,
    programCalculator: StreamProgramCalculator,
    private programStreamFactory: ProgramStreamFactory,
    private ffmpegFactory: FFmpegFactory,
  ) {
    super(channel, options);
    this.#programCalculator = programCalculator;
  }

  async getNextItemStream(
    request: StrictOmit<GetPlayerContextRequest, 'channelId'>,
  ): Promise<Result<ProgramStream>> {
    const { startTime: now, sessionToken } = request;

    const lineupItemResult = await this.#programCalculator.getCurrentLineupItem(
      {
        allowSkip: true,
        channelId: this.channel.uuid,
        startTime: this.transcodedUntil.valueOf(),
        sessionToken,
      },
    );

    return lineupItemResult.mapAsync(async (result) => {
      const transcodeBuffer = dayjs
        .duration(dayjs(this.transcodedUntil).diff(now))
        .asSeconds();

      if (transcodeBuffer < 30) {
        this.#realtimeTranscode = false;
      } else {
        this.#realtimeTranscode = true;
      }

      const context = new PlayerContext(
        result.lineupItem,
        result.channelContext,
        result.sourceChannel,
        request.audioOnly,
        this.#realtimeTranscode,
        this.channel.transcodeConfig,
        this.sessionType,
      );

      let programStream = this.programStreamFactory(context, NutOutputFormat);

      let transcodeSessionResult = await programStream.setup();

      if (transcodeSessionResult.isFailure()) {
        this.logger.error(
          transcodeSessionResult.error,
          'Error while starting program stream. Attempting to subtitute with error stream',
        );

        programStream = this.programStreamFactory(
          PlayerContext.error(
            result.lineupItem.streamDuration ?? result.lineupItem.duration,
            transcodeSessionResult.error,
            result.channelContext,
            this.channel,
            /*realtime=*/ true,
            this.channel.transcodeConfig,
            this.sessionType,
          ),
          NutOutputFormat,
        );

        transcodeSessionResult = await programStream.setup();

        if (transcodeSessionResult.isFailure()) {
          this.state = 'error';
          this.error = transcodeSessionResult.error;
          this.emit('error', this.error);
        }
      }

      programStream.on('error', () => {
        this.state = 'error';
        this.error = new Error(
          `Unrecoverable error in underlying FFMPEG process`,
        );
        this.emit('error', this.error);
      });

      transcodeSessionResult.forEach((transcodeSession) => {
        this.transcodedUntil = this.transcodedUntil.add(
          transcodeSession.streamDuration,
        );
      });

      return programStream;
    });
  }

  protected async startInternal() {
    this.logger.debug(`Creating stream directory: ${this._workingDirectory}`);

    await this.initDirectories();

    this.transcodedUntil = dayjs();

    // Input the ffconcat playlist, output HLS segments
    const streamUrl = makeFfmpegPlaylistUrl({
      channel: this.channel.uuid,
      audioOnly: false,
      mode: this.sessionType,
    });

    const ffmpeg = this.ffmpegFactory(
      this.channel.transcodeConfig,
      this.channel,
      this.sessionType,
    );

    this.#concatSession = await ffmpeg.createConcatSession(streamUrl, {
      mode: 'hls_slower_concat',
      outputFormat: HlsOutputFormat({
        ...defaultHlsOptions,
        segmentBaseDirectory: this.baseDirectory,
        streamBasePath: basename(this.workingDirectory),
        streamBaseUrl: `/stream/channels/${this.channel.uuid}/${this.sessionType}/`,
        hlsTime: 4,
        hlsListSize: 25,
      }),
    });

    this.#concatSession.on('error', (e) => {
      this.emit('error', e);
    });

    this.#concatSession.start();
  }

  protected async stopInternal(): Promise<void> {
    this.#concatSession?.kill();

    this.logger.debug(
      `Cleaning out stream path for session: %s`,
      this._workingDirectory,
    );

    return await this.cleanupDirectory();
  }
}
