import dayjs from 'dayjs';
import { StrictOmit } from 'ts-essentials';
import { Channel } from '../../dao/direct/schema/Channel';
import { getSettings } from '../../dao/settings';
import { FfmpegTranscodeSession } from '../../ffmpeg/FfmpegTrancodeSession';
import { HlsOutputFormat, NutOutputFormat } from '../../ffmpeg/OutputFormat';
import { FFMPEG } from '../../ffmpeg/ffmpeg';
import { serverContext } from '../../serverContext';
import { Result } from '../../types/result';
import { makeFfmpegPlaylistUrl } from '../../util/serverUtil';
import { GetPlayerContextRequest, PlayerContext } from '../PlayerStreamContext';
import { ProgramStream } from '../ProgramStream';
import { ProgramStreamFactory } from '../ProgramStreamFactory';
import { StreamProgramCalculator } from '../StreamProgramCalculator';
import { BaseHlsSession, BaseHlsSessionOptions } from './BaseHlsSession';

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
    programCalculator: StreamProgramCalculator = serverContext().streamProgramCalculator(),
    private settingsDB = getSettings(),
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

      const programStream = ProgramStreamFactory.create(
        context,
        NutOutputFormat,
        this.settingsDB,
      );

      const transcodeSession = await programStream.setup();

      this.transcodedUntil = this.transcodedUntil.add(
        transcodeSession.streamDuration,
      );

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

    const ffmpeg = new FFMPEG(this.settingsDB.ffmpegSettings(), this.channel);

    this.#concatSession = ffmpeg.createConcatSession(streamUrl, {
      outputFormat: HlsOutputFormat({
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
