import { isNil, isUndefined, once, round } from 'lodash-es';
import { PassThrough } from 'stream';
import { v4 } from 'uuid';
import { FfmpegTranscodeSession } from '../ffmpeg/FfmpegTrancodeSession';
import { ConcatOptions, FFMPEG } from '../ffmpeg/ffmpeg';
import { getServerContext } from '../serverContext';
import { Result } from '../types/result';
import { ChannelNotFoundError } from '../util/errors';
import { fileExists } from '../util/fsUtil';
import { LoggerFactory } from '../util/logging/LoggerFactory';
import { makeLocalUrl } from '../util/serverUtil.js';

type ConcatStreamOptions = {
  parentProcessType: 'hls' | 'direct';
};

/**
 * Class responsible for intiaializing an {@link FfmpegTrancodeSession}
 * that concatenates streams together from a source.
 */
export class ConcatStream {
  private logger = LoggerFactory.child({
    className: this.constructor.name,
  });
  protected ffmpeg: FFMPEG;

  constructor(
    private concatOptions?: Partial<ConcatOptions & ConcatStreamOptions>,
  ) {}

  async startStream(
    channelId: string | number,
    audioOnly: boolean,
  ): Promise<Result<FfmpegTranscodeSession>> {
    const outStream = new PassThrough();
    const reqId = `'conat-TOFB-${v4()}`;
    const start = performance.now();
    const ctx = getServerContext();

    const channel = await ctx.channelDB.getChannelDirect(channelId);
    if (isNil(channel)) {
      return Result.failure(new ChannelNotFoundError(channelId));
    }

    const ffmpegSettings = ctx.settings.ffmpegSettings();

    // Check if ffmpeg path is valid
    if (!(await fileExists(ffmpegSettings.ffmpegExecutablePath))) {
      this.logger.error(
        `FFMPEG path (${ffmpegSettings.ffmpegExecutablePath}) is invalid. The file (executable) doesn't exist.`,
      );
      return Result.failure(
        new Error(
          `FFMPEG path (${ffmpegSettings.ffmpegExecutablePath}) is invalid. The file (executable) doesn't exist.`,
        ),
      );
    }

    this.logger.info(
      `\r\nStream starting. Channel: ${channel.number} (${channel.name})`,
    );

    this.ffmpeg = new FFMPEG(ffmpegSettings, channel, audioOnly); // Set the transcoder options

    const concatUrl =
      this.concatOptions?.mode === 'hls'
        ? makeLocalUrl(`/media-player/${channel.uuid}/hls`)
        : makeLocalUrl('/playlist', {
            channel: channel.number,
            audioOnly: false,
            hls: this.concatOptions?.parentProcessType === 'hls',
          });

    const session =
      this.concatOptions?.mode === 'hls'
        ? this.ffmpeg.createHlsConcatSession(concatUrl)
        : this.ffmpeg.createConcatSession(concatUrl, this.concatOptions);

    if (isUndefined(session)) {
      return Result.failure(new Error('Could not start ffmpeg'));
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

    return Result.success(session);
  }
}
