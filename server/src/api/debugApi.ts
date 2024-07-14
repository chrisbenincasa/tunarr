/* eslint-disable @typescript-eslint/no-unused-vars */
import { Loaded } from '@mikro-orm/core';
import { ChannelLineupQuery } from '@tunarr/types/api';
import { ChannelLineupSchema } from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import { FastifyRequest } from 'fastify';
import { compact, first, isNil, isUndefined } from 'lodash-es';
import os from 'node:os';
import z from 'zod';
import { ArchiveDatabaseBackup } from '../dao/backup/ArchiveDatabaseBackup.js';
import { getEm } from '../dao/dataSource.js';
import {
  StreamLineupItem,
  isContentBackedLineupIteam,
} from '../dao/derived_types/StreamLineup.js';
import { Channel } from '../dao/entities/Channel.js';
import { LineupCreator } from '../services/dynamic_channels/LineupCreator.js';
import { PlayerContext } from '../stream/Player.js';
import { generateChannelContext } from '../stream/StreamProgramCalculator.js';
import { PlexPlayer } from '../stream/plex/PlexPlayer.js';
import { PlexTranscoder } from '../stream/plex/PlexTranscoder.js';
import { StreamContextChannel } from '../stream/types.js';
import { SavePlexProgramExternalIdsTask } from '../tasks/SavePlexProgramExternalIdsTask.js';
import { PlexTaskQueue } from '../tasks/TaskQueue.js';
import { RouterPluginAsyncCallback } from '../types/serverType.js';
import { Maybe } from '../types/util.js';
import { ifDefined, mapAsyncSeq } from '../util/index.js';
import { LoggerFactory } from '../util/logging/LoggerFactory.js';

const ChannelQuerySchema = {
  querystring: z.object({
    channelId: z.string(),
  }),
};

