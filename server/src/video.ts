import fastifyStatic from '@fastify/static';
import { FastifyReply, FastifyRequest } from 'fastify';
import { isNil, isUndefined, map } from 'lodash-es';
import * as fsSync from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'stream';
import { v4 } from 'uuid';
import { z } from 'zod';
import { FfmpegText } from './ffmpegText.js';
import { serverOptions } from './globals.js';
import createLogger from './logger.js';
import { ConcatStream } from './stream/ConcatStream.js';
import { VideoStream } from './stream/VideoStream.js';
import { sessionManager } from './stream/sessionManager.js';
import { StreamQueryStringSchema, TruthyQueryParam } from './types/schemas.js';
import { RouterPluginAsyncCallback } from './types/serverType.js';

const logger = createLogger(import.meta);

let StreamCount = 0;

// eslint-disable-next-line @typescript-eslint/require-await
export const videoRouter: RouterPluginAsyncCallback = async (fastify) => {
  fastify.get('/setup', async (req, res) => {
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

    const ffmpeg = new FfmpegText(
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
      logger.error('FFMPEG ERROR', err);
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
  });

  fastify.get(
    '/video',
    {
      schema: {
        querystring: z.object({
          channel: z.coerce.number().or(z.string()),
        }),
      },
    },
    async (req, res) => {
      const result = await new ConcatStream().startStream(
        req.query.channel,
        false,
      );
      if (result.type === 'error') {
        return res.send(result.httpStatus).send(result.message);
      }

      req.raw.on('close', () => {
        result.stop();
      });

      return res.header('Content-Type', 'video/mp2t').send(result.stream);
    },
  );

  fastify.get(
    '/radio',
    {
      schema: {
        querystring: z.object({
          channel: z.coerce.number().or(z.string()),
        }),
      },
    },
    async (req, res) => {
      const result = await new ConcatStream().startStream(
        req.query.channel,
        false,
      );
      if (result.type === 'error') {
        return res.send(result.httpStatus).send(result.message);
      }

      req.raw.on('close', () => {
        result.stop();
      });

      return res.header('Content-Type', 'video/mp2t').send(result.stream);
    },
  );

  fastify.get(
    '/stream',
    {
      schema: {
        querystring: StreamQueryStringSchema,
      },
      onError(req, _, e) {
        logger.error('Error on /stream: %s. %O', req.raw.url, e);
      },
    },
    async (req, res) => {
      const t0 = new Date().getTime();
      const videoStream = new VideoStream();
      const rawStreamResult = await videoStream.startStream(
        req.query,
        t0,
        true,
      );

      if (rawStreamResult.type === 'error') {
        logger.error(
          'Error starting stream! Message: %s, Error: %O',
          rawStreamResult.message,
          rawStreamResult.error ?? null,
        );
        return res
          .status(rawStreamResult.httpStatus)
          .send(rawStreamResult.message);
      }

      req.raw.on('close', () => {
        logger.debug('Client closed video stream, stopping it now.');
        rawStreamResult.stop();
      });

      return res
        .header('Content-Type', 'video/mp2t')
        .send(rawStreamResult.stream);
    },
  );

  fastify.get(
    '/m3u8',
    {
      schema: {
        querystring: z.object({
          channel: z.coerce.number(),
        }),
      },
    },
    async (req, res) => {
      const sessionId = StreamCount++;

      //res.type('application/vnd.apple.mpegurl')
      void res.type('application/x-mpegURL');

      // Check if channel queried is valid
      if (isUndefined(req.query.channel)) {
        return res.status(400).send('No Channel Specified');
      }

      if (isNil(await req.serverCtx.channelDB.getChannel(req.query.channel))) {
        return res.status(404).send("Channel doesn't exist");
      }

      // Maximum number of streams to concatinate beyond channel starting
      // If someone passes this number then they probably watch too much television
      const maxStreamsToPlayInARow = 100;

      const lines: string[] = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-MEDIA-SEQUENCE:0',
        '#EXT-X-ALLOW-CACHE:YES',
        '#EXT-X-TARGETDURATION:60',
        '#EXT-X-PLAYLIST-TYPE:VOD',
        // `#EXT-X-STREAM-INF:BANDWIDTH=1123000`,
      ];

      const ffmpegSettings = req.serverCtx.settings.ffmpegSettings();

      if (ffmpegSettings.enableTranscoding) {
        lines.push(
          `${req.protocol}://${req.hostname}/stream?channel=${req.query.channel}&first=0&m3u8=1&session=${sessionId}`,
        );
      }
      lines.push(
        `${req.protocol}://${req.hostname}/stream?channel=${req.query.channel}&first=1&m3u8=1&session=${sessionId}`,
      );
      for (let i = 0; i < maxStreamsToPlayInARow - 1; i++) {
        lines.push(
          `${req.protocol}://${req.hostname}/stream?channel=${req.query.channel}&m3u8=1&session=${sessionId}`,
        );
      }

      return res.send(lines.join('\n'));
    },
  );

  fastify.get(
    '/playlist',
    {
      schema: {
        querystring: z.object({
          channel: z.coerce.number().optional(),
          audioOnly: TruthyQueryParam.optional().default('0'),
        }),
      },
    },
    async (req, res) => {
      void res.type('text');

      // Check if channel queried is valid
      if (isUndefined(req.query.channel)) {
        return res.status(400).send('No Channel Specified');
      }

      if (isNil(await req.serverCtx.channelDB.getChannel(req.query.channel))) {
        return res.status(404).send("Channel doesn't exist");
      }

      // Maximum number of streams to concatinate beyond channel starting
      // If someone passes this number then they probably watch too much television
      // TODO: Make this an option - who cares how much TV people watch :)
      const maxStreamsToPlayInARow = 100;

      let data = 'ffconcat version 1.0\n';

      const ffmpegSettings = req.serverCtx.settings.ffmpegSettings();

      const sessionId = StreamCount++;
      const audioOnly = req.query.audioOnly;

      // loading screen is pointless in audio mode (also for some reason it makes it fail when codec is aac, and I can't figure out why)
      if (
        ffmpegSettings.enableTranscoding &&
        ffmpegSettings.normalizeVideoCodec &&
        ffmpegSettings.normalizeAudioCodec &&
        ffmpegSettings.normalizeResolution &&
        ffmpegSettings.normalizeAudio &&
        !audioOnly
      ) {
        //loading screen
        data += `file 'http://localhost:${
          serverOptions().port
        }/stream?channel=${
          req.query.channel
        }&first=0&session=${sessionId}&audioOnly=${audioOnly}'\n`;
      }

      data += `file 'http://localhost:${serverOptions().port}/stream?channel=${
        req.query.channel
      }&first=1&session=${sessionId}&audioOnly=${audioOnly}'\n`;

      for (let i = 0; i < maxStreamsToPlayInARow - 1; i++) {
        data += `file 'http://localhost:${
          serverOptions().port
        }/stream?channel=${
          req.query.channel
        }&session=${sessionId}&audioOnly=${audioOnly}'\n`;
      }

      return res.send(data);
    },
  );

  const mediaPlayer = async (
    channelNum: number,
    path: string,
    req: FastifyRequest,
    res: FastifyReply,
  ) => {
    if (isNil(await req.serverCtx.channelDB.getChannel(channelNum))) {
      return res.status(404).send("Channel doesn't exist");
    }

    const content = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-ALLOW-CACHE:YES',
      '#EXT-X-TARGETDURATION:60',
      '#EXT-X-PLAYLIST-TYPE:VOD',
      `${req.protocol}://${req.hostname}/${path}?channel=${channelNum}`,
    ];

    return res
      .type('video/x-mpegurl')
      .status(200)
      .send(content.join('\n') + '\n');
  };

  fastify.get(
    '/media-player/:number.m3u',
    {
      schema: {
        params: z.object({
          number: z.coerce.number(),
        }),
        querystring: z.object({
          fast: TruthyQueryParam.optional(),
        }),
      },
    },
    async (req, res) => {
      try {
        let path = 'video';
        if (req.query.fast) {
          path = 'm3u8';
        }
        return await mediaPlayer(req.params.number, path, req, res);
      } catch (err) {
        logger.error(err);
        return res.status(500).send('There was an error.');
      }
    },
  );

  fastify.get(
    '/media-player/fast/:number.m3u',
    {
      schema: {
        params: z.object({
          number: z.coerce.number(),
        }),
      },
    },
    async (req, res) => {
      try {
        const path = 'm3u8';
        return await mediaPlayer(req.params.number, path, req, res);
      } catch (err) {
        logger.error(err);
        return res.status(500).send('There was an error.');
      }
    },
  );

  fastify.get(
    '/media-player/radio/:number.m3u',
    {
      schema: {
        params: z.object({
          number: z.coerce.number(),
        }),
      },
    },
    async (req, res) => {
      try {
        const path = 'radio';
        return await mediaPlayer(req.params.number, path, req, res);
      } catch (err) {
        logger.error(err);
        return res.status(500).send('There was an error.');
      }
    },
  );

  fastify
    .register(fastifyStatic, {
      root: join(process.cwd(), 'streams'),
      decorateReply: false,
      prefix: '/streams/',
    })
    .decorateRequest('streamChannel', null)
    .addHook('onRequest', (req, res, done) => {
      const matches = req.url.match(/^\/streams\/stream_(.*)\/stream\.m3u8.*/);
      if (!isNil(matches) && matches.length > 1) {
        const query = req.query as Record<string, string>;
        const channelId = matches[1];
        req.streamChannel = channelId;
        const token = query['token'];
        const session = sessionManager.getSession(channelId);
        if (isNil(session)) {
          void res.status(404).send();
          return;
        }

        if (isNil(token)) {
          void res.status(400).send('Requires a token');
          return;
        }

        if (!session.isKnownConnection(token)) {
          void res.status(404).send('Unrecognized session token: ' + token);
        }

        session.recordHeartbeat(token);
      }
      done();
    })
    .addHook('onResponse', (req, res, done) => {
      const token = (req.query as Record<string, string>)['token'];
      if (
        res.statusCode === 200 &&
        !isNil(token) &&
        !isNil(req.streamChannel)
      ) {
        const session = sessionManager.getSession(req.streamChannel);
        if (!isNil(session) && session.isKnownConnection(token)) {
          session.recordHeartbeat(token);
        }
        // Keep track of active clients.
        // Parse out the channel ID from the request path
        // If we get an ID, reset the counter
        // console.log(req.url);
      }
      done();
    })
    .put('/streams/*', async (_, res) => {
      await res.send(200);
    });

  fastify.get(
    '/media-player/:number/hls',
    {
      schema: {
        params: z.object({
          number: z.coerce.number(),
        }),
      },
    },
    async (req, res) => {
      const channel = await req.serverCtx.channelDB.getChannel(
        req.params.number,
      );

      if (isNil(channel)) {
        return res.status(404).send("Channel doesn't exist");
      }

      const token = v4();

      const session = await sessionManager.getOrCreateSession(
        channel,
        req.serverCtx.settings.ffmpegSettings(),
        token,
        {
          ip: req.ip,
        },
      );

      if (isNil(session)) {
        return res.status(500).send('Error starting session');
      }

      return res.send({
        streamPath: `${session.streamPath}?token=${token}`,
      });
    },
  );

  fastify.get(
    '/media-player/:number/session',
    {
      schema: {
        params: z.object({
          number: z.coerce.number(),
        }),
      },
    },
    async (req, res) => {
      const channel = await req.serverCtx.channelDB.getChannel(
        req.params.number,
      );
      if (isNil(channel)) {
        return res.status(404).send("Channel doesn't exist");
      }

      const session = sessionManager.getSession(channel.uuid);

      return res.send({
        channelId: channel.uuid,
        channelNumber: channel.number,
        numConnections: session?.numConnections() ?? 0,
        connections: map(session?.connections(), (connection, token) => ({
          ...connection,
          lastHeartbeat: session?.lastHeartbeat(token),
        })),
      });
    },
  );

  fastify.delete(
    '/media-player/:number/session',
    {
      schema: {
        params: z.object({
          number: z.coerce.number(),
        }),
      },
    },
    async (req, res) => {
      const channel = await req.serverCtx.channelDB.getChannel(
        req.params.number,
      );
      if (isNil(channel)) {
        return res.status(404).send("Channel doesn't exist");
      }

      const session = sessionManager.getSession(channel.uuid);

      if (isNil(session)) {
        return res.status(404).send('No sessions for channel');
      }

      session.stop();

      return res.send();
    },
  );
};
