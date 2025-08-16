import { type IChannelDB } from '@/db/interfaces/IChannelDB.js';
import type { ISettingsDB } from '@/db/interfaces/ISettingsDB.js';
import {
  MkvOutputFormat,
  Mp4OutputFormat,
  MpegTsOutputFormat,
  OutputFormat,
} from '@/ffmpeg/builder/constants.js';
import type { ProgramStreamFactory } from '@/stream/ProgramStreamFactory.js';
import { SessionManager } from '@/stream/SessionManager.js';
import { KEYS } from '@/types/inject.js';
import { Result } from '@/types/result.js';
import { fileExists } from '@/util/fsUtil.js';
import { ChannelStreamMode } from '@tunarr/types';
import { inject, injectable } from 'inversify';
import { isNil, once } from 'lodash-es';
import { PassThrough, Readable } from 'node:stream';
import { type Logger } from '../util/logging/LoggerFactory.ts';
import { PlayerContext } from './PlayerStreamContext.ts';
import { ProgramStream } from './ProgramStream.js';
import {
  StreamProgramCalculator,
  StreamProgramCalculatorError,
} from './StreamProgramCalculator.ts';

type VideoStreamSuccessResult = {
  type: 'success';
  stream: Readable;
  stop(): void;
};

type VideoStreamErrorResult = {
  type: 'error';
  httpStatus: number;
  message: string;
  error?: unknown;
};

type VideoStreamResult = VideoStreamSuccessResult | VideoStreamErrorResult;

type StartVideoStreamRequest = {
  channel: string | number;
  audioOnly: boolean;
  streamMode: ChannelStreamMode;
  sessionToken?: string;
};

/**
 * Starts a video stream for the given channel, playing the show airing at the
 * given timestamp
 */
@injectable()
export class VideoStream {
  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(StreamProgramCalculator)
    private calculator: StreamProgramCalculator,
    @inject(KEYS.ChannelDB) private channelDB: IChannelDB,
    @inject(KEYS.SettingsDB) private settingsDB: ISettingsDB,
    @inject(KEYS.ProgramStreamFactory)
    private programStreamFactory: ProgramStreamFactory,
    @inject(SessionManager) private sessionManager: SessionManager,
  ) {}

  async startStream(
    {
      channel: channelIdOrNumber,
      audioOnly,
      streamMode,
      sessionToken,
    }: StartVideoStreamRequest,
    startTimestamp: number,
    allowSkip: boolean,
  ): Promise<VideoStreamResult> {
    const start = performance.now();
    // const serverCtx = getServerContext();
    const outStream = new PassThrough();

    const channel = await this.channelDB
      .getChannelBuilder(channelIdOrNumber)
      .withTranscodeConfig()
      .executeTakeFirst();

    if (isNil(channel)) {
      return {
        type: 'error',
        httpStatus: 404,
        message: `Channel ${channelIdOrNumber} doesn't exist`,
      };
    }

    const ffmpegSettings = this.settingsDB.ffmpegSettings();

    // Check if ffmpeg path is valid
    if (!(await fileExists(ffmpegSettings.ffmpegExecutablePath))) {
      this.logger.error(
        `FFMPEG path (${ffmpegSettings.ffmpegExecutablePath}) is invalid. The file (executable) doesn't exist.`,
      );

      return {
        type: 'error',
        httpStatus: 500,
        message: `FFMPEG path (${ffmpegSettings.ffmpegExecutablePath}) is invalid. The file (executable) doesn't exist.`,
      };
    }

    let programStreamResult: Result<ProgramStream>;
    switch (streamMode) {
      case 'hls_slower': {
        const hlsSession = this.sessionManager.getHlsSlowerSession(
          channel.uuid,
        );
        if (!hlsSession) {
          throw new Error(
            'No HLS session found for channel when one was expected.',
          );
        }
        programStreamResult = await hlsSession.getNextItemStream({
          allowSkip,
          startTime: startTimestamp,
          sessionToken,
          audioOnly,
        });
        break;
      }
      default: {
        const lineupItemResult = await this.calculator.getCurrentLineupItem({
          allowSkip,
          channelId: channel.uuid,
          startTime: startTimestamp,
          sessionToken,
        });

        programStreamResult = lineupItemResult.map((result) => {
          const playerContext = new PlayerContext(
            result.lineupItem,
            result.channelContext,
            result.sourceChannel,
            audioOnly,
            true,
            channel.transcodeConfig,
            streamMode,
          );

          let outputFormat: OutputFormat = MpegTsOutputFormat;
          if (streamMode === 'hls_direct') {
            switch (ffmpegSettings.hlsDirectOutputFormat) {
              case 'mkv':
                outputFormat = MkvOutputFormat;
                break;
              case 'mp4':
                outputFormat = Mp4OutputFormat;
                break;
              case 'mpegts':
                break;
            }
          }

          const programStream = this.programStreamFactory(
            playerContext,
            outputFormat,
          );

          programStream.on('error', () => {
            this.logger.error(
              `Unrecoverable error in underlying FFMPEG process`,
            );
          });
          return programStream;
        });
        break;
      }
    }

    if (programStreamResult.isFailure()) {
      let code: number = 500;
      if (
        programStreamResult.error instanceof StreamProgramCalculatorError &&
        programStreamResult.error.type === 'channel_not_found'
      ) {
        code = 404;
      }

      return {
        type: 'error',
        message: programStreamResult.error.message,
        httpStatus: code,
      };
    }

    const programStream = programStreamResult.get();

    const stop = once(() => {
      programStream.shutdown();
      outStream.push(null);
    });

    try {
      await programStream.start(outStream);
    } catch (err) {
      this.logger.error(err, 'Error when attempting to play video');
      stop();
      return {
        type: 'error',
        httpStatus: 500,
        message: 'Unable to start playing video.',
        error: err,
      };
    }

    outStream.once('data', () => {
      const dur = performance.now() - start;
      this.logger.debug('Video stream started in %d ms', dur);
    });

    return {
      type: 'success',
      stream: outStream,
      stop,
    };
  }
}