// eslint-disable-next-line @typescript-eslint/require-await
export const debugApi: RouterPluginAsyncCallback = async (fastify) => {
  const logger = LoggerFactory.child({ caller: import.meta });

  fastify.get(
    '/debug/plex',
    { schema: ChannelQuerySchema },
    async (req, res) => {
      void res.hijack();
      const t0 = new Date().getTime();
      const channel = await req.serverCtx.channelDB.getChannelAndProgramsSLOW(
        req.query.channelId,
      );

      if (!channel) {
        return res.status(404).send('No channel found');
      }

      const combinedChannel: StreamContextChannel = {
        ...generateChannelContext(channel),
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
    '/debug/plex-transcoder/video-stats',
    { schema: ChannelQuerySchema },
    async (req, res) => {
      const channel = await req.serverCtx.channelDB.getChannelAndProgramsSLOW(
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

      if (!isContentBackedLineupIteam(lineupItem)) {
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

      const combinedChannel: StreamContextChannel = {
        ...generateChannelContext(channel),
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
      req.serverCtx.channelCache.getCurrentLineupItem(channel.uuid, now);

    logger.info('lineupItem: %O', lineupItem);

    const calculator = req.serverCtx.streamProgramCalculator();
    if (isNil(lineupItem)) {
      lineupItem = await calculator.createLineupItem(
        await calculator.getCurrentProgramAndTimeElapsed(
          new Date().getTime(),
          channel,
          await req.serverCtx.channelDB.loadLineup(channel.uuid),
        ),
        channel,
      );
    }
    return lineupItem;
  }

  fastify.get(
    '/debug/helpers/current_program',
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

      const result = req.serverCtx
        .streamProgramCalculator()
        .getCurrentProgramAndTimeElapsed(
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
      startTime: z.coerce.number().optional(),
      endTime: z.coerce.number().optional(),
    }),
  };

  fastify.get(
    '/debug/helpers/create_guide',
    { schema: CreateLineupSchema },
    async (req, res) => {
      const channel = await req.serverCtx.channelDB.getChannelAndPrograms(
        req.query.channelId,
      );

      const startTime = dayjs(req.query.startTime);
      const duration =
        channel!.duration <= 0
          ? dayjs.duration(1, 'day').asMilliseconds()
          : channel!.duration;
      const endTime = req.query.endTime
        ? dayjs(req.query.endTime)
        : startTime.add(duration, 'milliseconds');

      await req.serverCtx.guideService.refreshGuide(
        dayjs.duration(endTime.diff(startTime)),
      );

      return res
        .status(200)
        .send(
          await req.serverCtx.guideService.getChannelLineup(
            channel!.uuid,
            startTime.toDate(),
            endTime.toDate(),
          ),
        );
    },
  );

  fastify.get(
    '/debug/helpers/build_guide',
    {
      schema: {
        querystring: ChannelLineupQuery,
        tags: ['Channels'],
        response: {
          200: z.array(ChannelLineupSchema),
        },
      },
    },
    async (req, res) => {
      const allChannels =
        await req.serverCtx.channelDB.getAllChannelsAndPrograms();

      const startTime = dayjs(req.query.from);
      const endTime = dayjs(req.query.to);

      await req.serverCtx.guideService.refreshGuide(
        dayjs.duration(endTime.diff(startTime)),
      );

      const lineups = compact(
        await mapAsyncSeq(allChannels, async (channel) => {
          return await req.serverCtx.guideService.getChannelLineup(
            channel.uuid,
            startTime.toDate(),
            endTime.toDate(),
          );
        }),
      );

      return res.send(lineups);
    },
  );

  fastify.get(
    '/debug/helpers/create_stream_lineup',
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

      const calculator = req.serverCtx.streamProgramCalculator();
      const lineup = await calculator.createLineupItem(
        await calculator.getCurrentProgramAndTimeElapsed(
          new Date().getTime(),
          channel,
          await req.serverCtx.channelDB.loadLineup(channel.uuid),
        ),
        // HACK until we remove much of the old DB code
        await req.serverCtx.channelDB
          .getChannel(req.query.channelId)
          .then((x) => x!),
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
    '/debug/helpers/random_filler',
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

      const fillers = await req.serverCtx.fillerDB.getFillersFromChannel(
        channel.uuid,
      );

      return res.send(fillers);

      // return res.send(
      //   new FillerPicker().pickRandomWithMaxDuration(
      //     channel,
      //     fillers,
      //     req.query.maxDuration,
      //   ),
      // );
    },
  );

  fastify.get('/debug/db/backup', async (req, res) => {
    await new ArchiveDatabaseBackup(req.serverCtx.settings, {
      type: 'file',
      outputPath: os.tmpdir(),
      archiveFormat: 'tar',
      gzip: true,
      maxBackups: 3,
    }).backup();
    return res.send();
  });

  fastify.post(
    '/debug/plex/:programId/update_external_ids',
    {
      schema: {
        params: z.object({
          programId: z.string(),
        }),
      },
    },
    async (req, res) => {
      const result = await PlexTaskQueue.add(
        new SavePlexProgramExternalIdsTask(req.params.programId),
      );

      console.log(result);

      return res.send();
    },
  );

  fastify.get(
    '/debug/helpers/promote_lineup',
    {
      schema: {
        querystring: z.object({
          channelId: z.string().uuid(),
        }),
      },
    },
    async (req, res) => {
      const result = await new LineupCreator().resolveLineup(
        req.query.channelId,
      );
      ifDefined(result, (r) => {
        console.log(r.lineup.items.length);
      });
      return res.send(result);
    },
  );

  fastify.get('/debug/channels/reload_all_lineups', async (req, res) => {
    await req.serverCtx.channelDB.loadAllLineupConfigs(true);
    return res.send();
  });

  fastify.get('/debug/db/test_direct_access', async (_req, res) => {
    // const result = await directDbAccess()
    //   .selectFrom('channel_programs')
    //   .where('channel_uuid', '=', '0ff3ec64-1022-4afd-9178-3f27f1121d47')
    //   .innerJoin('program', 'channel_programs.program_uuid', 'program.uuid')
    //   .leftJoin('program_grouping', join => {
    //     join.onRef('')
    //   })
    //   .select(['program'])
    //   .execute();
    // return res.send(result);
    return res.send();
  });
};
