import { isNil, isUndefined, once, round } from 'lodash-es';
import { PassThrough, Readable } from 'node:stream';
import { v4 } from 'uuid';
import { ConcatOptions, FFMPEG } from '../ffmpeg/ffmpeg';
import { serverOptions } from '../globals';
import { getServerContext } from '../serverContext';
import { fileExists } from '../util/fsUtil';
import { LoggerFactory } from '../util/logging/LoggerFactory';

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

export class ConcatStream {
  private logger = LoggerFactory.child({ caller: import.meta });

  async startStream(
    channelId: string | number,
    audioOnly: boolean,
    concatOptions?: Partial<ConcatOptions>,
  ): Promise<VideoStreamResult> {
    const outStream = new PassThrough();
    const reqId = `'conat-TOFB-${v4()}`;
    const start = performance.now();
    const ctx = getServerContext();

    const channel = await ctx.channelDB.getChannel(channelId);
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

    const ffmpeg = new FFMPEG(ffmpegSettings, channel); // Set the transcoder options
    ffmpeg.setAudioOnly(audioOnly);

    const stop = once(() => {
      try {
        // res.raw.end();
      } catch (err) {
        this.logger.error('error ending request', err);
      }
      ffmpeg.kill();
    });

    ffmpeg.on('error', (err) => {
      this.logger.error(err, 'CONCAT - FFMPEG ERROR');
      stop();
    });

    ffmpeg.on('end', () => {
      this.logger.info(
        'Video queue exhausted. Either you played 100 different clips in a row or there were technical issues that made all of the possible 100 attempts fail.',
      );
      stop();
      outStream.push(null);
    });

    const concatUrl = new URL(
      `http://localhost:${serverOptions().port}/playlist`,
    );
    concatUrl.searchParams.set('channel', channel.number.toString());
    // TODO: Do we know this is true? We probably need to push a param through
    concatUrl.searchParams.set('audioOnly', 'false');
    concatUrl.searchParams.set('hls', `${!!concatOptions?.enableHls}`);

    const ff = ffmpeg.spawnConcat(concatUrl.toString(), concatOptions);

    if (isUndefined(ff)) {
      return {
        type: 'error',
        httpStatus: 500,
        message: 'Could not start concat stream',
      };
    }

    const onceListener = once(() => {
      const end = performance.now();
      this.logger.debug(
        `Request ID ${reqId} concat time-to-first-byte: ${round(
          end - start,
          4,
        )}ms`,
        { channel: channel.uuid },
      );
      ff.removeListener('data', onceListener);
    });

    ff.on('data', onceListener);
    ff.on('data', (d) => {
      if (isNil(d)) {
        this.logger.debug('Got nil from concat stream', {
          channel: channel.uuid,
        });
      }
    });
    ff.on('close', () => {
      this.logger.debug('Concat stream was closed!', { channel: channel.uuid });
    });

    return {
      type: 'success',
      stop,
      stream: ff.pipe(outStream),
    };
  }
}
