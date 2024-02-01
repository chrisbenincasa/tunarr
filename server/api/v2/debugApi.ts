import { Loaded, wrap } from '@mikro-orm/core';
import dayjs from 'dayjs';
import { FastifyRequest } from 'fastify';
import { first, isNil, isUndefined } from 'lodash-es';
import z from 'zod';
import { ChannelCache } from '../../channelCache.js';
import { getEm } from '../../dao/dataSource.js';
import {
  StreamLineupItem,
  isPlexBackedLineupItem,
} from '../../dao/derived_types/StreamLineup.js';
import { Channel } from '../../dao/entities/Channel.js';
import * as helperFuncs from '../../helperFuncs.js';
import createLogger from '../../logger.js';
import { PlexPlayer } from '../../plexPlayer.js';
import { PlexTranscoder } from '../../plexTranscoder.js';
import { ContextChannel, Maybe, PlayerContext } from '../../types.js';
import { RouterPluginAsyncCallback } from '../../types/serverType.js';

const logger = createLogger(import.meta);

const ChannelQuerySchema = {
  querystring: z.object({
    channelId: z.string(),
  }),
};

// eslint-disable-next-line @typescript-eslint/require-await
export const debugApi: RouterPluginAsyncCallback = async (fastify) => {
  fastify.get(
    '/api/v1/debug/plex',
    { schema: ChannelQuerySchema },
    async (req, res) => {
      void res.hijack();
      const t0 = new Date().getTime();
      const channel =
        await req.serverCtx.channelCache.getChannelConfigWithPrograms(
          req.query.channelId,
        );

      if (!channel) {
        return res.status(404).send('No channel found');
      }

      const combinedChannel: ContextChannel = {
        ...helperFuncs.generateChannelContext(channel),
        transcoding: channel?.transcoding,
      };
      logger.info('combinedChannel: %O', combinedChannel);

      const lineupItem = await getLineupItemForDebug(req, channel, t0);
      logger.info('lineupItem: %O', lineupItem);

      if (!lineupItem) {
        return res.status(500).send('Could not get lineup item for params');
      }

      const playerContext: PlayerContext = {
        lineupItem: lineupItem,
        ffmpegSettings: req.serverCtx.settings.ffmpegSettings(),
        channel: combinedChannel,
        m3u8: false,
        audioOnly: false,
        settings: req.serverCtx.settings,
        entityManager: getEm(),
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

  fastify.get(
    '/api/v1/debug/plex-transcoder/video-stats',
    { schema: ChannelQuerySchema },
    async (req, res) => {
      const channel =
        await req.serverCtx.channelCache.getChannelConfigWithPrograms(
          req.query.channelId,
        );

      if (!channel) {
        return res.status(404).send('No channel found');
      }

      const lineupItem = await getLineupItemForDebug(
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

      // TODO use plex server from item.
      const plexServer = await req.serverCtx.plexServerDB.getAll().then(first);

      if (isNil(plexServer)) {
        return res.status(404).send('Could not find plex server');
      }

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

  async function getLineupItemForDebug(
    req: FastifyRequest,
    channel: Loaded<Channel, 'programs'>,
    now: number,
  ) {
    let lineupItem: Maybe<StreamLineupItem> =
      req.serverCtx.channelCache.getCurrentLineupItem(channel.number, now);

    logger.info('lineupItem: %O', lineupItem);

    const fillers = await req.serverCtx.fillerDB.getFillersFromChannel(
      channel.number,
    );

    if (isNil(lineupItem)) {
      lineupItem = (
        await helperFuncs.createLineup(
          req.serverCtx.channelCache,
          helperFuncs.getCurrentProgramAndTimeElapsed(
            new Date().getTime(),
            channel,
            await req.serverCtx.channelDB.loadLineup(channel.uuid),
          ),
          channel,
          fillers,
          false,
        )
      ).shift();
    }
    return lineupItem;
  }

  fastify.get(
    '/api/v1/debug/helpers/current_program',
    {
      schema: ChannelQuerySchema,
    },
    async (req, res) => {
      const channel = await req.serverCtx.channelDB.getChannelAndPrograms(
        req.query.channelId,
      );

      if (!channel) {
        return res
          .status(404)
          .send({ error: 'No channel with ID ' + req.query.channelId });
      }

      const result = helperFuncs.getCurrentProgramAndTimeElapsed(
        new Date().getTime(),
        channel,
        await req.serverCtx.channelDB.loadLineup(channel.uuid),
      );

      return res.send(result);
    },
  );

  const CreateLineupSchema = {
    querystring: ChannelQuerySchema.querystring.extend({
      live: z.coerce.boolean(),
    }),
  };

  fastify.get(
    '/api/v1/debug/helpers/create_guide',
    { schema: CreateLineupSchema },
    async (req, res) => {
      const channel = await req.serverCtx.channelDB.getChannelAndPrograms(
        req.query.channelId,
      );

      const startTime = new Date();
      const duration =
        channel!.duration <= 0
          ? dayjs.duration(1, 'day').asMilliseconds()
          : channel!.duration;
      const endTime = dayjs(startTime).add(duration, 'milliseconds').toDate();

      const t = req.serverCtx.guideService.prepareRefresh(
        [wrap(channel!).toJSON()],
        duration,
      );

      await req.serverCtx.guideService.refresh(t);

      return res
        .status(200)
        .send(
          await req.serverCtx.guideService.getChannelLineup(
            channel!.number,
            startTime,
            endTime,
          ),
        );
    },
  );

  fastify.get(
    '/api/v1/debug/helpers/create_stream_lineup',
    {
      schema: CreateLineupSchema,
    },
    async (req, res) => {
      const channel = await req.serverCtx.channelDB.getChannelAndPrograms(
        req.query.channelId,
      );

      if (!channel) {
        return res
          .status(404)
          .send({ error: 'No channel with ID ' + req.query.channelId });
      }

      const channelCache = req.query.live
        ? req.serverCtx.channelCache
        : new ChannelCache(req.serverCtx.channelDB);

      const fillers = await req.serverCtx.fillerDB.getFillersFromChannel(
        channel.number,
      );

      const lineup = await helperFuncs.createLineup(
        channelCache,
        helperFuncs.getCurrentProgramAndTimeElapsed(
          new Date().getTime(),
          channel,
          await req.serverCtx.channelDB.loadLineup(channel.uuid),
        ),
        channel,
        fillers,
        false,
      );

      return res.send(lineup);
    },
  );

  const RandomFillerSchema = {
    querystring: CreateLineupSchema.querystring.extend({
      maxDuration: z.coerce.number(),
    }),
  };

  fastify.get(
    '/api/v1/debug/helpers/random_filler',
    {
      schema: RandomFillerSchema,
    },
    async (req, res) => {
      const channel = await req.serverCtx.channelDB.getChannelById(
        req.query.channelId,
      );

      if (!channel) {
        return res
          .status(404)
          .send({ error: 'No channel with ID ' + req.query.channelId });
      }

      const channelCache = req.query.live
        ? req.serverCtx.channelCache
        : new ChannelCache(req.serverCtx.channelDB);

      const fillers = await req.serverCtx.fillerDB.getFillersFromChannel(
        channel.number,
      );

      return res.send(
        helperFuncs.pickRandomWithMaxDuration(
          channelCache,
          channel,
          fillers,
          req.query.maxDuration,
        ),
      );
    },
  );
};
