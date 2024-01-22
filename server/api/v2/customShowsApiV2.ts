import { isContentProgram } from 'dizquetv-types';
import { CreateCustomShowRequestSchema } from 'dizquetv-types/api';
import { CustomShowSchema } from 'dizquetv-types/schemas';
import { chain, isNull, map, partition, reduce } from 'lodash-es';
import { z } from 'zod';
import { CustomShow } from '../../dao/entities/CustomShow.js';
import { CustomShowContent } from '../../dao/entities/CustomShowContent.js';
import { Program } from '../../dao/entities/Program.js';
import createLogger from '../../logger.js';
import { RouterPluginAsyncCallback } from '../../types/serverType.js';
import { ProgramMinterFactory } from '../../util/programMinter.js';

const logger = createLogger(import.meta);

// eslint-disable-next-line @typescript-eslint/require-await
export const customShowsApiV2: RouterPluginAsyncCallback = async (fastify) => {
  fastify.addHook('onError', (req, _, error, done) => {
    logger.error(req.routeConfig.url, error);
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
        params: z.object({
          id: z.string(),
        }),
        response: {
          200: CustomShowSchema,
          404: z.void(),
        },
      },
    },
    async (req, res) => {
      const customShow = await req.entityManager
        .repo(CustomShow)
        .findOne({ uuid: req.params.id }, { populate: ['content.uuid'] });
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
      const show = req.entityManager.repo(CustomShow).create({
        name: req.body.name,
      });

      let idx = 0;
      const programIndexById = reduce(
        req.body.programs,
        (acc, p) => {
          if (p.persisted) {
            acc[p.id!] = idx++;
          } else if (isContentProgram(p)) {
            acc[
              `${p.externalSourceType}_${p.externalSourceName!}_${p
                .originalProgram?.key}`
            ] = idx++;
          }
          return acc;
        },
        {} as Record<string, number>,
      );

      const [nonPersisted, persisted] = partition(
        req.body.programs,
        (p) => !p.persisted,
      );
      const minter = ProgramMinterFactory.create(req.entityManager);

      // TODO handle custom shows
      const programsToPersist = chain(nonPersisted)
        .filter(isContentProgram)
        .map((p) => minter.mint(p.externalSourceName!, p.originalProgram!))
        .value();

      const upsertedPrograms = await req.entityManager.upsertMany(
        Program,
        programsToPersist,
        {
          batchSize: 10,
          onConflictAction: 'merge',
          onConflictFields: ['sourceType', 'externalSourceId', 'externalKey'],
          onConflictExcludeFields: ['uuid'],
        },
      );

      await req.entityManager.persist(show).flush();

      const persistedCustomShowContent = map(persisted, (p) =>
        req.entityManager.create(CustomShowContent, {
          customShow: show.uuid,
          content: p.id!,
          index: programIndexById[p.id!],
        }),
      );
      const newCustomShowContent = map(upsertedPrograms, (p) =>
        req.entityManager.create(CustomShowContent, {
          customShow: show.uuid,
          content: p.uuid,
          index: programIndexById[p.uniqueId()],
        }),
      );

      await req.entityManager
        .persist([...persistedCustomShowContent, ...newCustomShowContent])
        .flush();

      return res.status(201).send({ id: show.uuid });
    },
  );
};
