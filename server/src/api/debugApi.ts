import { DebugPlexApiRouter } from '@/api/debug/debugPlexApi.js';
import type { ArchiveDatabaseBackupFactory } from '@/db/backup/ArchiveDatabaseBackup.js';
import { ArchiveDatabaseBackupKey } from '@/db/backup/ArchiveDatabaseBackup.js';
import { LineupCreator } from '@/services/dynamic_channels/LineupCreator.js';
import { PlexTaskQueue } from '@/tasks/TaskQueue.js';
import { SavePlexProgramExternalIdsTask } from '@/tasks/plex/SavePlexProgramExternalIdsTask.js';
import { DateTimeRange } from '@/types/DateTimeRange.js';
import { OpenDateTimeRange } from '@/types/OpenDateTimeRange.js';
import type { RouterPluginAsyncCallback } from '@/types/serverType.js';
import { ifDefined } from '@/util/index.js';
import { tag } from '@tunarr/types';
import { ChannelLineupQuery } from '@tunarr/types/api';
import { ChannelLineupSchema } from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import { isUndefined } from 'lodash-es';
import os from 'node:os';
import z from 'zod/v4';
import { container } from '../container.ts';
import { TunarrWorkerPool } from '../services/TunarrWorkerPool.ts';
import { debugFfmpegApiRouter } from './debug/debugFfmpegApi.ts';
import { DebugJellyfinApiRouter } from './debug/debugJellyfinApi.js';
import { debugStreamApiRouter } from './debug/debugStreamApi.js';

const ChannelQuerySchema = z.object({
  channelId: z.string(),
});

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
    '/debug/helpers/playing_at',
    {
      schema: {
        tags: ['Debug'],
        querystring: z.object({
          channelId: z.coerce.number().or(z.string()),
          ts: z.coerce.number().optional(),
        }),
      },
    },
    async (req, res) => {
      const dbChannel = await req.serverCtx.channelDB.getChannel(
        req.query.channelId,
      );
      console.log(req.query, dbChannel);
      if (!dbChannel) {
        return res.status(404).send('Channel not found');
      }

      const channelAndLineup =
        await req.serverCtx.channelDB.loadChannelAndLineup(dbChannel.uuid);

      if (!channelAndLineup) {
        return res
          .status(404)
          .send({ error: 'No channel with ID ' + req.query.channelId });
      }

      const { channel, lineup } = channelAndLineup;

      if (
        lineup.onDemandConfig?.state === 'paused' &&
        isUndefined(req.query.ts)
      ) {
        req.query.ts = channel.startTime + lineup.onDemandConfig.cursor;
      }

      const result =
        await req.serverCtx.streamProgramCalculator.getCurrentLineupItem({
          startTime: req.query.ts ?? +dayjs(),
          channelId: req.query.channelId,
          allowSkip: true,
        });

      return result
        .map((lineupItem) => {
          return res.send(lineupItem);
        })
        .getOrElse(() => {
          return res.status(500).send();
        });
    },
  );

  const CreateLineupSchema = ChannelQuerySchema.extend({
    live: z.coerce.boolean(),
    startTime: z.coerce.number().optional(),
    endTime: z.coerce.number().optional(),
  });

  fastify.get(
    '/debug/helpers/create_guide',
    {
      schema: {
        tags: ['Debug'],
        querystring: CreateLineupSchema,
      },
    },
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
        tags: ['Debug'],
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

  const RandomFillerSchema = CreateLineupSchema.extend({
    maxDuration: z.coerce.number(),
  });

  fastify.get(
    '/debug/helpers/random_filler',
    {
      schema: {
        tags: ['Debug'],
        querystring: RandomFillerSchema,
      },
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

  fastify.get(
    '/debug/db/backup',
    {
      schema: {
        tags: ['Debug'],
      },
    },
    async (_, res) => {
      await container
        .get<ArchiveDatabaseBackupFactory>(ArchiveDatabaseBackupKey)()
        .backup({
          type: 'file',
          outputPath: os.tmpdir(),
          archiveFormat: 'tar',
          gzip: true,
          maxBackups: 3,
        });

      return res.send();
    },
  );

  fastify.post(
    '/debug/plex/:programId/update_external_ids',
    {
      schema: {
        tags: ['Debug'],
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
          req.serverCtx.mediaSourceApiFactory,
        ),
      );

      return res.send(result);
    },
  );

  fastify.get(
    '/debug/helpers/promote_lineup',
    {
      schema: {
        tags: ['Debug'],
        querystring: z.object({
          channelId: z.string().uuid(),
        }),
      },
    },
    async (req, res) => {
      const result = await container
        .get(LineupCreator)
        .resolveLineup(req.query.channelId);
      ifDefined(result, (r) => {
        console.log(r.lineup.items.length);
      });
      return res.send(result);
    },
  );

  fastify.get(
    '/debug/channels/reload_all_lineups',
    {
      schema: {
        tags: ['Debug'],
      },
    },
    async (req, res) => {
      await req.serverCtx.channelDB.loadAllLineupConfigs(true);
      return res.send();
    },
  );

  fastify.get(
    '/debug/subprocess/status',
    {
      schema: {
        querystring: z.object({}),
      },
    },
    async (_, res) => {
      const pool = container.get(TunarrWorkerPool);

      const response = await pool.queueTask({ type: 'status' });
      return res.send(response);
    },
  );

  fastify.get(
    '/debug/subprocess/restart',
    {
      schema: {
        querystring: z.object({}),
      },
    },
    async (_, res) => {
      const pool = container.get(TunarrWorkerPool);

      const response = await Promise.race([
        pool.queueTask({ type: 'restart', code: 1 }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('')), 5_000)),
      ]);
      return res.send(response);
    },
  );

  fastify.get(
    '/debug/media_sources/:mediaSourceId/scan',
    {
      schema: {
        params: z.object({
          mediaSourceId: z.uuid(),
        }),
        querystring: z.object({
          pathFilter: z.string().optional(),
        }),
      },
    },
    async (req, res) => {
      const mediaSource = await req.serverCtx.mediaSourceDB.getById(
        tag(req.params.mediaSourceId),
      );
      if (!mediaSource) {
        return res.status(404).send();
      }
      const scanRes = await req.serverCtx.mediaSourceScanCoordinator.addLocal({
        forceScan: true,
        mediaSourceId: tag(req.params.mediaSourceId),
        pathFilter: req.query.pathFilter,
      });

      return res.send(scanRes);
    },
  );

  fastify.get(
    '/debug/media_sources/:mediaSourceId/libraries/:libraryId/scan',
    {
      schema: {
        params: z.object({
          mediaSourceId: z.uuid(),
          libraryId: z.uuid(),
        }),
        querystring: z.object({
          pathFilter: z.string().optional(),
        }),
      },
    },
    async (req, res) => {
      const mediaSource = await req.serverCtx.mediaSourceDB.getById(
        tag(req.params.mediaSourceId),
      );
      if (!mediaSource) {
        return res.status(404).send();
      }
      const library = mediaSource.libraries.find(
        (lib) => lib.uuid === req.params.libraryId,
      );
      console.log(mediaSource.libraries);
      if (!library) {
        return res.status(404).send('Library not found');
      }
      const scanRes = await req.serverCtx.mediaSourceScanCoordinator.add({
        forceScan: true,
        libraryId: req.params.libraryId,
        pathFilter: req.query.pathFilter,
      });

      return res.send(scanRes);
    },
  );
};
