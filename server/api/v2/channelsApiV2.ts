import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration.js';
import { ContentProgram, isContentGuideProgram } from 'dizquetv-types';
import {
  ChannelLineupSchema,
  ChannelProgramSchema,
  ChannelProgrammingSchema,
  ChannelSchema,
  ProgramSchema,
  UpdateChannelRequestSchema,
} from 'dizquetv-types/schemas';
import {
  compact,
  filter,
  isError,
  isNil,
  omit,
  reduce,
  sortBy,
  sumBy,
} from 'lodash-es';
import z from 'zod';
import { buildApiLineup } from '../../dao/channelDb.js';
import { getEm } from '../../dao/dataSource.js';
import { LineupItem } from '../../dao/derived_types/Lineup.js';
import { Program } from '../../dao/entities/Program.js';
import createLogger from '../../logger.js';
import { scheduledJobsById } from '../../services/scheduler.js';
import { UpdateXmlTvTask } from '../../tasks/updateXmlTvTask.js';
import { RouterPluginAsyncCallback } from '../../types/serverType.js';
import { attempt, groupByFunc, mapAsyncSeq } from '../../util.js';
import { ProgramMinterFactory } from '../../util/programMinter.js';

dayjs.extend(duration);

const logger = createLogger(import.meta);

const ChannelNumberParamSchema = z.object({
  number: z.coerce.number(),
});

const ChannelLineupQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  includePrograms: z.coerce.boolean().default(false),
});

