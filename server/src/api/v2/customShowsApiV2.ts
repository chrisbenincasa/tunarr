import {
  CreateCustomShowRequestSchema,
  IdPathParamSchema,
} from '@tunarr/types/api';
import { CustomProgramSchema, CustomShowSchema } from '@tunarr/types/schemas';
import { isNull, map } from 'lodash-es';
import { z } from 'zod';
import { CustomShow } from '../../dao/entities/CustomShow.js';
import createLogger from '../../logger.js';
import { RouterPluginAsyncCallback } from '../../types/serverType.js';

const logger = createLogger(import.meta);

// eslint-disable-next-line @typescript-eslint/require-await
export const customShowsApiV2: RouterPluginAsyncCallback = async (fastify) => {
  fastify.addHook('onError', (req, _, error, done) => {
    logger.error(req.routeOptions.config.url, error);
    done();
  });

  fastify.get(
    '/custom-shows',
    {
      schema: {
        response: {
          200: z.array(CustomShowSchema),
        },
      },
    },
    async (req, res) => {
      const customShows = await req.entityManager
        .repo(CustomShow)
        .findAll({ populate: ['content.uuid'] });

      return res.send(
        map(customShows, (cs) => ({
          id: cs.uuid,
          name: cs.name,
          contentCount: cs.content.length,
        })),
      );
    },
  );

  fastify.get(
    '/custom-shows/:id',
    {
      schema: {
        params: IdPathParamSchema,
        response: {
          200: CustomShowSchema,
          404: z.void(),
        },
      },
    },
    async (req, res) => {
      const customShow = await req.serverCtx.customShowDB.getShow(
        req.params.id,
      );
      if (isNull(customShow)) {
        return res.status(404).send();
      }

      return res.status(200).send({
        id: customShow.uuid,
        name: customShow.name,
        contentCount: customShow.content.length,
      });
    },
  );

  fastify.get(
    '/custom-shows/:id/programs',
    {
      schema: {
        params: IdPathParamSchema,
        response: {
          200: z.array(CustomProgramSchema),
          404: z.void(),
        },
      },
    },
    async (req, res) => {
      return res
        .status(200)
        .send(await req.serverCtx.customShowDB.getShowPrograms(req.params.id));
    },
  );

  fastify.post(
    '/custom-shows',
    {
      schema: {
        body: CreateCustomShowRequestSchema,
        response: {
          201: z.object({ id: z.string() }),
        },
      },
    },
    async (req, res) => {
      const newId = await req.serverCtx.customShowDB.createShow(req.body);

      return res.status(201).send({ id: newId });
    },
  );

  fastify.delete(
    '/custom-shows/:id',
    {
      schema: {
        params: IdPathParamSchema,
        response: {
          200: z.object({ id: z.string() }),
          404: z.void(),
        },
      },
    },
    async (req, res) => {
      const customShow = await req.serverCtx.customShowDB.getShow(
        req.params.id,
      );

      if (isNull(customShow)) {
        return res.status(404).send();
      }

      await req.serverCtx.customShowDB.deleteShow(req.params.id);

      return res.status(200).send({ id: req.params.id });
    },
  );
};
