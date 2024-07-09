/* eslint-disable @typescript-eslint/no-unused-vars */
import { Loaded } from '@mikro-orm/core';
import { ChannelLineupQuery } from '@tunarr/types/api';
import { ChannelLineupSchema } from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import { FastifyRequest } from 'fastify';
import { compact, isNil, reject, some, map } from 'lodash-es';
import os from 'node:os';
import z from 'zod';
import { ArchiveDatabaseBackup } from '../dao/backup/ArchiveDatabaseBackup.js';
import { getEm } from '../dao/dataSource.js';
import { StreamLineupItem } from '../dao/derived_types/StreamLineup.js';
import { Channel } from '../dao/entities/Channel.js';
import { LineupCreator } from '../services/dynamic_channels/LineupCreator.js';
import { PlayerContext } from '../stream/Player.js';
import { generateChannelContext } from '../stream/StreamProgramCalculator.js';
import { PlexPlayer } from '../stream/plex/PlexPlayer.js';
import { StreamContextChannel } from '../stream/types.js';
import { SavePlexProgramExternalIdsTask } from '../tasks/plex/SavePlexProgramExternalIdsTask.js';
import { PlexTaskQueue } from '../tasks/TaskQueue.js';
import { RouterPluginAsyncCallback } from '../types/serverType.js';
import { Maybe } from '../types/util.js';
import { ifDefined, mapAsyncSeq } from '../util/index.js';
import { LoggerFactory } from '../util/logging/LoggerFactory.js';
import { DebugJellyfinApiRouter } from './debug/debugJellyfinApi.js';
import { jsonArrayFrom } from 'kysely/helpers/sqlite';
import { directDbAccess } from '../dao/direct/directDbAccess.js';
import { MediaSourceType } from '../dao/entities/MediaSource.js';
import { enumValues } from '../util/enumUtil.js';

const ChannelQuerySchema = {
  querystring: z.object({
    channelId: z.string(),
  }),
};

export const debugApi: RouterPluginAsyncCallback = async (fastify) => {
  const logger = LoggerFactory.child({ caller: import.meta });

  await fastify.register(DebugJellyfinApiRouter, {
    prefix: '/debug',
  });

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

  fastify.get(
    '/debug/db/test_direct_access',
    {
      schema: {
        querystring: z.object({
          id: z.string(),
        }),
      },
    },
    async (_req, res) => {
      const mediaSource = (await _req.serverCtx.mediaSourceDB.getById(
        _req.query.id,
      ))!;

      const knownProgramIds = await directDbAccess()
        .selectFrom('programExternalId as p1')
        .where(({ eb, and }) =>
          and([
            eb('p1.externalSourceId', '=', mediaSource.name),
            eb('p1.sourceType', '=', mediaSource.type),
          ]),
        )
        .selectAll('p1')
        .select((eb) =>
          jsonArrayFrom(
            eb
              .selectFrom('programExternalId as p2')
              .whereRef('p2.programUuid', '=', 'p1.programUuid')
              .whereRef('p2.uuid', '!=', 'p1.uuid')
              .select([
                'p2.sourceType',
                'p2.externalSourceId',
                'p2.externalKey',
              ]),
          ).as('otherExternalIds'),
        )
        .groupBy('p1.uuid')
        .execute();

      const mediaSourceTypes = map(enumValues(MediaSourceType), (typ) =>
        typ.toString(),
      );
      const danglingPrograms = reject(knownProgramIds, (program) => {
        some(program.otherExternalIds, (eid) =>
          mediaSourceTypes.includes(eid.sourceType),
        );
      });
      return res.send(danglingPrograms);
    },
  );
};