// eslint-disable-next-line @typescript-eslint/require-await
export const channelsApiV2: RouterPluginAsyncCallback = async (fastify) => {
  fastify.addHook('onError', (req, _, error, done) => {
    logger.error('%s %O', req.routeOptions.url, error);
    done();
  });

  fastify.get(
    '/channels',
    {
      schema: {
        operationId: 'getChannelsV2',
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
        z.array(ChannelSchema).parse(channels.map((c) => c.toDTO()));
        return res.send(channels.map((c) => c.toDTO()));
      } catch (err) {
        console.error(err);
        return res.status(500).send('error');
      }
    },
  );

  fastify.get(
    '/channels/:number',
    {
      schema: {
        operationId: 'getChannelsByNumberV2',
        params: ChannelNumberParamSchema,
        response: {
          200: ChannelSchema,
          404: z.void(),
          500: z.void(),
        },
      },
    },
    async (req, res) => {
      try {
        const channel = await req.serverCtx.channelCache.getChannelConfig(
          req.params.number,
        );

        if (!isNil(channel)) {
          return res.send(channel.toDTO());
        } else {
          return res.status(404).send();
        }
      } catch (err) {
        logger.error(req.routeConfig.url, err);
        return res.status(500).send();
      }
    },
  );

  fastify.post(
    '/channels',
    {
      schema: {
        operationId: 'createChannelV2',
        body: UpdateChannelRequestSchema,
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
      if (isError(inserted)) {
        return res.status(500).send(inserted);
      }
      return res.status(201).send({ id: inserted });
    },
  );

  fastify.put(
    '/channels/:number',
    {
      schema: {
        body: UpdateChannelRequestSchema,
        params: ChannelNumberParamSchema,
      },
    },
    async (req, res) => {
      try {
        const channel = await req.serverCtx.channelCache.getChannelConfig(
          req.params.number,
        );

        if (!isNil(channel)) {
          const channelUpdate = {
            ...req.body,
          };
          await req.serverCtx.channelDB.updateChannel(
            channel.uuid,
            channelUpdate,
          );
          return res.send(omit(channel, 'programs'));
        } else {
          return res.status(404).send();
        }
      } catch (err) {
        logger.error(req.routeConfig.url, err);
        return res.status(500).send();
      }
    },
  );

  fastify.get(
    '/channels/:number/programs',
    {
      schema: {
        params: ChannelNumberParamSchema,
        response: {
          200: z.array(ProgramSchema).readonly(),
          404: z.void(),
        },
      },
    },
    async (req, res) => {
      try {
        const channel = await req.serverCtx.channelCache.getChannelConfig(
          req.params.number,
        );

        if (!isNil(channel)) {
          await channel.programs.init();
          const programDtos = channel.programs.map((p) => p.toDTO());
          return res.send(programDtos);
        } else {
          return res.status(404).send();
        }
      } catch (err) {
        logger.error(req.routeOptions.url, err);
        return res.status(500).send();
      }
    },
  );

  fastify.get(
    '/channels/:number/programming',
    {
      schema: {
        params: ChannelNumberParamSchema,
        response: {
          200: ChannelProgrammingSchema,
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (req, res) => {
      const channel = await req.serverCtx.channelDB.getChannelAndPrograms(
        req.params.number,
      );

      if (!channel) {
        return res.status(404).send({ error: 'Channel Not Found' });
      }

      const apiLineup = await req.serverCtx.channelDB.loadAndMaterializeLineup(
        req.params.number,
      );

      return res.send(apiLineup!);
    },
  );

  fastify.post(
    '/channels/:number/programming',
    {
      schema: {
        params: ChannelNumberParamSchema,
        body: z.array(ChannelProgramSchema),
        response: {
          200: ChannelProgrammingSchema,
          404: z.void(),
        },
      },
    },
    async (req, res) => {
      const channel = await req.serverCtx.channelDB.getChannelAndPrograms(
        req.params.number,
      );

      if (isNil(channel)) {
        return res.status(404).send();
      }

      const programsWithIndex = zipWithIndex(req.body);
      const nonPersisted = filter(req.body, (p) => !p.persisted);
      const em = getEm();
      const minter = ProgramMinterFactory.create(em);

      const programsToPersist = filter(nonPersisted, isContentGuideProgram).map(
        (p) => minter.mint(p.externalSourceName!, p.originalProgram!),
      );

      const upsertedPrograms = await em.upsertMany(Program, programsToPersist, {
        batchSize: 10,
        onConflictAction: 'merge',
        onConflictFields: ['sourceType', 'externalSourceId', 'externalKey'],
        onConflictExcludeFields: ['uuid'],
      });

      console.log(upsertedPrograms);

      // TODO:
      // * calculate new channel duration
      // * remove "fake" flex item from front
      channel.startTime = dayjs().unix() * 1000;
      channel.duration = sumBy(req.body, (p) => p.duration);
      const existingIds = new Set(channel.programs.map((p) => p.uuid));
      for (const program of upsertedPrograms) {
        if (!existingIds.has(program.uuid)) {
          channel.programs.add(program);
        }
      }

      await getEm().persistAndFlush(channel);

      const dbIdByUniqueId = groupByFunc(
        upsertedPrograms,
        (p) => p.uniqueId(),
        (p) => p.uuid,
      );

      const newLineup: LineupItem[] = programsWithIndex.map((p) => {
        let item: LineupItem;
        switch (p.type) {
          case 'custom':
            item = {
              type: 'content', // Custom program
              durationMs: p.duration,
              id: p.id,
            };
            break;
          case 'content':
            item = {
              type: 'content',
              id: p.persisted ? p.id! : dbIdByUniqueId[contentItemUniqueId(p)],
              durationMs: p.duration,
            };
            break;
          case 'redirect':
            item = {
              type: 'redirect',
              channel: 1, // TODO fix this....!
              durationMs: p.duration,
            };
            break;
          case 'flex':
            item = {
              type: 'offline',
              durationMs: p.duration,
            };
            break;
        }

        return item;
      });

      await req.serverCtx.channelDB.saveLineup(req.params.number, {
        items: newLineup,
      });

      try {
        scheduledJobsById[UpdateXmlTvTask.ID]
          ?.runNow(true)
          .catch(console.error);
      } catch (e) {
        logger.error('Unable to update guide after lineup update %O', e);
      }

      const refreshedLineup = buildApiLineup(channel, newLineup);

      return res.status(200).send({
        icon: channel.icon,
        number: channel.number,
        name: channel.name,
        programs: refreshedLineup,
      });
    },
  );

  fastify.get(
    '/channels/all/lineups',
    {
      schema: {
        querystring: ChannelLineupQuery,
        response: {
          200: z.array(ChannelLineupSchema),
        },
      },
    },
    async (req, res) => {
      const allChannels = await req.serverCtx.channelDB.getAllChannels();

      const startTime = dayjs(req.query.from);
      const endTime = dayjs(req.query.to);
      const lineups = await mapAsyncSeq(
        allChannels,
        undefined,
        async (channel) => {
          const actualEndTime = req.query.to
            ? endTime
            : dayjs(
                startTime.add(channel.guideMinimumDurationSeconds, 'seconds'),
              );
          return req.serverCtx.guideService.getChannelLineup(
            channel.number,
            startTime.toDate(),
            actualEndTime.toDate(),
          );
        },
      );

      return res.status(200).send(compact(lineups));
    },
  );

  fastify.get(
    '/channels/:number/lineup',
    {
      schema: {
        params: ChannelNumberParamSchema,
        querystring: ChannelLineupQuery,
        response: {
          200: ChannelLineupSchema,
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (req, res) => {
      const channel = await req.serverCtx.channelDB.getChannelAndPrograms(
        req.params.number,
      );

      if (!channel) {
        return res.status(404).send({ error: 'Channel Not Found' });
      }

      const startTime = dayjs(req.query.from);
      const endTime = dayjs(
        req.query.to ??
          startTime.add(channel.guideMinimumDurationSeconds, 'seconds'),
      );

      const lineup = await req.serverCtx.guideService.getChannelLineup(
        channel.number,
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
};

function contentItemUniqueId(p: ContentProgram): string {
  // This isn't ideal
  return `${p.externalSourceType}_${p.externalSourceName}_${
    p.originalProgram!.key
  }`;
}

function zipWithIndex<T>(
  arr: ReadonlyArray<T>,
): ReadonlyArray<T & { index: number }> {
  return reduce(
    arr,
    (prev, curr, i) => {
      return [...prev, { ...curr, index: i }];
    },
    [],
  );
}
