import { SettingsDB } from '@/db/SettingsDB.ts';
import { Channel } from '@/db/schema/Channel.ts';
import { FFmpegFactory } from '@/ffmpeg/FFmpegFactory.ts';
import { FfmpegTranscodeSession } from '@/ffmpeg/FfmpegTrancodeSession.ts';
import { defaultHlsOptions } from '@/ffmpeg/ffmpeg.ts';
import { ProgramStream } from '@/stream/ProgramStream.ts';
import { ProgramStreamProvider } from '@/stream/ProgramStreamProvider.ts';
import { StreamProgramCalculator } from '@/stream/StreamProgramCalculator.ts';
import { Result } from '@/types/result.ts';
import { makeFfmpegPlaylistUrl } from '@/util/serverUtil.ts';
import dayjs from 'dayjs';
import { StrictOmit } from 'ts-essentials';
import {
  HlsOutputFormat,
  NutOutputFormat,
} from '../../ffmpeg/builder/constants.ts';
import {
  GetPlayerContextRequest,
  PlayerContext,
} from '../PlayerStreamContext.ts';
import { BaseHlsSession, BaseHlsSessionOptions } from './BaseHlsSession.ts';

export type HlsSlowerSessionOptions = BaseHlsSessionOptions & {
  sessionType: 'hls_slower';
};

/**
 * Initializes an ffmpeg process that concatenates via the /playlist
 * endpoint and outputs an HLS format + segments
 */
export class HlsSlowerSession extends BaseHlsSession<HlsSlowerSessionOptions> {
  public readonly sessionType = 'hls_slower' as const;

  // Start in lookahead mode
  #realtimeTranscode: boolean = false;
  #programCalculator: StreamProgramCalculator;
  // #stream: VideoStreamResult;

  #concatSession: FfmpegTranscodeSession;

  constructor(
    channel: Channel,
    options: HlsSlowerSessionOptions,
    programCalculator: StreamProgramCalculator,
    private programStreamFactory: ProgramStreamProvider,
    private settingsDB: SettingsDB,
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
      const { lineupItem } = result;
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
        request.audioOnly,
        lineupItem.type === 'loading',
        this.#realtimeTranscode,
      );

      let programStream = this.programStreamFactory.create(
        context,
        NutOutputFormat,
      );

      let transcodeSessionResult = await programStream.setup();

      if (transcodeSessionResult.isFailure()) {
        this.logger.error(
          transcodeSessionResult.error,
          'Error while starting program stream. Attempting to subtitute with error stream',
        );

        programStream = this.programStreamFactory.create(
          PlayerContext.error(
            result.lineupItem.streamDuration ?? result.lineupItem.duration,
            transcodeSessionResult.error,
            result.channelContext,
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

    const ffmpeg = FFmpegFactory.getFFmpegPipelineBuilder(
      this.settingsDB.ffmpegSettings(),
      this.channel,
    );

    this.#concatSession = await ffmpeg.createConcatSession(streamUrl, {
      mode: 'hls_slower_concat',
      outputFormat: HlsOutputFormat({
        ...defaultHlsOptions,
        streamBasePath: `stream_${this.channel.uuid}`,
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
