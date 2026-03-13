import { tag } from '@tunarr/types';
import { ProgramGroupingSchema } from '@tunarr/types/schemas';
import { inject, injectable } from 'inversify';
import z from 'zod';
import { MaterializeProgramGroupings } from '../commands/MaterializeProgramGroupings.ts';
import { container } from '../container.ts';
import { ProgramGroupingDB } from '../db/ProgramGroupingDB.ts';
import {
  MediaSourceId,
  RemoteSourceType,
  RemoteSourceTypes,
} from '../db/schema/base.ts';
import { BatchLookupExternalProgrammingSchema } from '../types/schemas.ts';
import { RouterPluginAsyncCallback } from '../types/serverType.js';
import { groupByUniq, inConstArr } from '../util/index.ts';
import { ApiController } from './ApiController.ts';

@injectable()
export class ProgramGroupingApiController implements ApiController {
  constructor(
    @inject(ProgramGroupingDB) private programGroupingDB: ProgramGroupingDB,
  ) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  mount: RouterPluginAsyncCallback = async (fastify) => {
    fastify.post(
      '/program_groupings/batch/lookup',
      {
        schema: {
          tags: ['Program Groupings'],
          operationId: 'batchGetProgramGroupingsByExternalIds',
          body: BatchLookupExternalProgrammingSchema,
          response: {
            200: z.record(z.string(), ProgramGroupingSchema),
          },
        },
      },
      async (req, res) => {
        const ids = req.body.externalIds
          .values()
          .filter(([source]) => inConstArr(RemoteSourceTypes, source))
          .map(
            ([source, sourceId, id]) =>
              [source, tag<MediaSourceId>(sourceId), id] as [
                RemoteSourceType,
                MediaSourceId,
                string,
              ],
          )
          .toArray();

        const results = await this.programGroupingDB.lookupByExternalIds(
          new Set(ids),
        );

        const materialized = await container
          .get<MaterializeProgramGroupings>(MaterializeProgramGroupings)
          .execute(results);

        return res.send(groupByUniq(materialized, (p) => p.uuid));
      },
    );
  };
}
