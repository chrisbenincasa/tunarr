import { dbChannelToApiChannel } from '@/db/converters/channelConverters.js';
import { GlobalScheduler } from '@/services/Scheduler.js';
import { UpdateXmlTvTask } from '@/tasks/UpdateXmlTvTask.js';
import { OpenDateTimeRange } from '@/types/OpenDateTimeRange.js';
import type { RouterPluginAsyncCallback } from '@/types/serverType.js';
import { attempt } from '@/util/index.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { timeNamedAsync } from '@/util/perf.js';
import { scheduleTimeSlots } from '@tunarr/shared';
import {
  BasicIdParamSchema,
  BasicPagingSchema,
  GetChannelProgrammingResponseSchema,
  TimeSlotScheduleSchema,
  UpdateChannelProgrammingRequestSchema,
} from '@tunarr/types/api';
import {
  ChannelLineupSchema,
  ChannelProgramSchema,
  ChannelSchema,
  CondensedChannelProgrammingSchema,
  ContentProgramSchema,
  SaveChannelRequestSchema,
} from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration.js';
import {
  groupBy,
  isError,
  isNil,
  isNull,
  isUndefined,
  map,
  omit,
  sortBy,
} from 'lodash-es';
import z from 'zod';

dayjs.extend(duration);

const ChannelLineupQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  includePrograms: z.coerce.boolean().default(false),
});

