import type { Channel } from '@/db/schema/Channel.js';
import type { BaseHlsSession } from '@/stream/hls/BaseHlsSession.js';
import { HlsPlaylistCreator } from '@/stream/hls/HlsPlaylistCreator.js';
import type { Result } from '@/types/result.js';
import { TruthyQueryParam } from '@/types/schemas.js';
import type { RouterPluginAsyncCallback } from '@/types/serverType.js';
import type { Maybe } from '@/types/util.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { makeLocalUrl } from '@/util/serverUtil.js';
import fastifyStatic from '@fastify/static';
import type { StreamConnectionDetails } from '@tunarr/types/api';
import { ChannelStreamModeSchema } from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import type { FastifyReply } from 'fastify';
import { isArray, isNil, isNumber, isUndefined } from 'lodash-es';
import fs from 'node:fs/promises';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { format } from 'node:util';
import { v4 } from 'uuid';
import z from 'zod/v4';

export const streamApi: RouterPluginAsyncCallback = async (fastify) => {
  const logger = LoggerFactory.child({
    caller: import.meta,
    className: 'StreamApi',
  });

  fastify.addHook('onError', (req, _, error, done) => {
    logger.error(
      error,
      '%s %s',
      isArray(req.routeOptions.method)
        ? req.routeOptions.method.join(', ')
        : req.routeOptions.method,
      req.routeOptions.url,
    );
    done();
  });

  await fastify.register(fastifyStatic, {
    // TODO: Is this even necessary anymore?
    root: join(process.cwd(), 'streams'),
    prefix: '/streams/',
    schemaHide: true,
    decorateReply: true,
  });

  fastify.get(
    '/stream/channels/:id',
    {
      schema: {
        tags: ['Streaming'],
        params: z.object({
          id: z.coerce.number().or(z.uuid()),
        }),
        querystring: z.object({
          streamMode: ChannelStreamModeSchema.optional(),
          token: z.uuid().optional(),
          audioOnly: TruthyQueryParam.optional().default(false),
        }),
      },
    },
    async (req, res) => {
      const channel = await req.serverCtx.channelDB.getChannel(req.params.id);
      if (isNil(channel)) {
        return res.status(404).send('Channel not found.');
      }

      const mode = req.query.streamMode ?? channel.streamMode;

      const params = new URLSearchParams();
      params.set('mode', mode);

      switch (mode) {
        case 'hls':
        case 'hls_slower':
        case 'hls_direct':
          return res.redirect(
            `/stream/channels/${channel.uuid}.m3u8?${params.toString()}`,
          );
        case 'mpegts':
          return res.redirect(
            `/stream/channels/${channel.uuid}.ts?${params.toString()}`,
          );
      }
    },
  );

  /**
   * Returns a continuous, direct MPEGTS video stream for the given channel
   */
  fastify.get(
    '/stream/channels/:id.ts',
    {
      schema: {
        tags: ['Streaming'],
        description:
          'Returns a continuous, direct MPEGTS video stream for the given channel',
        params: z.object({
          id: z.coerce.number().or(z.uuid()),
        }),
        querystring: z.object({
          streamMode: ChannelStreamModeSchema.optional(),
          token: z.uuid().optional(),
          audioOnly: TruthyQueryParam.optional().default(false),
        }),
      },
      onError(_req, _res, err, done) {
        console.error(err);
        done();
      },
    },
    async (req, res) => {
      const channel = await req.serverCtx.channelDB.getChannel(req.params.id);
      if (isNil(channel)) {
        return res.status(404).send('Channel not found.');
      }

      const lineup = await req.serverCtx.channelDB.loadLineup(channel.uuid);

      const mode = req.query.streamMode ?? channel.streamMode;
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
            audioOnly: req.query.audioOnly,
            sessionType: `${mode}_concat`,
          },
        );

      if (sessionResult.isFailure()) {
        switch (sessionResult.error.type) {
          case 'channel_not_found':
            return res.status(404).send('Channel not found.');
          case 'generic_error':
            return res.status(500).send('Unable to start session');
          case 'transcode_config_not_found':
            return res.status(404).send('Transcode config not found');
        }
      }

      const session = sessionResult.get();

      if (lineup.onDemandConfig) {
        await req.serverCtx.onDemandChannelService.resumeChannel(channel.uuid);
      }

      // We have to create an intermediate stream between the raw one
      // and the response so that nothing messes up the backing raw stream
      // when the request closes (i.e. anything that might happen internal
      // in fastify on the send).
      // TODO: We could probably record periodic heartbeats by listening
      // to the data event on this piped stream. Just debounce them!
      const piped = session.rawStream.pipe(
        new PassThrough({ allowHalfOpen: false }),
      );

      piped.on('close', () => {
        logger.debug(
          { token, ip: req.ip, channel: req.params.id },
          'Concat request closed.',
        );

        session.removeConnection(token);
      });

      session.on('end', () => {
        logger.debug(
          { token, ip: req.ip, channel: req.params.id },
          'Session end - closing response stream',
        );
        piped.end();
      });

      session.on('cleanup', () => {
        logger.debug(
          { token, ip: req.ip, channel: req.params.id },
          'Session cleanup - closing response stream',
        );
        piped.end();
      });

      // Close the request on error.
      session.on('error', (error) => {
        logger.error(
          { token, ip: req.ip, channel: req.params.id, error },
          'Session error - closing response stream',
        );
        piped.end();
      });

      return res.header('Content-Type', 'video/mp2t').send(piped);
    },
  );

  /**
   * Initiates an audio only stream for the given channel
   */
  fastify.get(
    '/stream/channels/:id/radio.ts',
    {
      schema: {
        hide: true,
        params: z.object({
          id: z.coerce.number().or(z.string().uuid()),
        }),
        querystring: z.object({
          streamMode: ChannelStreamModeSchema.optional(),
          token: z.string().uuid().optional(),
        }),
      },
    },
    async (req, res) => {
      return res.redirect(
        makeLocalUrl(`/stream/channels/${req.params.id}.ts`, {
          audioOnly: true,
          ...req.query,
        }),
      );
    },
  );

  fastify.get(
    '/stream/channels/:id/:sessionType/:file',
    {
      schema: {
        hide: true,
        params: z.object({
          sessionType: ChannelStreamModeSchema.refine(
            (typ) => typ !== 'mpegts',
          ),
          id: z.string().uuid(),
          file: z.string(),
        }),
      },
      config: {
        disableRequestLogging: true,
      },
    },
    async (req, res) => {
      let session: Maybe<BaseHlsSession>;
      switch (req.params.sessionType) {
        case 'hls':
          session = req.serverCtx.sessionManager.getHlsSession(req.params.id);
          break;
        case 'hls_slower':
          session = req.serverCtx.sessionManager.getHlsSlowerSession(
            req.params.id,
          );
          break;
        default:
          return res
            .status(400)
            .send(
              `Invalid sesssion type for fragment file serving: ${req.params.sessionType}`,
            );
      }

      if (isUndefined(session)) {
        return res.status(404).send('No session found');
      }

      session.recordHeartbeat(req.ip);

      return res.sendFile(req.params.file, session.workingDirectory);
    },
  );

  fastify.route({
    url: '/stream/channels/:id.m3u8',
    method: ['HEAD', 'GET'],
    schema: {
      tags: ['Streaming'],
      description:
        'Returns an m3u8 playlist for the given channel, for use in HLS',
      params: z.object({
        id: z.uuid().or(z.coerce.number()),
      }),
      querystring: z.object({
        mode: ChannelStreamModeSchema.optional(),
      }),
    },
    handler: async (req, res) => {
      const connectionDetails: StreamConnectionDetails = {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      };

      let channel: Maybe<Channel>;
      let channelId: string;
      if (isNumber(req.params.id)) {
        channel = await req.serverCtx.channelDB.getChannel(req.params.id);
        if (isNil(channel)) {
          return res.status(404).send('Channel not found.');
        }
        channelId = channel.uuid;
      } else {
        channelId = req.params.id;
      }

      let mode = req.query.mode;
      if (isUndefined(mode)) {
        channel ??= await req.serverCtx.channelDB.getChannel(req.params.id);
        if (isNil(channel)) {
          return res.status(404).send('Channel not found.');
        }
        mode = channel.streamMode;
      }

      let sessionResult: Result<FastifyReply>;
      switch (mode) {
        case 'hls':
          sessionResult = await req.serverCtx.sessionManager
            .getOrCreateHlsSession(channelId, req.ip, connectionDetails, {})
            .then((result) =>
              result.mapAsync(async (session) => {
                session.recordHeartbeat(req.ip);
                const playlistResult = await session.trimPlaylist(
                  dayjs().subtract(30, 'seconds'),
                );

                if (playlistResult.isFailure()) {
                  logger.error(playlistResult.error);
                  throw new Error(
                    'Error retrieving HLS playlist for playback',
                    { cause: playlistResult.error },
                  );
                }

                const playlist = playlistResult.get();

                if (!playlist) {
                  const fmtError = format(
                    'No playlist found for channel %s at path %s. This could mean the stream is not ready.',
                    channelId,
                    session.m3uPlaylistPath,
                  );
                  logger.error(fmtError);
                  throw new Error(fmtError);
                }

                return res
                  .type('application/vnd.apple.mpegurl')
                  .send(playlist.playlist);
              }),
            );

          break;
        case 'hls_slower':
          sessionResult = await req.serverCtx.sessionManager
            .getOrCreateHlsSlowerSession(
              channelId,
              req.ip,
              connectionDetails,
              {},
            )
            .then((result) =>
              result.mapAsync(async (session) => {
                session.recordHeartbeat(req.ip);
                const playlist = await fs.readFile(session.streamPath);
                return res.type('application/vnd.apple.mpegurl').send(playlist);
              }),
            );
          break;
        case 'hls_direct': {
          const ffmpegSettings = req.serverCtx.settings.ffmpegSettings();
          const playlist = await new HlsPlaylistCreator(
            req.serverCtx.streamProgramCalculator,
          ).createPlaylist(channelId, dayjs(), {
            protocol: req.protocol,
            host: req.host,
            channelIdOrNumber: channelId,
            streamMode: mode,
            outputFormat: ffmpegSettings.hlsDirectOutputFormat,
          });
          return res.type('application/vnd.apple.mpegurl').send(playlist);
        }
        case 'mpegts':
          return res.status(400).send();
      }

      if (sessionResult.isFailure()) {
        logger.error(sessionResult.error);
      }

      return sessionResult.getOrElse(() => {
        return res.status(500).send('Error starting or retrieving session');
      });
    },
  });
};
