import { DateTimeRange } from '@/types/DateTimeRange.js';
import { OpenDateTimeRange } from '@/types/OpenDateTimeRange.js';
import type { RouterPluginCallback } from '@/types/serverType.js';
import { groupByUniq } from '@/util/index.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { ChannelLineupSchema } from '@tunarr/types/schemas';
import { isNull } from 'lodash-es';
import { z } from 'zod/v4';

export const guideRouter: RouterPluginCallback = (fastify, _opts, done) => {
  const logger = LoggerFactory.child({
    caller: import.meta,
    className: 'GuideApi',
  });

  fastify.get(
    '/guide/status',
    {
      schema: {
        operationId: 'getGuideStatus',
        summary: 'Get TV guide status',
        tags: ['Guide'],
      },
    },
    async (req, res) => {
      try {
        const s = await req.serverCtx.guideService.getStatus();
        return res.send(s);
      } catch (err) {
        logger.error(err, '%s', req.routeOptions.url);
        return res.status(500).send('error');
      }
    },
  );

  fastify.get(
    '/guide/debug',
    {
      schema: {
        operationId: 'getGuideDebug',
        summary: 'Get raw TV guide debug data',
        tags: ['Debug'],
      },
    },
    async (req, res) => {
      try {
        const s = await req.serverCtx.guideService.get();
        return res.send(s);
      } catch (err) {
        logger.error(err, '%s', req.routeOptions.url);
        return res.status(500).send('error');
      }
    },
  );

  fastify.get(
    '/guide/channels',
    {
      schema: {
        operationId: 'getAllChannelGuides',
        summary: 'Get guide data for all channels',
        description:
          'Returns TV guide lineups for all channels within the specified date/time range.',
        tags: ['Guide'],
        querystring: z.object({
          dateFrom: z.coerce.date(),
          dateTo: z.coerce.date(),
        }),
        response: {
          200: z.record(z.string(), ChannelLineupSchema),
          400: z.string(),
        },
      },
    },
    async (req, res) => {
      const range = DateTimeRange.create(req.query.dateFrom, req.query.dateTo);
      if (isNull(range)) {
        return res.status(400).send('Invalid date range');
      }

      const guideByChannel = groupByUniq(
        await req.serverCtx.guideService.getAllChannelGuides(range),
        (guide) => guide.id,
      );

      return res.send(guideByChannel);
    },
  );

  fastify.get(
    '/guide/channels/:id',
    {
      schema: {
        operationId: 'getChannelGuide',
        summary: 'Get guide data for a channel',
        description:
          'Returns the TV guide lineup for a specific channel within the given date/time range.',
        tags: ['Guide'],
        params: z.object({
          id: z.string(),
        }),
        querystring: z.object({
          dateFrom: z.string().pipe(z.coerce.date()),
          dateTo: z.string().pipe(z.coerce.date()),
        }),
        response: {
          200: ChannelLineupSchema,
          400: z.string(),
          404: z.string(),
          500: z.string(),
        },
      },
    },
    async (req, res) => {
      try {
        const range = OpenDateTimeRange.create(
          req.query.dateFrom,
          req.query.dateTo,
        );
        if (isNull(range)) {
          return res.status(400).send('Invalid date range');
        }
        const lineup = await req.serverCtx.guideService.getChannelGuide(
          req.params.id,
          range,
        );
        if (lineup == null) {
          return res.status(404).send('Channel not found in TV guide');
        } else {
          return res.send(lineup);
        }
      } catch (err) {
        logger.error(err, '%s', req.routeOptions.url);
        return res.status(500).send('error');
      }
    },
  );

  done();
};
