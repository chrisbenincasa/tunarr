import { isNil, isUndefined, once } from 'lodash-es';
import { PassThrough, Readable } from 'node:stream';
import { v4 } from 'uuid';
import { FFMPEG } from '../ffmpeg/ffmpeg';
import { serverOptions } from '../globals';
import createLogger from '../logger';
import { getServerContext } from '../serverContext';
import { fileExists } from '../util/fsUtil';

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

const logger = createLogger(import.meta);

export class ConcatStream {
  async startStream(
    channelId: string | number,
    audioOnly: boolean,
  ): Promise<VideoStreamResult> {
    const outStream = new PassThrough();
    const reqId = `'conat-TOFB-${v4()}`;
    console.time(reqId);
    const ctx = getServerContext();
    // Check if channel queried is valid
    // if (isUndefined(req.query.channel)) {
    //   return res.status(500).send('No Channel Specified');
    // }

    const channel = await ctx.channelDB.getChannel(channelId);
    if (isNil(channel)) {
      return {
        type: 'error',
        httpStatus: 404,
        message: "Channel doesn't exist",
      };
      // return res.status(500).send("Channel doesn't exist");
    }

    // void res.hijack();

    const ffmpegSettings = ctx.settings.ffmpegSettings();

    // Check if ffmpeg path is valid
    if (!(await fileExists(ffmpegSettings.ffmpegExecutablePath))) {
      logger.error(
        `FFMPEG path (${ffmpegSettings.ffmpegExecutablePath}) is invalid. The file (executable) doesn't exist.`,
      );
      return {
        type: 'error',
        httpStatus: 500,
        message: `FFMPEG path (${ffmpegSettings.ffmpegExecutablePath}) is invalid. The file (executable) doesn't exist.`,
      };
      // return res
      //   .status(500)
      //   .send(
      //     `FFMPEG path (${ffmpegSettings.ffmpegExecutablePath}) is invalid. The file (executable) doesn't exist.`,
      //   );
    }

    // void res.header('Content-Type', 'video/mp2t');

    logger.info(
      `\r\nStream starting. Channel: ${channel.number} (${channel.name})`,
    );

    const ffmpeg = new FFMPEG(ffmpegSettings, channel); // Set the transcoder options
    ffmpeg.setAudioOnly(audioOnly);

    const stop = once(() => {
      try {
        // res.raw.end();
      } catch (err) {
        logger.error('error ending request', err);
      }
      ffmpeg.kill();
    });

    ffmpeg.on('error', (err) => {
      logger.error('CONCAT - FFMPEG ERROR', err);
      //status was already sent
      stop();
    });

    ffmpeg.on('close', () => {
      logger.debug('CONCAT - FFMPEG CLOSE');
    });

    ffmpeg.on('end', () => {
      logger.debug('FFMPEG END - FFMPEG CLOSE');
      logger.info(
        'Video queue exhausted. Either you played 100 different clips in a row or there were technical issues that made all of the possible 100 attempts fail.',
      );
      stop();
      outStream.push(null);
      // res.raw.write(null);
    });

    // res.raw.on('close', () => {
    //   logger.warn('RESPONSE CLOSE - FFMPEG CLOSE');
    //   // on HTTP close, kill ffmpeg
    //   logger.info(
    //     `\r\nStream ended. Channel: ${channel?.number} (${channel?.name})`,
    //   );
    //   stop();
    // });

    const ff = ffmpeg.spawnConcat(
      `http://localhost:${serverOptions().port}/playlist?channel=${
        channel.number
      }&audioOnly=${audioOnly}`,
    );

    if (isUndefined(ff)) {
      return {
        type: 'error',
        httpStatus: 500,
        message: 'Could not start concat stream',
      };
      // return res.status(500).send('Could not start concat stream');
    }

    // res.raw.writeHead(200, {
    //   'content-type': 'video/mp2t',
    //   'Access-Control-Allow-Origin': '*',
    // });

    const onceListener = once(() => {
      console.timeEnd(reqId);
      ff.removeListener('data', onceListener);
    });

    ff.on('data', onceListener);
    ff.pipe(outStream);

    return {
      type: 'success',
      stop,
      stream: outStream,
    };
    // ff.pipe(res.raw, { end: false });
  }
}
