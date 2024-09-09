import { ChannelSessionsResponseSchema } from '@tunarr/types/api';
import dayjs from 'dayjs';
import {
  forEach,
  isEmpty,
  isNil,
  isNull,
  isNumber,
  isUndefined,
  map,
} from 'lodash-es';
import * as fsSync from 'node:fs';
import { PassThrough } from 'node:stream';
import { Readable } from 'stream';
import { v4 } from 'uuid';
import { z } from 'zod';
import { defaultConcatOptions } from '../ffmpeg/ffmpeg.js';
import { FfmpegText } from '../ffmpeg/ffmpegText.js';
import { OnDemandChannelService } from '../services/OnDemandChannelService.js';
import { ActiveChannelManager } from '../stream/ActiveChannelManager.js';
import { ConcatStream } from '../stream/ConcatStream.js';
import { SessionKey } from '../stream/SessionManager.js';
import { SessionType } from '../stream/StreamSession.js';
import { VideoStream } from '../stream/VideoStream.js';
import { StreamQueryStringSchema, TruthyQueryParam } from '../types/schemas.js';
import { RouterPluginAsyncCallback } from '../types/serverType.js';
import { isDefined, run } from '../util/index.js';
import { LoggerFactory } from '../util/logging/LoggerFactory.js';
import { makeLocalUrl } from '../util/serverUtil.js';

let StreamCount = 0;

