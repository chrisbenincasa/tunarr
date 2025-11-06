import { container } from '@/container.js';
import { FfmpegText } from '@/ffmpeg/ffmpegText.js';
import { VideoStream } from '@/stream/VideoStream.js';
import { TruthyQueryParam } from '@/types/schemas.js';
import type { RouterPluginAsyncCallback } from '@/types/serverType.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { makeLocalUrl } from '@/util/serverUtil.js';
import { ChannelStreamModeSchema } from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import { isNil } from 'lodash-es';
import * as fsSync from 'node:fs';
import { Readable } from 'node:stream';
import { match, P } from 'ts-pattern';
import { z } from 'zod/v4';

const FfmpegPlaylistQuerySchema = z.object({
  channel: z.string().uuid(),
  audioOnly: TruthyQueryParam.optional().default(false),
  mode: ChannelStreamModeSchema,
  token: z.string().uuid().optional(),
});

export type FfmpegPlaylistQuery = z.infer<typeof FfmpegPlaylistQuerySchema>;

// eslint-disable-next-line @typescript-eslint/require-await
export const videoApiRouter: RouterPluginAsyncCallback = async (fastify) => {
  const logger = LoggerFactory.child({
    caller: import.meta,
    className: 'VideoApi',
  });

  fastify.get(
    '/setup',
    {
      schema: { hide: true },
    },
    async (req, res) => {
      const ffmpegSettings = req.serverCtx.settings.ffmpegSettings();
      // Check if ffmpeg path is valid
      if (!fsSync.existsSync(ffmpegSettings.ffmpegExecutablePath)) {
        logger.error(
          `FFMPEG path (${ffmpegSettings.ffmpegExecutablePath}) is invalid. The file (executable) doesn't exist.`,
        );

        return res
          .status(500)
          .send(
            `FFMPEG path (${ffmpegSettings.ffmpegExecutablePath}) is invalid. The file (executable) doesn't exist.`,
          );
      }

      logger.info(`\r\nStream starting. Channel: 1 (Tunarr)`);

      const defaultConfig =
        await req.serverCtx.transcodeConfigDB.getDefaultConfig();

      if (!defaultConfig) {
        throw new Error('No default transcode config found');
      }

      const ffmpeg = new FfmpegText(
        defaultConfig,
        ffmpegSettings,
        'Tunarr (No Channels Configured)',
        'Configure your channels using the Tunarr Web UI',
      );

      const buffer = new Readable();
      buffer._read = () => {};

      ffmpeg.on('data', (data) => {
        buffer.push(data);
      });

      ffmpeg.on('error', (err) => {
        logger.error(err, 'FFMPEG ERROR');
        buffer.push(null);
        void res.status(500).send('FFMPEG ERROR');
        return;
      });

      ffmpeg.on('close', () => {
        buffer.push(null);
      });

      res.raw.on('close', () => {
        // on HTTP close, kill ffmpeg
        ffmpeg.kill();
        logger.info(`\r\nStream ended. Channel: 1 (Tunarr)`);
      });

      return res.send(buffer);
    },
  );

  /**
   * Internal endpoint which returns the single, raw stream for a video
   * at the given time, or "now"
   */
  fastify.get(
    '/stream:ext(^\\.[mkv|ts|mp4]+)',
    {
      schema: {
        hide: true,
        params: z.object({
          ext: z.enum(['.mkv', '.ts', '.mp4']).optional(),
        }),
        querystring: z.object({
          channel: z.coerce.number().or(z.uuid()),
          audioOnly: TruthyQueryParam.catch(false),
          mode: ChannelStreamModeSchema,
          startTime: z.coerce.number().optional(),
          token: z.uuid().optional(),
        }),
      },
      onRequest(req, _, done) {
        logger.debug('Raw stream requested: %s', req.raw.url);
        done();
      },
      onError(req, _, e) {
        logger.error(e, 'Error on /stream: %s', req.raw.url);
      },
    },
    async (req, res) => {
      const videoStream = container.get(VideoStream);

      const channel = await req.serverCtx.channelDB.getChannel(
        req.query.channel,
      );

      if (isNil(channel)) {
        return res.status(404).send();
      }

      // Consult on-demand service to see if we need to adjust the "start" timestamp for
      // this stream. If not, we just return the timestamp we gave it.
      let now = req.query.startTime ?? +dayjs();
      now = await req.serverCtx.onDemandChannelService.getLiveTimestamp(
        channel.uuid,
        now,
      );

      logger.debug('Starting stream timestamp: %s', dayjs(now).format());

      const rawStreamResult = await videoStream.startStream(
        {
          channel: req.query.channel,
          audioOnly: req.query.audioOnly ?? false,
          streamMode: req.query.mode,
          sessionToken: req.query.token,
        },
        now,
        true,
      );

      if (rawStreamResult.type === 'error') {
        logger.error(
          rawStreamResult.error ?? null,
          'Error starting stream! Message: %s',
          rawStreamResult.message,
        );
        return res
          .status(rawStreamResult.httpStatus)
          .send(rawStreamResult.message);
      }

      req.raw.on('close', () => {
        logger.debug('Client closed video stream, stopping it now.');
        // TODO if HLS stream, check the session to see if we can clean it up
        rawStreamResult.stop();
      });

      const settings = req.serverCtx.settings.ffmpegSettings();

      const contentType = match([
        req.query.mode,
        settings.hlsDirectOutputFormat,
      ])
        .with([P.union('hls', 'mpegts'), P._], () => 'video/mp2t')
        .with(['hls_slower', P._], () => 'video/nut')
        .with(['hls_direct', 'mpegts'], () => 'video/mp2t')
        .with(['hls_direct', 'mkv'], () => 'video/matroska')
        .with(['hls_direct', 'mp4'], () => 'video/mp4')
        .exhaustive();

      return res
        .header('Content-Type', contentType)
        .send(rawStreamResult.stream);
    },
  );

  /**
   * Return a playlist in ffconcat file format for the given channel number
   */
  fastify.get(
    '/ffmpeg/playlist',
    {
      schema: {
        tags: ['Streaming'],
        description:
          'Return a playlist in ffconcat file format for the given channel',
        querystring: FfmpegPlaylistQuerySchema,
      },
    },
    async (req, res) => {
      const lines = ['ffconcat version 1.0'];

      const audioOnly = req.query.audioOnly;
      for (let i = 0; i < 2; i++) {
        const url = makeLocalUrl('/stream', {
          channel: req.query.channel,
          audioOnly,
          mode: req.query.mode,
          token: req.query.token,
        });

        lines.push(`file '${url}'`);
      }

      return res.type('text').send(lines.join('\n'));
    },
  );
};
