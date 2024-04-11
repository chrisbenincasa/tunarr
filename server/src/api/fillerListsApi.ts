import {
  CreateFillerListRequestSchema,
  IdPathParamSchema,
  UpdateFillerListRequestSchema,
} from '@tunarr/types/api';
import {
  FillerListProgrammingSchema,
  FillerListSchema,
} from '@tunarr/types/schemas';
import { isNil, map } from 'lodash-es';
import { z } from 'zod';
import { RouterPluginAsyncCallback } from '../types/serverType.js';
import { FillerShowId } from '../dao/entities/FillerShow.js';

// We can't use the built-in zod brand because we have our own custom
// tagged type.
const fillerShowIdSchema = z
  .string()
  .uuid()
  .transform((str) => str as FillerShowId);

// eslint-disable-next-line @typescript-eslint/require-await
export const fillerListsApi: RouterPluginAsyncCallback = async (fastify) => {
  fastify.get(
    '/filler-lists',
    {
      schema: {
        response: {
          200: z.array(FillerListSchema),
        },
      },
    },
    async (req, res) => {
      const fillers = await req.serverCtx.fillerDB.getAllFillers();

      return res.send(
        map(fillers, (f) => ({
          id: f.uuid,
          name: f.name,
          contentCount: f.content.length,
        })),
      );
    },
  );

  fastify.get(
    '/filler-lists/:id',
    {
      schema: {
        params: z.object({ id: fillerShowIdSchema }),
        response: {
          200: FillerListSchema,
          404: z.void(),
        },
      },
    },
    async (req, res) => {
      const filler = await req.serverCtx.fillerDB.getFiller(req.params.id);
      if (isNil(filler)) {
        return res.status(404).send();
      }

      return res.send({
        id: filler.uuid,
        name: filler.name,
        contentCount: filler.content.length,
      });
    },
  );

  fastify.delete(
    '/filler-lists/:id',
    {
      schema: {
        params: z.object({ id: fillerShowIdSchema }),
        response: {
          200: z.void(),
          404: z.void(),
        },
      },
    },
    async (req, res) => {
      const filler = await req.serverCtx.fillerDB.getFiller(req.params.id);
      if (isNil(filler)) {
        return res.status(404).send();
      }
      await req.serverCtx.fillerDB.deleteFiller(req.params.id);
      return res.send();
    },
  );

  fastify.post(
    '/filler-lists',
    {
      schema: {
        body: CreateFillerListRequestSchema,
        response: {
          201: z.object({ id: z.string() }),
        },
      },
    },
    async (req, res) => {
      const id = await req.serverCtx.fillerDB.createFiller(req.body);
      return res.status(201).send({ id });
    },
  );

  fastify.put(
    '/filler-lists/:id',
    {
      schema: {
        params: z.object({
          id: fillerShowIdSchema,
        }),
        body: UpdateFillerListRequestSchema,
        response: {
          200: FillerListSchema,
        },
      },
    },
    async (req, res) => {
      const result = await req.serverCtx.fillerDB.saveFiller(
        req.params.id,
        req.body,
      );

      if (isNil(result)) {
        return res.status(404).send();
      }

      console.log('sending response');

      return res.send({
        id: result.uuid,
        name: result.name,
        contentCount: result.content.length,
      });
    },
  );

  fastify.get(
    '/filler-lists/:id/programs',
    {
      schema: {
        params: IdPathParamSchema.extend({ id: fillerShowIdSchema }),
        response: {
          200: FillerListProgrammingSchema,
          404: z.void(),
        },
      },
    },
    async (req, res) => {
      return res
        .status(200)
        .send(await req.serverCtx.fillerDB.getFillerPrograms(req.params.id));
    },
  );
};