// eslint-disable-next-line @typescript-eslint/require-await
export const videoRouter: RouterPluginAsyncCallback = async (fastify) => {
  const logger = LoggerFactory.child({
    caller: import.meta,
    className: 'VideoApi',
  });

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

  /**
   * List all active sessions by channel ID
   */
  fastify.get(
    '/api/sessions',
    {
      schema: {
        response: {
          200: z.record(z.array(ChannelSessionsResponseSchema)),
        },
      },
    },
    async (req, res) => {
      const sessions: Record<
        string,
        z.infer<typeof ChannelSessionsResponseSchema>[]
      > = {};
      const allSessions = req.serverCtx.sessionManager.allSessions();
      for (const sessionKey of Object.keys(allSessions)) {
        const session = allSessions[sessionKey as SessionKey];
        const [id, type] = sessionKey.split(/_(.+)?/, 2);
        sessions[id] ??= [];
        sessions[id].push({
          type: type as SessionType,
          numConnections: session?.numConnections() ?? 0,
          connections: map(session?.connections(), (connection, token) => ({
            ...connection,
            lastHeartbeat: session?.lastHeartbeat(token),
          })),
        });
      }

      return res.send(sessions);
    },
  );

  /**
   * Returns a list of active sessions for the given channel ID (or channel number)
   */
  fastify.get(
    '/api/channels/:id/sessions',
    {
      schema: {
        params: z.object({
          id: z.coerce.number().or(z.string().uuid()),
        }),
        response: {
          200: z.array(ChannelSessionsResponseSchema),
          404: z.string(),
        },
      },
    },
    async (req, res) => {
      const channelId = await run(async () => {
        if (isNumber(req.params.id)) {
          return (
            await req.serverCtx.channelDB.getChannelByNumber(req.params.id)
          )?.uuid;
        } else {
          return req.params.id;
        }
      });

      if (isNil(channelId)) {
        return res.status(404).send('Could not derive channel ID');
      }

      const sessions =
        req.serverCtx.sessionManager.getAllConcatSessions(channelId);

      if (isEmpty(sessions)) {
        return res.status(404).send('No session found for channel ID');
      }

      return res.send(
        map(sessions, (session) => ({
          type: session.sessionType,
          numConnections: session?.numConnections() ?? 0,
          connections: map(session?.connections(), (connection, token) => ({
            ...connection,
            lastHeartbeat: session?.lastHeartbeat(token),
          })),
        })),
      );
    },
  );

  /**
   * Stop all transcode sessions for a channel
   */
  fastify.delete(
    '/api/channels/:id/sessions',
    {
      schema: {
        params: z.object({
          id: z.coerce.number().or(z.string().uuid()),
        }),
        response: {
          200: ChannelSessionsResponseSchema,
          404: z.string(),
        },
      },
    },
    async (req, res) => {
      const channelId = await run(async () => {
        if (isNumber(req.params.id)) {
          return (
            await req.serverCtx.channelDB.getChannelByNumber(req.params.id)
          )?.uuid;
        } else {
          return req.params.id;
        }
      });

      if (isNil(channelId)) {
        return res.status(404).send('Could not derive channel ID');
      }

      const sessions =
        req.serverCtx.sessionManager.getAllConcatSessions(channelId);

      if (isEmpty(sessions)) {
        return res.status(404).send('No session found for channel ID');
      }

      forEach(sessions, (session) => session.stop());

      return res.status(201).send();
    },
  );

  /**
   * Returns a continuous, direct MPEGTS video stream for the given channel
   */
  fastify.get(
    '/channels/:id/video',
    {
      schema: {
        params: z.object({
          id: z.coerce.number().or(z.string()),
        }),
        querystring: z.object({
          useSessions: TruthyQueryParam.optional().default(true),
          streamMode: z
            .union([z.literal('hls'), z.literal('legacy')])
            .catch('hls'),
          token: z.string().uuid().optional(),
        }),
      },
      onError(_req, _res, err, done) {
        console.error(err);
        done();
      },
    },
    async (req, res) => {
      // TODO Make this a settings opt-in for experimental behavior
      const channel = await req.serverCtx.channelDB.getChannel(req.params.id);
      if (isNil(channel)) {
        return res.status(404).send();
      }

      if (req.query.useSessions) {
        const token = req.query.token ?? v4();

        const sessionResult =
          await req.serverCtx.sessionManager.getOrCreateConcatSession(
            channel.uuid,
            token,
            {
              ip: req.ip,
              userAgent: req.headers['user-agent'],
            },
            {
              ...defaultConcatOptions,
              audioOnly: false,
              mode: req.query.streamMode === 'hls' ? 'hls' : 'direct',
            },
          );

        if (sessionResult.isFailure()) {
          switch (sessionResult.error.type) {
            case 'channel_not_found':
              return res.status(404).send('Channel not found.');
            case 'generic_error':
              return res.status(500).send('Unable to start session');
          }
        }

        const session = sessionResult.get();

        // We have to create an intermediate stream between the raw one
        // and the response so that nothing messes up the backing raw stream
        // when the request closes (i.e. anything that might happen internal
        // in fastify on the send).
        // TODO: We could probably record periodic heartbeats by listening
        // to the data event on this piped stream. Just debounce them!
        const piped = session.rawStream.pipe(new PassThrough());

        piped.on('close', () => {
          logger.debug(
            { token, ip: req.ip, channel: req.params.id },
            'Concat request closed.',
          );

          session.removeConnection(token);
        });

        return res.header('Content-Type', 'video/mp2t').send(piped);
      } else {
        const lineup = await req.serverCtx.channelDB.loadLineup(channel.uuid);

        const token = v4();

        const result = await new ConcatStream({
          mode: req.query.streamMode === 'hls' ? 'hls' : 'direct',
        }).startStream(req.params.id, false);

        if (result.type === 'error') {
          return res.send(result.httpStatus).send(result.message);
        }

        result.stream.on('close', () => {
          logger.debug('Concat request closed.', {
            token,
            ip: req.ip,
            channel: req.params.id,
          });
          res.raw.end();
        });

        ActiveChannelManager.addChannelConnection(channel.uuid, token, {
          ipAddress: req.ip,
        });

        if (isDefined(lineup.onDemandConfig)) {
          // TODO: Don't instantiate this every time...
          const onDemandService = new OnDemandChannelService(
            req.serverCtx.channelDB,
          );
          await onDemandService.resumeChannel(channel.uuid);
        }

        return res.header('Content-Type', 'video/mp2t').send(result.stream);
      }
    },
  );

  /**
   * Initiates an audio only stream for the given channel
   */
  fastify.get(
    '/channels/:id/radio',
    {
      schema: {
        params: z.object({
          id: z.coerce.number().or(z.string()),
        }),
      },
    },
    async (req, res) => {
      const result = await new ConcatStream().startStream(req.params.id, true);
      if (result.type === 'error') {
        return res.send(result.httpStatus).send(result.message);
      }

      req.raw.on('close', () => {
        result.stop();
      });

      return res.header('Content-Type', 'video/mp2t').send(result.stream);
    },
  );

  /**
   * Internal endpoint which returns the single, raw stream for a video
   * at the given time, or "now"
   */
  fastify.get(
    '/stream',
    {
      schema: {
        querystring: StreamQueryStringSchema,
      },
      onError(req, _, e) {
        logger.error(e, 'Error on /stream: %s. %O', req.raw.url);
      },
    },
    async (req, res) => {
      const videoStream = new VideoStream();

      const channelAndLineup = isNumber(req.query.channel)
        ? await req.serverCtx.channelDB
            .channelIdForNumber(req.query.channel)
            .then((id) =>
              id ? req.serverCtx.channelDB.loadChannelAndLineup(id) : null,
            )
        : await req.serverCtx.channelDB.loadChannelAndLineup(req.query.channel);

      if (isNil(channelAndLineup)) {
        return res.status(404).send();
      }

      const { channel, lineup } = channelAndLineup;

      let t0 = req.query.startTime ?? new Date().getTime();
      // For on-demand channels, we resume where the last streamer left
      // off.
      if (isDefined(lineup.onDemandConfig)) {
        t0 = channel.startTime + lineup.onDemandConfig.cursor;
      }

      logger.debug('Starting stream timestamp: %s', dayjs(t0).format());

      const rawStreamResult = await videoStream.startStream(
        {
          channel: req.query.channel,
          session: req.query.session ?? 0,
          audioOnly: req.query.audioOnly ?? false,
          sessionType: req.query.hls ? 'hls' : 'direct',
        },
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
        // TODO if HLS stream, check the session to see if we can cleana it up
        rawStreamResult.stop();
      });

      return res
        .header('Content-Type', 'video/nut')
        .send(rawStreamResult.stream);
    },
  );

  /**
   * Return an m3u8 playlist for a given channel ID (or channel number)
   */
  fastify.get(
    '/channels/:id/m3u8',
    {
      schema: {
        params: z.object({
          id: z.coerce.number().or(z.string()),
        }),
      },
    },
    async (req, res) => {
      const sessionId = StreamCount++;

      // Check if channel queried is valid
      if (isUndefined(req.params.id)) {
        return res.status(400).send('No Channel Specified');
      }

      if (isNil(await req.serverCtx.channelDB.getChannel(req.params.id))) {
        return res.status(404).send("Channel doesn't exist");
      }

      return res
        .type('application/x-mpegURL')
        .send(
          req.serverCtx.m3uService.buildChannelM3U(
            req.protocol,
            req.hostname,
            req.params.id,
            sessionId,
          ),
        );
    },
  );

  /**
   * Return a playlist in ffconcat file format for the given channel number
   */
  fastify.get(
    '/playlist',
    {
      schema: {
        querystring: z.object({
          channel: z.coerce.number().or(z.string().uuid()),
          audioOnly: TruthyQueryParam.optional().default(false),
          hls: TruthyQueryParam.default(false),
        }),
      },
    },
    async (req, res) => {
      if (isNil(await req.serverCtx.channelDB.getChannel(req.query.channel))) {
        return res.status(404).send("Channel doesn't exist");
      }

      let data = 'ffconcat version 1.0\n';

      const sessionId = StreamCount++;
      const audioOnly = req.query.audioOnly;

      // We're disabling the loading screen for now.
      // loading screen is pointless in audio mode (also for some reason it makes it fail when codec is aac, and I can't figure out why)
      // if (
      //   ffmpegSettings.enableTranscoding &&
      //   ffmpegSettings.normalizeVideoCodec &&
      //   ffmpegSettings.normalizeAudioCodec &&
      //   ffmpegSettings.normalizeResolution &&
      //   ffmpegSettings.normalizeAudio &&
      //   !audioOnly
      // ) {
      //   //loading screen
      //   data += `file 'http://localhost:${
      //     serverOptions().port
      //   }/stream?channel=${
      //     req.query.channel
      //   }&first=0&session=${sessionId}&audioOnly=${audioOnly}'\n`;
      // }

      // data += `file 'http://localhost:${serverOptions().port}/stream?channel=${
      //   req.query.channel
      // }&first=1&session=${sessionId}&audioOnly=${audioOnly}'\n`;

      // We only need 2 entries + stream_loop on the concat command for an infinite
      // stream. See https://trac.ffmpeg.org/wiki/Concatenate#Changingplaylistfilesonthefly
      for (let i = 0; i < 2; i++) {
        const url = makeLocalUrl('/stream', {
          channel: req.query.channel,
          session: sessionId,
          audioOnly,
          hls: req.query.hls,
          index: i,
        });

        data += `file '${url}'\n`;
      }

      return res.type('text').send(data);
    },
  );

  /**
   * Returns a "master" m3u playlist file for the given channel. The playlist
   * contains a single entry which initiates the underlying concat stream
   */
  fastify.get(
    '/media-player/:idOrNumber.m3u',
    {
      schema: {
        params: z.object({
          idOrNumber: z.coerce.number().or(z.string().uuid()),
        }),
        querystring: z.object({
          fast: TruthyQueryParam.optional(),
        }),
      },
    },
    async (req, res) => {
      try {
        const m3u = await req.serverCtx.m3uService.channelMediaPlayerM3u(
          req.params.idOrNumber,
          req.query.fast ? 'm3u8' : 'video',
          req.protocol,
          req.hostname,
        );
        if (isNull(m3u)) {
          return res.status(404).send("Channel doesn't exist");
        }
        return res.type('video/x-mpegurl').status(200).send(m3u);
      } catch (err) {
        logger.error(err);
        return res.status(500).send('There was an error.');
      }
    },
  );

  /**
   *
   */
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
        const m3u = await req.serverCtx.m3uService.channelMediaPlayerM3u(
          req.params.number,
          'radio',
          req.protocol,
          req.hostname,
        );
        if (isNull(m3u)) {
          return res.status(404).send("Channel doesn't exist");
        }
        return res.type('video/x-mpegurl').status(200).send(m3u);
      } catch (err) {
        logger.error(err);
        return res.status(500).send('There was an error.');
      }
    },
  );
};
