import { scheduleTimeSlots } from '@tunarr/shared';
import {
  BasicIdParamSchema,
  BasicPagingSchema,
  TimeSlotScheduleSchema,
  UpdateChannelProgrammingRequestSchema,
} from '@tunarr/types/api';
import {
  ChannelLineupSchema,
  ChannelProgramSchema,
  ChannelSchema,
  CondensedChannelProgrammingSchema,
  ProgramSchema,
  SaveChannelRequestSchema,
} from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration.js';
import { compact, isError, isNil, map, omit, sortBy } from 'lodash-es';
import z from 'zod';
import { GlobalScheduler } from '../services/scheduler.js';
import { UpdateXmlTvTask } from '../tasks/UpdateXmlTvTask.js';
import { RouterPluginAsyncCallback } from '../types/serverType.js';
import { attempt, mapAsyncSeq } from '../util/index.js';
import { LoggerFactory } from '../util/logging/LoggerFactory.js';

dayjs.extend(duration);

const ChannelLineupQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  includePrograms: z.coerce.boolean().default(false),
});

// eslint-disable-next-line @typescript-eslint/require-await
export const channelsApi: RouterPluginAsyncCallback = async (fastify) => {
  const logger = LoggerFactory.child({ caller: import.meta });

  fastify.addHook('onError', (req, _, error, done) => {
    logger.error(error, '%s %s', req.routerMethod, req.routeOptions.url);
    done();
  });

  fastify.get(
    '/channels',
    {
      schema: {
        operationId: 'getChannelsV2',
        tags: ['Channels'],
        response: {
          200: z.array(ChannelSchema),
          500: z.literal('error'),
        },
      },
    },
    async (req, res) => {
      try {
        const channels = sortBy(
          await req.serverCtx.channelDB.getAllChannels(),
          'number',
        );
        return res.send(channels.map((c) => c.toDTO()));
      } catch (err) {
        console.error(err);
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
        const channel = await req.serverCtx.channelDB.getChannel(req.params.id);

        if (!isNil(channel)) {
          return res.send(channel.toDTO());
        } else {
          return res.status(404).send();
        }
      } catch (err) {
        logger.error(err, req.routeConfig.url);
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
          201: z.object({ id: z.string() }),
          500: z.object({}),
        },
      },
    },
    async (req, res) => {
      const inserted = await attempt(() =>
        req.serverCtx.channelDB.saveChannel(req.body),
      );
      GlobalScheduler.getScheduledJob(UpdateXmlTvTask.ID)
        .runNow(true)
        .catch((err) => logger.error('Error regenerating guide: %O', err));
      if (isError(inserted)) {
        return res.status(500).send(inserted);
      }
      return res.status(201).send({ id: inserted });
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
        const channel = await req.serverCtx.channelDB.getChannelById(
          req.params.id,
        );

        if (!isNil(channel)) {
          const channelUpdate = {
            ...req.body,
          };
          const updatedChannel = await req.serverCtx.channelDB.updateChannel(
            channel.uuid,
            channelUpdate,
          );
          await req.serverCtx.guideService.updateCachedChannel(updatedChannel);
          return res.send(omit(updatedChannel.toDTO(), 'programs'));
        } else {
          return res.status(404).send();
        }
      } catch (err) {
        logger.error(err, req.routeConfig.url);
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
      const channel = await req.serverCtx.channelDB.getChannelById(
        req.params.id,
      );

      if (isNil(channel)) {
        return res.status(404).send();
      }

      await req.serverCtx.channelDB.deleteChannel(channel.uuid);

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
          200: z.array(ProgramSchema).readonly(),
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
          return res.send(map(channel.programs, (p) => p.toDTO()));
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
        params: BasicIdParamSchema.merge(BasicPagingSchema),
        tags: ['Channels'],
        response: {
          200: CondensedChannelProgrammingSchema,
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (req, res) => {
      const channel = await req.serverCtx.channelDB.getChannelById(
        req.params.id,
      );

      if (!channel) {
        return res.status(404).send({ error: 'Channel Not Found' });
      }

      const apiLineup = await req.serverCtx.channelDB.loadCondensedLineup(
        req.params.id,
        req.params.offset ?? 0,
        req.params.limit ?? -1,
      );

      if (isNil(apiLineup)) {
        return res
          .status(404)
          .send({ error: 'Could not find channel lineup.' });
      }

      return res.send(apiLineup);
    },
  );

  fastify.post(
    '/channels/:id/programming',
    {
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
      if (
        isNil(
          await req.serverCtx.channelDB.getChannelAndPrograms(req.params.id),
        )
      ) {
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
      const newLineup = await req.serverCtx.channelDB.loadCondensedLineup(
        req.params.id,
      );

      if (isNil(newLineup)) {
        return res.status(500).send();
      }

      return res.status(200).send(newLineup);
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
        },
      },
    },
    async (req, res) => {
      const allChannels = await req.serverCtx.channelDB.getAllChannels({
        number: 'ASC',
      });

      const startTime = dayjs(req.query.from);
      const endTime = dayjs(req.query.to);
      const lineups = await mapAsyncSeq(allChannels, async (channel) => {
        const actualEndTime = req.query.to
          ? endTime
          : dayjs(startTime.add(channel.guideMinimumDuration, 'seconds'));
        return req.serverCtx.guideService.getChannelLineup(
          channel.uuid,
          startTime.toDate(),
          actualEndTime.toDate(),
        );
      });

      return res.status(200).send(compact(lineups));
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
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (req, res) => {
      const channel = await req.serverCtx.channelDB.getChannelAndPrograms(
        req.params.id,
      );

      if (!channel) {
        return res.status(404).send({ error: 'Channel Not Found' });
      }

      const xmltvSettings = req.serverCtx.settings.xmlTvSettings();
      const startTime = dayjs(req.query.from);
      const endTime = dayjs(
        req.query.to ?? startTime.add(xmltvSettings.programmingHours, 'hours'),
      );

      const lineup = await req.serverCtx.guideService.getChannelLineup(
        channel.uuid,
        startTime.toDate(),
        endTime.toDate(),
      );

      if (!lineup) {
        return res
          .status(404)
          .send({ error: 'Could not generate lineup for channel' });
      }

      return res.status(200).send(lineup);
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