// eslint-disable-next-line @typescript-eslint/require-await
export const channelsApi: RouterPluginAsyncCallback = async (fastify) => {
  const logger = LoggerFactory.child({
    caller: import.meta,
    className: 'ChannelsApi',
  });

  fastify.addHook('onError', (req, _, error, done) => {
    logger.error(error, '%s %s', req.routeOptions.method, req.routeOptions.url);
    done();
  });

  fastify.get(
    '/channels',
    {
      schema: {
        operationId: 'getChannels',
        tags: ['Channels'],
        response: {
          200: z.array(ChannelSchema),
          500: z.literal('error'),
        },
      },
    },
    async (req, res) => {
      try {
        const channelsAndLineups =
          await req.serverCtx.channelDB.loadAllLineupConfigs();

        const result = sortBy(
          map(channelsAndLineups, (channelAndLineup) => {
            return dbChannelToApiChannel(channelAndLineup);
          }),
          'number',
        );

        return res.send(result);
      } catch (err) {
        return res.status(500).send('error');
      }
    },
  );

  fastify.get(
    '/channels/:id',
    {
      schema: {
        operationId: 'getChannelsByNumberV2',
        tags: ['Channels'],
        params: BasicIdParamSchema,
        response: {
          200: ChannelSchema,
          404: z.void(),
          500: z.void(),
        },
      },
    },
    async (req, res) => {
      try {
        const channelAndLineup =
          await req.serverCtx.channelDB.loadChannelAndLineup(req.params.id);

        if (!isNil(channelAndLineup)) {
          const apiChannel = dbChannelToApiChannel(channelAndLineup);
          // TODO: This is super gnarly and we're doing this sorta custom everywhere.
          // We need a centralized way to either load ALL of the relevant metadata
          // for channels OR have the frontend request which fields it needs and we
          // service that.
          const channelFillters =
            await req.serverCtx.fillerDB.getFillersFromChannel(req.params.id);
          // const loadedFillers =
          //   await channelAndLineup.channel.channelFillers.load();
          const channelWithFillers = {
            ...apiChannel,
            fillerCollections: channelFillters.map((cf) => ({
              id: cf.fillerShow.uuid,
              cooldownSeconds: cf.cooldown,
              weight: cf.weight,
            })),
          };
          return res.send(channelWithFillers);
        } else {
          return res.status(404).send();
        }
      } catch (err) {
        logger.error(err, req.routeOptions.config.url);
        return res.status(500).send();
      }
    },
  );

  fastify.post(
    '/channels',
    {
      schema: {
        operationId: 'createChannelV2',
        tags: ['Channels'],
        body: SaveChannelRequestSchema,
        response: {
          201: ChannelSchema,
          500: z.object({}),
        },
      },
    },
    async (req, res) => {
      const inserted = await attempt(() =>
        req.serverCtx.channelDB.saveChannel(req.body),
      );
      if (isError(inserted)) {
        return res.status(500).send(inserted);
      }

      GlobalScheduler.getScheduledJob(UpdateXmlTvTask.ID)
        .runNow(true)
        .catch((err) => logger.error('Error regenerating guide: %O', err));
      await req.serverCtx.m3uService.regenerateCache();

      return res.status(201).send(dbChannelToApiChannel(inserted));
    },
  );

  fastify.put(
    '/channels/:id',
    {
      schema: {
        body: SaveChannelRequestSchema,
        tags: ['Channels'],
        params: z.object({ id: z.string() }),
        response: {
          200: ChannelSchema,
        },
      },
    },
    async (req, res) => {
      try {
        const channel = await req.serverCtx.channelDB.getChannel(req.params.id);

        if (!isNil(channel)) {
          const channelUpdate = {
            ...req.body,
          };
          const updatedChannel = await req.serverCtx.channelDB.updateChannel(
            channel.uuid,
            channelUpdate,
          );

          await req.serverCtx.guideService.updateCachedChannel(channel.uuid);
          await req.serverCtx.m3uService.regenerateCache();

          const apiChannel = omit(
            dbChannelToApiChannel(updatedChannel),
            'programs',
          );

          return res.send(apiChannel);
        } else {
          return res.status(404).send();
        }
      } catch (err) {
        logger.error(err, req.routeOptions.config.url);
        return res.status(500).send();
      }
    },
  );

  fastify.delete(
    '/channels/:id',
    {
      schema: {
        params: z.object({ id: z.string() }),
        tags: ['Channels'],
        response: {
          200: z.void(),
          404: z.void(),
        },
      },
    },
    async (req, res) => {
      const channel = await req.serverCtx.channelDB.getChannel(req.params.id);

      if (isNil(channel)) {
        return res.status(404).send();
      }

      await req.serverCtx.channelDB.deleteChannel(channel.uuid);
      await req.serverCtx.m3uService.regenerateCache();

      try {
        GlobalScheduler.getScheduledJob(UpdateXmlTvTask.ID)
          .runNow()
          .catch((err) => logger.error(err, 'Error regenerating guide'));
      } catch (e) {
        logger.error(e, 'Unable to update guide after lineup update %O');
      }

      return res.send();
    },
  );

  fastify.get(
    '/channels/:id/programs',
    {
      schema: {
        params: BasicIdParamSchema,
        tags: ['Channels'],
        response: {
          200: z.array(ContentProgramSchema).readonly(),
          404: z.void(),
        },
      },
    },
    async (req, res) => {
      try {
        const channel = await req.serverCtx.channelDB.getChannelAndPrograms(
          req.params.id,
        );

        if (!isNil(channel)) {
          const externalIds =
            await req.serverCtx.channelDB.getChannelProgramExternalIds(
              channel.uuid,
            );
          const externalIdsByProgramId = groupBy(externalIds, 'programUuid');
          return res.send(
            map(channel.programs, (program) =>
              req.serverCtx.programConverter.programDaoToContentProgram(
                program,
                externalIdsByProgramId[program.uuid] ?? [],
              ),
            ),
          );
        } else {
          return res.status(404).send();
        }
      } catch (err) {
        logger.error(err, req.routeOptions.url);
        return res.status(500).send();
      }
    },
  );

  fastify.get(
    '/channels/:id/programming',
    {
      schema: {
        params: BasicIdParamSchema,
        querystring: BasicPagingSchema,
        tags: ['Channels'],
        response: {
          200: GetChannelProgrammingResponseSchema,
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (req, res) => {
      const exists = await req.serverCtx.channelDB.channelExists(req.params.id);

      if (!exists) {
        return res.status(404).send({ error: 'Channel Not Found' });
      }

      const apiLineup = await req.serverCtx.channelDB.loadCondensedLineup(
        req.params.id,
        req.query.offset ?? 0,
        req.query.limit ?? -1,
      );

      if (isNil(apiLineup)) {
        return res
          .status(404)
          .send({ error: 'Could not find channel lineup.' });
      }

      // TODO: get rid of this
      return res.serializer(JSON.stringify).send(apiLineup);
    },
  );

  fastify.post(
    '/channels/:id/programming',
    {
      bodyLimit: 1024 * 1024 * 100,
      schema: {
        params: BasicIdParamSchema,
        tags: ['Channels'],
        body: UpdateChannelProgrammingRequestSchema,
        response: {
          200: CondensedChannelProgrammingSchema,
          404: z.void(),
          500: z.void(),
          501: z.void(),
        },
      },
    },
    async (req, res) => {
      if (isNil(await req.serverCtx.channelDB.getChannel(req.params.id))) {
        return res.status(404).send();
      }

      const result = await req.serverCtx.channelDB.updateLineup(
        req.params.id,
        req.body,
      );

      if (isNil(result)) {
        return res.status(500).send();
      }

      try {
        GlobalScheduler.getScheduledJob(UpdateXmlTvTask.ID)
          .runNow(true)
          .catch((err) => logger.error(err, 'Error regenerating guide'));
      } catch (e) {
        logger.error(e, 'Unable to update guide after lineup update');
      }

      // Potentially more DB queries than just building from the result,
      // this way we don't have to worry about what entities may or may not
      // be completely loaded by the ORM. It's cheap enough, so just do a wholesale
      // reload of the lineup and rebuild it to return to the frontend.
      // Alternatively:
      //  1. We can figure out a simple way to refresh the affected entities
      //     from the updateLineup call above. If performance suffers we can look into this
      //  2. We can just remove this completely and invalidate the lineup on the frontend
      //     and make it reload. Also not very clean, but not the end of the world.
      const newLineup = await timeNamedAsync(
        'build fresh lineup',
        LoggerFactory.root,
        () => req.serverCtx.channelDB.loadCondensedLineup(req.params.id),
      );

      if (isNil(newLineup)) {
        return res.status(500).send();
      }

      return res.status(200).serializer(JSON.stringify).send(newLineup);
    },
  );

  fastify.get(
    '/channels/:id/fallbacks',
    {
      schema: {
        params: BasicIdParamSchema,
        operationId: 'GetChannelFallbacks',
        description: "Returns a channel's fallback programs.",
        tags: ['Channels'],
        querystring: ChannelLineupQuery,
        response: {
          200: z.array(ContentProgramSchema),
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (req, res) => {
      const fallbacks =
        await req.serverCtx.channelDB.getChannelFallbackPrograms(req.params.id);
      const converted = map(fallbacks, (p) =>
        req.serverCtx.programConverter.programDaoToContentProgram(p, []),
      );
      return res.send(converted);
    },
  );

  fastify.get(
    '/channels/all/lineups',
    {
      schema: {
        querystring: ChannelLineupQuery,
        tags: ['Channels'],
        response: {
          200: z.array(ChannelLineupSchema),
          400: z.string(),
        },
      },
    },
    async (req, res) => {
      const dateRange = OpenDateTimeRange.create(req.query.from, req.query.to);

      if (isNull(dateRange)) {
        return res.status(400).send('Invalid date range');
      }

      return res
        .status(200)
        .send(await req.serverCtx.guideService.getAllChannelGuides(dateRange));
    },
  );

  fastify.get(
    '/channels/:id/lineup',
    {
      schema: {
        params: BasicIdParamSchema,
        tags: ['Channels'],
        querystring: ChannelLineupQuery,
        response: {
          200: ChannelLineupSchema,
          400: z.object({ error: z.string() }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (req, res) => {
      const dateRange = OpenDateTimeRange.create(req.query.from, req.query.to);

      if (isNull(dateRange)) {
        return res.status(400).send({ error: 'Invalid date range' });
      }

      const guide = await req.serverCtx.guideService.getChannelGuide(
        req.params.id,
        dateRange,
      );

      if (isUndefined(guide)) {
        return res.status(404).send({ error: 'Guide data not found' });
      }

      return res.send(guide);
    },
  );

  fastify.post(
    '/channels/schedule-time-slots',
    {
      schema: {
        tags: ['Channels'],
        body: z.object({
          schedule: TimeSlotScheduleSchema,
          programs: z.array(ChannelProgramSchema),
        }),
      },
    },
    async (req, res) => {
      return res.send(
        await scheduleTimeSlots(req.body.schedule, req.body.programs),
      );
    },
  );
};

// function zipWithIndex<T>(
//   arr: ReadonlyArray<T>,
// ): ReadonlyArray<T & { index: number }> {
//   return reduce(
//     arr,
//     (prev, curr, i) => {
//       return [...prev, { ...curr, index: i }];
//     },
//     [],
//   );
// }
