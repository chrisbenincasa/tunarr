/* eslint-disable @typescript-eslint/no-unused-vars */
import { ChannelLineupQuery } from '@tunarr/types/api';
import { ChannelLineupSchema } from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import { jsonArrayFrom } from 'kysely/helpers/sqlite';
import { compact, map, reject, some } from 'lodash-es';
import os from 'node:os';
import z from 'zod';
import { ArchiveDatabaseBackup } from '../dao/backup/ArchiveDatabaseBackup.js';
import { directDbAccess } from '../dao/direct/directDbAccess.js';
import { MediaSourceType } from '../dao/entities/MediaSource.js';
import { LineupCreator } from '../services/dynamic_channels/LineupCreator.js';
import { PlexTaskQueue } from '../tasks/TaskQueue.js';
import { SavePlexProgramExternalIdsTask } from '../tasks/plex/SavePlexProgramExternalIdsTask.js';
import { RouterPluginAsyncCallback } from '../types/serverType.js';
import { enumValues } from '../util/enumUtil.js';
import { ifDefined, mapAsyncSeq } from '../util/index.js';
import { DebugJellyfinApiRouter } from './debug/debugJellyfinApi.js';
import { debugStreamApiRouter } from './debug/debugStreamApi.js';

const ChannelQuerySchema = {
  querystring: z.object({
    channelId: z.string(),
  }),
};

export const debugApi: RouterPluginAsyncCallback = async (fastify) => {
  await fastify
    .register(DebugJellyfinApiRouter, {
      prefix: '/debug',
    })
    .register(debugStreamApiRouter, {
      prefix: '/debug',
    });

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
        .getCurrentLineupItem({
          startTime: new Date().getTime(),
          channelId: req.query.channelId,
          allowSkip: true,
        });

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
        startTime,
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
