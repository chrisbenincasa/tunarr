import { chunk, every, isNil, isUndefined, reduce } from 'lodash-es';
import z from 'zod';
import { getEm } from '../../dao/dataSource.js';
import {
  Program,
  programSourceTypeFromString,
} from '../../dao/entities/Program.js';
import { RouterPluginAsyncCallback } from '../../types/serverType.js';
import { mapAsyncSeq } from '../../util.js';
import { ProgramSchema } from '@tunarr/types/schemas';

const LookupExternalProgrammingSchema = z.object({
  externalId: z
    .string()
    .transform((s) => s.split('|', 3) as [string, string, string]),
});

const BatchLookupExternalProgrammingSchema = z.object({
  externalIds: z
    .array(z.string())
    .transform(
      (s) =>
        new Set(
          [...s].map((s0) => s0.split('|', 3) as [string, string, string]),
        ),
    )
    .refine((set) => {
      return every(
        [...set],
        (tuple) => !isUndefined(programSourceTypeFromString(tuple[0])),
      );
    }),
});

// eslint-disable-next-line @typescript-eslint/require-await
export const programmingApi: RouterPluginAsyncCallback = async (fastify) => {
  fastify.get(
    '/programming/:externalId',
    {
      schema: {
        operationId: 'getProgramByExternalId',
        params: LookupExternalProgrammingSchema,
        response: {
          200: ProgramSchema,
          400: z.object({ message: z.string() }),
          404: z.void(),
        },
      },
    },
    async (req, res) => {
      const [sourceType, externalSourceId, externalKey] = req.params.externalId;
      const sourceTypeParsed = programSourceTypeFromString(sourceType);
      if (isUndefined(sourceTypeParsed)) {
        return res
          .status(400)
          .send({ message: 'Invalid sourceType ' + sourceType });
      }

      const em = getEm();
      const program = await em.findOne(Program, {
        sourceType: sourceTypeParsed,
        externalSourceId,
        externalKey,
      });

      if (isNil(program)) {
        return res.status(404).send();
      }

      return res.send(program.toDTO());
    },
  );

  fastify.post(
    '/programming/batch/lookup',
    {
      schema: {
        operationId: 'batchGetProgramsByExternalIds',
        body: BatchLookupExternalProgrammingSchema,
        response: {
          200: z.array(ProgramSchema.partial().required({ id: true })),
        },
      },
    },
    async (req, res) => {
      const em = getEm();
      const allIds = [...req.body.externalIds];
      const results = await mapAsyncSeq(
        chunk(allIds, 25),
        undefined,
        async (idChunk) => {
          return await reduce(
            idChunk,
            (acc, [ps, es, ek]) => {
              return acc.orWhere({
                sourceType: programSourceTypeFromString(ps)!,
                externalSourceId: es,
                externalKey: ek,
              });
            },
            em.qb(Program).select('uuid'),
          );
        },
      );
      const all = results.reduce((prev, next) => [...prev, ...next], []);

      return res.send(all.map((program) => program.toDTO()));
    },
  );
};
