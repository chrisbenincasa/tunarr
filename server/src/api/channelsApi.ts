import {
  dbChannelToApiChannel,
  ormChannelToApiChannel,
} from '@/db/converters/channelConverters.js';
import { GlobalScheduler } from '@/services/Scheduler.js';
import { UpdateXmlTvTask } from '@/tasks/UpdateXmlTvTask.js';
import { OpenDateTimeRange } from '@/types/OpenDateTimeRange.js';
import type { RouterPluginAsyncCallback } from '@/types/serverType.js';
import { isDefined } from '@/util/index.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { timeNamedAsync } from '@/util/perf.js';
import { seq } from '@tunarr/shared/util';
import { type ChannelSession, type CreateChannelRequest } from '@tunarr/types';
import {
  BasicIdParamSchema,
  BasicPagingSchema,
  MaterializedSchedule,
  PagedResult,
  RandomSlotScheduleSchema,
  SlotScheduleWithPrograms,
  TimeSlotScheduleSchema,
  TimeSlotScheduleWithPrograms,
  UpdateChannelProgrammingRequestSchema,
} from '@tunarr/types/api';
import {
  ChannelLineupSchema,
  ChannelSchema,
  CondensedChannelProgrammingSchema,
  ContentProgramSchema,
  ContentProgramTypeSchema,
  CreateChannelRequestSchema,
  MusicArtist,
  SaveableChannelSchema,
  Show as ShowSchema,
  TerminalProgramSchema,
  TranscodeConfigSchema,
  TvGuideProgramSchema,
} from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration.js';
import {
  head,
  isEmpty,
  isNil,
  isNull,
  isUndefined,
  map,
  omit,
  orderBy,
  reduce,
} from 'lodash-es';
import z from 'zod/v4';
import { GetMaterializedChannelScheduleCommand } from '../commands/GetMaterializedChannelScheduleCommand.ts';
import { MaterializeLineupCommand } from '../commands/MaterializeLineupCommand.ts';
import { MaterializeProgramGroupings } from '../commands/MaterializeProgramGroupings.ts';
import { MaterializeProgramsCommand } from '../commands/MaterializeProgramsCommand.ts';
import { container } from '../container.ts';
import { dbTranscodeConfigToApiSchema } from '../db/converters/transcodeConfigConverters.ts';
import type { LegacyChannelAndLineup } from '../db/interfaces/IChannelDB.ts';
import type { SessionType } from '../stream/Session.ts';
import { Result } from '../types/result.ts';
import { PagingParams } from '../types/schemas.ts';

dayjs.extend(duration);

const ChannelLineupQuery = z.object({
  from: z.iso.datetime().optional().pipe(z.coerce.date()),
  to: z.iso.datetime().optional().pipe(z.coerce.date()),
  includePrograms: z.coerce.boolean().default(false),
});

