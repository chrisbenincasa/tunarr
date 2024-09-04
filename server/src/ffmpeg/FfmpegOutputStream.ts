import { isNil, isUndefined, once, round } from 'lodash-es';
import { PassThrough, Readable } from 'stream';
import { v4 } from 'uuid';
import { Channel } from '../dao/direct/derivedTypes.js';
import { getServerContext } from '../serverContext.js';
import { fileExists } from '../util/fsUtil.js';
import { Logger, LoggerFactory } from '../util/logging/LoggerFactory.js';
import { FfmpegTranscodeSession } from './FfmpegTrancodeSession.js';
import { FFMPEG } from './ffmpeg.js';

export type VideoStreamSuccessResult = {
  type: 'success';
  stream: Readable;
  stop(): void;
};

export type VideoStreamErrorResult = {
  type: 'error';
  httpStatus: number;
  message: string;
  error?: unknown;
};

export type VideoStreamResult =
  | VideoStreamSuccessResult
  | VideoStreamErrorResult;

export abstract class FfmpegOutputStream {
  protected logger: Logger = LoggerFactory.child({
    className: FfmpegOutputStream.name,
  });
  protected ffmpeg: FFMPEG;

  async startStream(
    channelId: string | number,
    audioOnly: boolean,
  ): Promise<VideoStreamResult> {
    const outStream = new PassThrough();
    const reqId = `'conat-TOFB-${v4()}`;
    const start = performance.now();
    const ctx = getServerContext();

    const channel = await ctx.channelDB.getChannelDirect(channelId);
    if (isNil(channel)) {
      return {
        type: 'error',
        httpStatus: 404,
        message: "Channel doesn't exist",
      };
    }

    const ffmpegSettings = ctx.settings.ffmpegSettings();

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

    this.logger.info(
      `\r\nStream starting. Channel: ${channel.number} (${channel.name})`,
    );

    this.ffmpeg = new FFMPEG(ffmpegSettings, channel); // Set the transcoder options
    this.ffmpeg.setAudioOnly(audioOnly);

    const session = await this.initializeStream(channel);
    if (isUndefined(session)) {
      return {
        type: 'error',
        httpStatus: 500,
        message: 'Could not start ffmpeg',
      };
    }

    const stop = once(() => {
      session.process.kill();
    });

    session.on('error', (err) => {
      this.logger.error(err, 'FFMPEG ERROR');
      stop();
    });

    session.on('end', () => {
      stop();
      outStream.push(null);
    });

    outStream.once('data', () => {
      const end = performance.now();
      this.logger.debug(
        `Request ID ${reqId} time-to-first-byte: ${round(end - start, 4)}ms`,
        { channel: channel.uuid },
      );
    });

    return {
      type: 'success',
      stop,
      stream: session.start(outStream),
    };
  }

  protected abstract initializeStream(
    channel: Channel,
  ): Promise<FfmpegTranscodeSession>;
}
