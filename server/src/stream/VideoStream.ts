import { ChannelStreamMode } from '@tunarr/types';
import { isNil, once } from 'lodash-es';
import { PassThrough, Readable } from 'node:stream';
import { getServerContext, serverContext } from '../serverContext.ts';
import { Result } from '../types/result.ts';
import { fileExists } from '../util/fsUtil.js';
import { LoggerFactory } from '../util/logging/LoggerFactory.ts';
import { PlayerContext } from './PlayerStreamContext.ts';
import { ProgramStream } from './ProgramStream.js';
import { ProgramStreamFactory } from './ProgramStreamFactory.js';
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
  sessionType: ChannelStreamMode;
  sessionToken?: string;
};

/**
 * Starts a video stream for the given channel, playing the show airing at the
 * given timestamp
 */
export class VideoStream {
  private logger = LoggerFactory.child({
    caller: import.meta,
    className: VideoStream.name,
  });

  constructor(
    private calculator: StreamProgramCalculator = getServerContext().streamProgramCalculator(),
  ) {}

  async startStream(
    {
      channel: reqChannel,
      audioOnly,
      sessionType,
      sessionToken,
    }: StartVideoStreamRequest,
    startTimestamp: number,
    allowSkip: boolean,
  ): Promise<VideoStreamResult> {
    const start = performance.now();
    const serverCtx = getServerContext();
    const outStream = new PassThrough();

    const channel = await serverCtx.channelDB.getChannel(reqChannel);

    if (isNil(channel)) {
      return {
        type: 'error',
        httpStatus: 404,
        message: `Channel ${reqChannel} doesn't exist`,
      };
    }

    const ffmpegSettings = serverCtx.settings.ffmpegSettings();

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
    switch (sessionType) {
      case 'hls_slower': {
        const hlsSession = serverContext().sessionManager.getHlsSlowerSession(
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
            audioOnly,
            result.lineupItem.type === 'loading',
            true,
          );
          return ProgramStreamFactory.create(playerContext);
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
