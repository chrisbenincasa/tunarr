import { DebugPlexApiRouter } from '@/api/debug/debugPlexApi.js';
import { getDatabase } from '@/db/DBAccess.js';
import {
  ArchiveDatabaseBackupFactory,
  ArchiveDatabaseBackupKey,
} from '@/db/backup/ArchiveDatabaseBackup.js';
import { MediaSourceType } from '@/db/schema/MediaSource.js';
import { ChannelLineupQuery } from '@tunarr/types/api';
import { ChannelLineupSchema } from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import { jsonArrayFrom } from 'kysely/helpers/sqlite';
import { map, reject, some } from 'lodash-es';
import os from 'node:os';
import z from 'zod';

import { LineupCreator } from '@/services/dynamic_channels/LineupCreator.js';
import { PlexTaskQueue } from '@/tasks/TaskQueue.js';
import { SavePlexProgramExternalIdsTask } from '@/tasks/plex/SavePlexProgramExternalIdsTask.js';
import { DateTimeRange } from '@/types/DateTimeRange.js';
import { OpenDateTimeRange } from '@/types/OpenDateTimeRange.js';
import { RouterPluginAsyncCallback } from '@/types/serverType.js';
import { enumValues } from '@/util/enumUtil.js';
import { ifDefined } from '@/util/index.js';
import { container } from '../container.ts';
import { debugFfmpegApiRouter } from './debug/debugFfmpegApi.ts';
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
    })
    .register(debugFfmpegApiRouter, {
      prefix: '/debug',
    })
    .register(DebugPlexApiRouter, {
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

      const result =
        await req.serverCtx.streamProgramCalculator.getCurrentLineupItem({
          startTime: new Date().getTime(),
          channelId: req.query.channelId,
          allowSkip: true,
        });

      if (result.isFailure()) {
        return res.status(500).send(result.error);
      }

      return res.send(result.get());
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

      await req.serverCtx.guideService.buildAllChannels(
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
    '/debug/helpers/channels/:id/build_guide',
    {
      schema: {
        params: z.object({
          id: z.string(),
        }),
        querystring: z.object({
          from: z.coerce
            .date()
            .or(z.coerce.number().transform((n) => new Date(n))),
          to: z.coerce
            .date()
            .or(z.coerce.number().transform((n) => new Date(n))),
        }),
      },
    },
    async (req, res) => {
      const channel = await req.serverCtx.channelDB.getChannelAndPrograms(
        req.params.id,
      );
      if (!channel) {
        return res.status(404).send();
      }
      const startTime = dayjs(req.query.from);
      const duration =
        channel.duration <= 0
          ? dayjs.duration(1, 'day').asMilliseconds()
          : channel.duration;
      const endTime = req.query.to
        ? dayjs(req.query.to)
        : startTime.add(duration, 'milliseconds');

      await req.serverCtx.guideService.refreshGuide(
        dayjs.duration(endTime.diff(startTime)),
        req.params.id,
        true,
        true,
      );

      return res
        .status(200)
        .send(
          await req.serverCtx.guideService.getChannelGuide(
            channel.uuid,
            OpenDateTimeRange.create(startTime, endTime)!,
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
      const startTime = dayjs(req.query.from);
      const endTime = dayjs(req.query.to);

      await req.serverCtx.guideService.buildAllChannels(
        dayjs.duration(endTime.diff(startTime)),
      );

      const guide = await req.serverCtx.guideService.getAllChannelGuides(
        DateTimeRange.create(startTime, endTime)!,
      );

      return res.send(guide);
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
      const channel = await req.serverCtx.channelDB.getChannel(
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

  fastify.get('/debug/db/backup', async (_, res) => {
    await container
      .get<ArchiveDatabaseBackupFactory>(ArchiveDatabaseBackupKey)({
        type: 'file',
        outputPath: os.tmpdir(),
        archiveFormat: 'tar',
        gzip: true,
        maxBackups: 3,
      })
      .backup();

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
        new SavePlexProgramExternalIdsTask(
          req.params.programId,
          req.serverCtx.programDB,
        ),
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

      const knownProgramIds = await getDatabase()
        .selectFrom('programExternalId as p1')
        .where(({ eb }) =>
          eb.and([
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
