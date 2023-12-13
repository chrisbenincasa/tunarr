import { FastifyPluginCallback, FastifyRequest } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import z from 'zod';
import { ChannelCache } from '../channelCache.js';
import * as helperFuncs from '../helperFuncs.js';
import createLogger from '../logger.js';
import { PlexPlayer } from '../plexPlayer.js';
import {
  ContextChannel,
  LineupItem,
  Maybe,
  PlayerContext,
  isPlexBackedLineupItem,
} from '../types.js';
import { isNil, isUndefined } from 'lodash-es';
import { ImmutableChannel } from '../dao/db.js';
import { PlexTranscoder } from '../plexTranscoder.js';

const logger = createLogger(import.meta);

const ChannelQuerySchema = {
  querystring: z.object({
    channel: z.coerce.number(),
  }),
};

export const debugRouter: FastifyPluginCallback = (fastify, _opts, done) => {
  const typeCheckedFastify = fastify.withTypeProvider<ZodTypeProvider>();

  typeCheckedFastify.get(
    '/api/v1/debug/plex',
    { schema: ChannelQuerySchema },
    async (req, res) => {
      void res.hijack();
      const t0 = new Date().getTime();
      const channel = req.serverCtx.channelCache.getChannelConfig(
        req.query.channel,
      );

      if (!channel) {
        return res.status(404).send('No channel found');
      }

      const combinedChannel: ContextChannel = {
        ...helperFuncs.generateChannelContext(channel),
        transcoding: channel?.transcoding,
      };
      logger.info('combinedChannel: %O', combinedChannel);

      const lineupItem = getLineupItemForDebug(req, channel, t0);
      logger.info('lineupItem: %O', lineupItem);

      const playerContext: PlayerContext = {
        lineupItem: lineupItem!,
        ffmpegSettings: req.serverCtx.settings.ffmpegSettings(),
        channel: combinedChannel,
        m3u8: false,
        audioOnly: false,
        dbAccess: req.serverCtx.settings,
      };

      const plex = new PlexPlayer(playerContext);

      void res.header('Content-Type', 'video/mp2t');
      const emitter = await plex.play(res.raw);

      if (!emitter) {
        res.raw.writeHead(500, 'no emitter');
        res.raw.end();
      }
    },
  );

  typeCheckedFastify.get(
    '/api/v1/debug/plex-transcoder/video-stats',
    { schema: ChannelQuerySchema },
    async (req, res) => {
      const channel = req.serverCtx.channelCache.getChannelConfig(
        req.query.channel,
      );

      if (!channel) {
        return res.status(404).send('No channel found');
      }

      const lineupItem = getLineupItemForDebug(
        req,
        channel,
        new Date().getTime(),
      );

      if (isUndefined(lineupItem)) {
        return res
          .status(500)
          .send('Couldnt get a lineup item for this channel');
      }

      if (!isPlexBackedLineupItem(lineupItem)) {
        return res
          .status(500)
          .send(
            `Needed lineup item of type commercial or program, but got "${lineupItem.type}"`,
          );
      }

      const plexServer = req.serverCtx.settings.plexServers().getAll()[0];
      const plexSettings = req.serverCtx.settings.plexSettings();

      const combinedChannel: ContextChannel = {
        ...helperFuncs.generateChannelContext(channel),
        transcoding: channel?.transcoding,
      };

      const transcoder = new PlexTranscoder(
        `debug-${new Date().getTime()}`,
        plexServer,
        plexSettings,
        combinedChannel,
        lineupItem,
      );

      transcoder.setTranscodingArgs(false, true, false, false);
      await transcoder.getDecision(false);

      return res.send(transcoder.getVideoStats());
    },
  );

  function getLineupItemForDebug(
    req: FastifyRequest,
    channel: ImmutableChannel,
    now: number,
  ) {
    let lineupItem: Maybe<LineupItem> =
      req.serverCtx.channelCache.getCurrentLineupItem(channel.number, now);

    logger.info('lineupItem: %O', lineupItem);

    if (isNil(lineupItem)) {
      lineupItem = helperFuncs
        .createLineup(
          req.serverCtx.channelCache,
          helperFuncs.getCurrentProgramAndTimeElapsed(
            new Date().getTime(),
            channel,
          ),
          channel,
          req.serverCtx.fillerDB.getFillersFromChannel(channel),
          false,
        )
        .shift();
    }
    return lineupItem;
  }

  typeCheckedFastify.get(
    '/api/v1/debug/helpers/current_program',
    {
      schema: ChannelQuerySchema,
    },
    (req, res) => {
      const channel = req.serverCtx.channelDB.getChannel(req.query.channel);

      if (!channel) {
        return res
          .status(404)
          .send({ error: 'No channel with ID ' + req.query.channel });
      }

      const result = helperFuncs.getCurrentProgramAndTimeElapsed(
        new Date().getTime(),
        channel,
      );

      return res.send(result);
    },
  );

  const CreateLineupSchema = {
    querystring: ChannelQuerySchema.querystring.extend({
      live: z.coerce.boolean(),
    }),
  };

  typeCheckedFastify.get(
    '/api/v1/debug/helpers/create_lineup',
    {
      schema: CreateLineupSchema,
    },
    (req, res) => {
      const channel = req.serverCtx.channelDB.getChannel(req.query.channel);

      if (!channel) {
        return res
          .status(404)
          .send({ error: 'No channel with ID ' + req.query.channel });
      }

      const channelCache = req.query.live
        ? req.serverCtx.channelCache
        : new ChannelCache(req.serverCtx.channelDB);

      return res.send(
        helperFuncs.createLineup(
          channelCache,
          helperFuncs.getCurrentProgramAndTimeElapsed(
            new Date().getTime(),
            channel,
          ),
          channel,
          req.serverCtx.fillerDB.getFillersFromChannel(channel),
          false,
        ),
      );
    },
  );

  const RandomFillerSchema = {
    querystring: CreateLineupSchema.querystring.extend({
      maxDuration: z.coerce.number(),
    }),
  };

  typeCheckedFastify.get(
    '/api/v1/debug/helpers/random_filler',
    {
      schema: RandomFillerSchema,
    },
    (req, res) => {
      const channel = req.serverCtx.channelDB.getChannel(req.query.channel);

      if (!channel) {
        return res
          .status(404)
          .send({ error: 'No channel with ID ' + req.query.channel });
      }

      const channelCache = req.query.live
        ? req.serverCtx.channelCache
        : new ChannelCache(req.serverCtx.channelDB);

      return res.send(
        helperFuncs.pickRandomWithMaxDuration(
          channelCache,
          channel,
          req.serverCtx.fillerDB.getFillersFromChannel(channel),
          req.query.maxDuration,
        ),
      );
    },
  );

  done();
};