// eslint-disable-next-line @typescript-eslint/require-await
export const channelsApi: RouterPluginAsyncCallback = async (fastify) => {
  const logger = LoggerFactory.child({
    caller: import.meta,
    className: 'ChannelsApi',
  });

  fastify.addHook('onError', (req, _, error, done) => {
    logger.error({
      error,
      method: req.routeOptions.method,
      url: req.routeOptions.url,
    });
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
      const channelsAndLineups =
        await req.serverCtx.channelDB.loadAllLineupConfigs();

      const sessionsByChannel =
        req.serverCtx.sessionManager.allSessionsByChannel();

      const result = orderBy(
        map(channelsAndLineups, (channelAndLineup) => {
          const sessions = sessionsByChannel[channelAndLineup.channel.uuid];
          const apiSessions = reduce(
            sessions,
            (prev, session, sessionType) => {
              if (!session) {
                return prev;
              }
              prev.push({
                connections: map(
                  session.connections(),
                  (connection, token) => ({
                    ...connection,
                    lastHeartbeat: session?.lastHeartbeat(token),
                  }),
                ),
                type: sessionType as SessionType,
                state: session.state,
                numConnections: session.numConnections(),
              } satisfies ChannelSession);

              return prev;
            },
            [] as ChannelSession[],
          );
          return {
            ...ormChannelToApiChannel(channelAndLineup),
            sessions: apiSessions,
          };
        }),
        'number',
      );

      return res.send(result);
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
          // TODO: This is super gnarly and we're doing this sorta custom everywhere.
          // We need a centralized way to either load ALL of the relevant metadata
          // for channels OR have the frontend request which fields it needs and we
          // service that.
          const [channelFillers, channelSubtitles] = await Promise.all([
            req.serverCtx.fillerDB.getFillersFromChannel(req.params.id),
            req.serverCtx.channelDB.getChannelSubtitlePreferences(
              req.params.id,
            ),
          ]);

          const apiChannel = dbChannelToApiChannel({
            ...channelAndLineup,
            channel: {
              ...channelAndLineup.channel,
              subtitlePreferences: channelSubtitles,
            },
          });
          // const loadedFillers =
          //   await channelAndLineup.channel.channelFillers.load();
          const channelWithFillers = {
            ...apiChannel,
            fillerCollections: channelFillers.map((cf) => ({
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
        body: CreateChannelRequestSchema,
        response: {
          201: ChannelSchema,
          400: z.string(),
          500: z.object({}),
        },
      },
    },
    async (req, res) => {
      const body: CreateChannelRequest = req.body;
      let insertResult: Result<LegacyChannelAndLineup>;
      switch (body.type) {
        case 'copy':
          insertResult = await Result.attemptAsync(() =>
            req.serverCtx.channelDB.copyChannel(body.channelId),
          );
          break;
        case 'new':
          insertResult = await Result.attemptAsync(() =>
            req.serverCtx.channelDB.saveChannel(body.channel),
          );
          break;
      }

      if (insertResult.isFailure()) {
        throw insertResult.error;
      }

      const inserted = insertResult.get();

      // const inserted = await attempt(() =>
      //   req.serverCtx.channelDB.saveChannel(req.body),
      // );
      // if (isError(inserted)) {
      //   return res.status(500).send(inserted);
      // }

      GlobalScheduler.getScheduledJob(UpdateXmlTvTask.ID)
        .runNow(true)
        .catch((err) => logger.error(err, 'Error regenerating guide'));
      await req.serverCtx.m3uService.regenerateCache();

      return res.status(201).send(dbChannelToApiChannel(inserted));
    },
  );

  fastify.put(
    '/channels/:id',
    {
      schema: {
        body: SaveableChannelSchema,
        tags: ['Channels'],
        params: z.object({ id: z.string() }),
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
          const channelUpdate = {
            ...req.body,
          };

          const updatedChannel = await req.serverCtx.channelDB.updateChannel(
            channel.uuid,
            channelUpdate,
          );
          const subtitlePreferences =
            await req.serverCtx.channelDB.getChannelSubtitlePreferences(
              channel.uuid,
            );

          const needsGuideRegen =
            channel.guideMinimumDuration !==
              updatedChannel.channel.guideMinimumDuration ||
            isDefined(req.body.onDemand);

          await req.serverCtx.guideService.updateCachedChannel(
            channel.uuid,
            needsGuideRegen,
          );
          await req.serverCtx.m3uService.regenerateCache();

          const apiChannel = omit(
            dbChannelToApiChannel({
              ...updatedChannel,
              channel: {
                ...updatedChannel.channel,
                subtitlePreferences,
              },
            }),
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
        querystring: z.object({
          ...PagingParams.shape,
          type: ContentProgramTypeSchema.optional(),
        }),
        tags: ['Channels'],
        response: {
          200: PagedResult(z.array(TerminalProgramSchema)),
          404: z.void(),
        },
      },
    },
    async (req, res) => {
      const { results: programs, total } =
        await req.serverCtx.channelDB.getChannelPrograms(
          req.params.id,
          {
            offset: req.query.offset,
            limit: req.query.limit,
          },
          req.query.type,
        );

      const materializer = container.get<MaterializeProgramsCommand>(
        MaterializeProgramsCommand,
      );
      const materialized = await materializer.execute(programs);

      return res.send({
        result: materialized,
        size: materialized.length,
        total,
      });
    },
  );

  fastify.get(
    '/channels/:id/shows',
    {
      schema: {
        params: BasicIdParamSchema,
        querystring: PagingParams,
        response: {
          200: PagedResult(z.array(ShowSchema)),
        },
      },
    },
    async (req, res) => {
      const { total, results: shows } =
        await req.serverCtx.channelDB.getChannelTvShows(
          req.params.id,
          req.query,
        );

      const apiGroupings = await container
        .get<MaterializeProgramGroupings>(MaterializeProgramGroupings)
        .execute(shows);
      const apiShows = apiGroupings.filter((group) => group.type === 'show');

      return res.send({
        total,
        result: apiShows,
        size: apiShows.length,
      });
    },
  );

  fastify.get(
    '/channels/:id/artists',
    {
      schema: {
        params: BasicIdParamSchema,
        querystring: PagingParams,
        response: {
          200: PagedResult(z.array(MusicArtist)),
        },
      },
    },
    async (req, res) => {
      const { total, results: musicArtists } =
        await req.serverCtx.channelDB.getChannelMusicArtists(
          req.params.id,
          req.query,
        );

      const apiGroupings = await container
        .get<MaterializeProgramGroupings>(MaterializeProgramGroupings)
        .execute(musicArtists);
      const artists = apiGroupings.filter((group) => group.type === 'artist');

      return res.send({
        total,
        result: artists,
        size: artists.length,
      });
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
          200: CondensedChannelProgrammingSchema,
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
      const converted = seq.collect(fallbacks, (p) =>
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

  fastify.get(
    '/channels/:id/now_playing',
    {
      schema: {
        params: BasicIdParamSchema,
        tags: ['Channels'],
        response: {
          200: TvGuideProgramSchema,
          400: z.object({ error: z.string() }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (req, res) => {
      const now = dayjs();
      const guide = await req.serverCtx.guideService.getChannelGuide(
        req.params.id,
        OpenDateTimeRange.create(now, now.add(1))!,
      );

      if (isUndefined(guide) || isEmpty(guide.programs)) {
        return res.status(404).send({ error: 'Guide data not found' });
      }

      return res.send(head(guide.programs));
    },
  );

  fastify.get(
    '/channels/:id/transcode_config',
    {
      schema: {
        params: z.object({
          id: z.string(),
        }),
        response: {
          200: TranscodeConfigSchema,
        },
      },
    },
    async (req, res) => {
      const config = await req.serverCtx.transcodeConfigDB.getChannelConfig(
        req.params.id,
      );
      return res.send(dbTranscodeConfigToApiSchema(config));
    },
  );

  fastify.post(
    '/channels/:channelId/schedule-time-slots',
    {
      schema: {
        tags: ['Channels'],
        params: z.object({
          channelId: z.string(),
        }),
        body: z.object({
          schedule: TimeSlotScheduleSchema,
        }),
        response: {
          200: TimeSlotScheduleWithPrograms,
        },
      },
    },
    async (req, res) => {
      const { result } = await req.serverCtx.workerPool.queueTask({
        request: {
          type: 'channel',
          channelId: req.params.channelId,
          schedule: req.body.schedule,
        },
        type: 'time-slots',
      });

      const programsById = await container
        .get(MaterializeLineupCommand)
        .execute({
          lineup: result.lineup,
        });

      return res.serializer(JSON.stringify).send({
        ...result,
        programs: programsById,
      });
    },
  );

  fastify.post(
    '/channels/:channelId/schedule-slots',
    {
      schema: {
        tags: ['Channels'],
        params: z.object({
          channelId: z.string(),
        }),
        body: z.object({
          schedule: RandomSlotScheduleSchema,
        }),
        response: {
          200: SlotScheduleWithPrograms,
        },
      },
    },
    async (req, res) => {
      const { result } = await req.serverCtx.workerPool.queueTask({
        request: {
          type: 'channel',
          channelId: req.params.channelId,
          schedule: req.body.schedule,
        },
        type: 'schedule-slots',
      });

      const programsById = await container
        .get(MaterializeLineupCommand)
        .execute({
          lineup: result.lineup,
        });

      return res.serializer(JSON.stringify).send({
        ...result,
        programs: programsById,
      });
    },
  );

  fastify.get(
    '/channels/:id/schedule',
    {
      schema: {
        tags: ['Channels', 'Scheduling'],
        params: z.object({
          id: z.uuid(),
        }),
        response: {
          200: z.object({
            schedule: MaterializedSchedule.optional(),
          }),
        },
      },
    },
    async (req, res) => {
      const result = await container
        .get(GetMaterializedChannelScheduleCommand)
        .execute({
          channelId: req.params.id,
        });

      if (!result) {
        return res.send();
      }

      return res.serializer(JSON.stringify).send({ schedule: result });
    },
  );
};
