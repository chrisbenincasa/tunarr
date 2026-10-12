import {
  EmptyTrashStatusSchema,
  ProgramSearchResponse,
} from '@tunarr/types/api';
import type { SearchFilter } from '@tunarr/types/schemas';
import { ProgramTypeSchema } from '@tunarr/types/schemas';
import z from 'zod';
import { SearchProgramsCommand } from '../commands/SearchProgramsCommand.ts';
import { container } from '../container.ts';
import { EmptyTrashService } from '../services/EmptyTrashService.ts';
import type { RouterPluginAsyncCallback } from '../types/serverType.js';

// eslint-disable-next-line @typescript-eslint/require-await
export const trashApi: RouterPluginAsyncCallback = async (fastify) => {
  fastify.get(
    '/trash',
    {
      schema: {
        tags: ['Trash'],
        querystring: z.object({
          itemTypes: ProgramTypeSchema.array().optional(),
        }),
        response: {
          200: ProgramSearchResponse,
        },
      },
    },
    async (req, res) => {
      const trashedFilter = {
        type: 'value',
        fieldSpec: {
          key: 'state',
          name: '',
          op: '=',
          type: 'faceted_string',
          value: ['missing'],
        },
      } satisfies SearchFilter;

      let filter: SearchFilter;
      if (req.query.itemTypes && req.query.itemTypes.length > 0) {
        filter = {
          op: 'and',
          type: 'op',
          children: [
            trashedFilter,
            {
              type: 'value',
              fieldSpec: {
                key: 'type',
                name: '',
                op: 'in',
                value: req.query.itemTypes,
                type: 'faceted_string',
              },
            },
          ],
        };
      } else {
        filter = trashedFilter;
      }

      const searchResult = await container
        .get<SearchProgramsCommand>(SearchProgramsCommand)
        .execute({
          query: { filter },
        });

      return res.send(searchResult);
    },
  );

  fastify.delete(
    '/trash',
    {
      schema: {
        tags: ['Trash'],
        response: {
          202: EmptyTrashStatusSchema,
        },
      },
    },
    async (_req, res) => {
      const status = await container
        .get<EmptyTrashService>(EmptyTrashService)
        .request();
      return res.status(202).send(status);
    },
  );

  fastify.get(
    '/trash/status',
    {
      schema: {
        tags: ['Trash'],
        response: {
          200: EmptyTrashStatusSchema,
        },
      },
    },

    async (_req, res) => {
      const status = container
        .get<EmptyTrashService>(EmptyTrashService)
        .getStatus();
      return res.status(200).send(status);
    },
  );

  fastify.post(
    '/trash/cancel',
    {
      schema: {
        tags: ['Trash'],
        response: {
          200: EmptyTrashStatusSchema,
        },
      },
    },

    async (_req, res) => {
      const status = container
        .get<EmptyTrashService>(EmptyTrashService)
        .cancel();
      return res.status(200).send(status);
    },
  );
};
