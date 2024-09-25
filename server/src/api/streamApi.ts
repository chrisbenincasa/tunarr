import fastifyStatic from '@fastify/static';
import { StreamConnectionDetails } from '@tunarr/types/api';
import { ChannelStreamModeSchema } from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import { FastifyReply } from 'fastify';
import { isNil, isNumber, isUndefined } from 'lodash-es';
import fs from 'node:fs/promises';
import { join } from 'node:path';
import { PassThrough } from 'stream';
import { v4 } from 'uuid';
import z from 'zod';
import { Channel } from '../dao/direct/derivedTypes';
import { defaultConcatOptions } from '../ffmpeg/ffmpeg';
import { BaseHlsSession } from '../stream/hls/BaseHlsSession';
import { Result } from '../types/result';
import { TruthyQueryParam } from '../types/schemas';
import { RouterPluginAsyncCallback } from '../types/serverType';
import { Maybe } from '../types/util';
import { LoggerFactory } from '../util/logging/LoggerFactory';
import { makeLocalUrl } from '../util/serverUtil';

// eslint-disable-next-line @typescript-eslint/require-await
export const streamApi: RouterPluginAsyncCallback = async (fastify) => {
  const logger = LoggerFactory.child({
    caller: import.meta,
    className: 'StreamApi',
  });

  await fastify.register(fastifyStatic, {
    root: join(process.cwd(), 'streams'),
    prefix: '/streams/',
    schemaHide: true,
    decorateReply: true,
  });

  fastify.get(
    '/stream/channels/:id',
    {
      schema: {
        params: z.object({
          id: z.coerce.number().or(z.string()),
        }),
        querystring: z.object({
          streamMode: ChannelStreamModeSchema.optional(),
          token: z.string().uuid().optional(),
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

      switch (mode) {
        case 'hls':
        case 'hls_slower':
          return res.redirect(
            `/stream/channels/${channel.uuid}.m3u8?streamMode=${mode}`,
          );
        case 'mpegts':
          return res.redirect(
            `/stream/channels/${channel.uuid}.ts?streamMode=${mode}`,
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
        params: z.object({
          id: z.coerce.number().or(z.string()),
        }),
        querystring: z.object({
          streamMode: ChannelStreamModeSchema.optional(),
          token: z.string().uuid().optional(),
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
            concatOptions: { ...defaultConcatOptions },
            audioOnly: req.query.audioOnly,
            sessionType: `${mode}_concat` as const,
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

      session.on('end', () => piped.end());
      session.on('cleanup', () => piped.end());

      // Close the request on error.
      session.on('error', () => piped.end());

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
      onRequest: (req, _, done) => {
        req.disableRequestLogging = true;
        done();
      },
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

  fastify.get(
    '/stream/channels/:id.m3u8',
    {
      schema: {
        params: z.object({
          id: z.string().uuid().or(z.coerce.number()),
        }),
        querystring: z.object({
          mode: ChannelStreamModeSchema.optional(),
        }),
      },
    },
    async (req, res) => {
      const connectionDetails: StreamConnectionDetails = {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      };

      let channel: Maybe<Channel>;
      let channelId: string;
      if (isNumber(req.params.id)) {
        channel = await req.serverCtx.channelDB.getChannelDirect(req.params.id);
        if (isNil(channel)) {
          return res.status(404).send('Channel not found.');
        }
        channelId = channel.uuid;
      } else {
        channelId = req.params.id;
      }

      let mode = req.query.mode;
      if (isUndefined(mode)) {
        channel ??= await req.serverCtx.channelDB.getChannelDirect(
          req.params.id,
        );
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

                if (playlistResult) {
                  return res
                    .type('application/vnd.apple.mpegurl')
                    .send(playlistResult.playlist);
                } else {
                  throw new Error('Error trimming HLS playlist for playback');
                }
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
        case 'mpegts':
          return res.status(400).send();
      }

      return sessionResult.getOrElse(() => {
        return res.status(500).send('Error starting or retrieving session');
      });
    },
  );
};
