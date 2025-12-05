import { SmartCollection } from '@tunarr/types/schemas';
import { inject, injectable } from 'inversify';
import z from 'zod';
import { SmartCollectionsDB } from '../db/SmartCollectionsDB.ts';
import { RouterPluginAsyncCallback } from '../types/serverType.js';

@injectable()
export class SmartCollectionsApiController {
  constructor(
    @inject(SmartCollectionsDB) private smartCollectionDB: SmartCollectionsDB,
  ) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  mount: RouterPluginAsyncCallback = async (fastify) => {
    fastify.get(
      '/smart_collections',
      {
        schema: {
          tags: ['Smart Collections'],
          response: {
            200: SmartCollection.array(),
          },
        },
      },
      async (_, res) => {
        return res.send(await this.smartCollectionDB.getAll());
      },
    );

    fastify.get(
      '/smart_collections/:id',
      {
        schema: {
          tags: ['Smart Collections'],
          params: z.object({
            id: z.uuid(),
          }),
          response: {
            200: SmartCollection,
            404: z.void(),
          },
        },
      },
      async (req, res) => {
        const smartCollection = await this.smartCollectionDB.getById(
          req.params.id,
        );
        if (!smartCollection) {
          return res.status(404).send();
        }
        return res.send(smartCollection);
      },
    );

    fastify.delete(
      '/smart_collections/:id',
      {
        schema: {
          tags: ['Smart Collections'],
          params: z.object({
            id: z.uuid(),
          }),
          response: {
            204: z.void(),
            404: z.void(),
          },
        },
      },
      async (req, res) => {
        const smartCollection = await this.smartCollectionDB.getById(
          req.params.id,
        );
        if (!smartCollection) {
          return res.status(404).send();
        }
        await this.smartCollectionDB.delete(smartCollection.uuid);
        return res.status(204).send();
      },
    );

    fastify.post(
      '/smart_collections',
      {
        schema: {
          tags: ['Smart Collections'],
          body: SmartCollection.omit({ uuid: true }),
          response: {
            201: SmartCollection,
            500: z.string(),
          },
        },
      },
      async (req, res) => {
        const smartCollection = await this.smartCollectionDB.insert(req.body);
        if (smartCollection.isFailure()) {
          throw smartCollection.error;
        }
        return res.send(smartCollection.get());
      },
    );

    fastify.put(
      '/smart_collections/:id',
      {
        schema: {
          tags: ['Smart Collections'],
          params: z.object({
            id: z.uuid(),
          }),
          body: SmartCollection.omit({ uuid: true }).partial(),
          response: {
            200: SmartCollection,
            404: z.void(),
          },
        },
      },
      async (req, res) => {
        const smartCollection = await this.smartCollectionDB.getById(
          req.params.id,
        );
        if (!smartCollection) {
          return res.status(404).send();
        }

        await this.smartCollectionDB.update(req.params.id, req.body);
        return res.send(smartCollection);
      },
    );
  };
}
