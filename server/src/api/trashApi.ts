import type { SearchFilter } from '@tunarr/types/api';
import { ProgramSearchResponse } from '@tunarr/types/api';
import { ProgramTypeSchema } from '@tunarr/types/schemas';
import z from 'zod';
import { SearchProgramsCommand } from '../commands/SearchProgramsCommand.ts';
import { container } from '../container.ts';
import type { RouterPluginAsyncCallback } from '../types/serverType.js';

// eslint-disable-next-line @typescript-eslint/require-await
export const trashApi: RouterPluginAsyncCallback = async (fastify) => {
  fastify.get(
    '/trash',
    {
      schema: {
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
          type: 'facted_string',
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
                type: 'facted_string',
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

  fastify.delete('/trash', {}, async (req, res) => {
    await Promise.all([
      req.serverCtx.programDB.emptyTrashPrograms(),
      req.serverCtx.searchService.deleteMissing(),
    ]);
    return res.status(200).send();
  });
};
