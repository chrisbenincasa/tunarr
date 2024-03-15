import { BasicIdParamSchema } from '@tunarr/types/api';
import { ProgramSchema } from '@tunarr/types/schemas';
import { chunk, every, find, isNil, isUndefined, reduce } from 'lodash-es';
import z from 'zod';
import { getEm } from '../../dao/dataSource.js';
import {
  Program,
  ProgramSourceType,
  programSourceTypeFromString,
} from '../../dao/entities/Program.js';
import { RouterPluginAsyncCallback } from '../../types/serverType.js';
import { flatMapAsyncSeq, groupByFunc } from '../../util.js';

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
  // Image proxy for a program based on its source
  fastify.get(
    '/programs/:id/thumb',
    {
      schema: {
        params: BasicIdParamSchema,
        querystring: z.object({
          width: z.number().optional(),
          height: z.number().optional(),
          upscale: z
            .boolean()
            .optional()
            .default(true)
            .transform((p) => (p ? 1 : 0)),
        }),
        response: {
          302: z.void(),
        },
      },
    },
    async (req, res) => {
      const em = getEm();
      const program = await em.repo(Program).findOne({ uuid: req.params.id });
      if (isNil(program)) {
        return res.status(404).send();
      }

      const plexServers = await req.serverCtx.plexServerDB.getAll();

      switch (program.sourceType) {
        case ProgramSourceType.PLEX: {
          if (isNil(program.plexRatingKey)) {
            return res.status(500).send();
          }

          const server = find(plexServers, { name: program.externalSourceId });
          if (isNil(server)) {
            return res.status(404).send();
          }

          let thumbUrl: URL;
          const key = `/library/metadata/${program.plexRatingKey}/thumb?X-Plex-Token=${server.accessToken}`;
          if (isUndefined(req.query.height) || isUndefined(req.query.width)) {
            thumbUrl = new URL(`${server.uri}${key}`);
          } else {
            thumbUrl = new URL(`${server.uri}/photo/:/transcode`);
            thumbUrl.searchParams.append('url', key);
            thumbUrl.searchParams.append('X-Plex-Token', server.accessToken);
            thumbUrl.searchParams.append('width', req.query.width.toString());
            thumbUrl.searchParams.append('height', req.query.height.toString());
            thumbUrl.searchParams.append(
              'upscale',
              req.query.upscale.toString(),
            );
          }

          return res.redirect(302, thumbUrl.toString()).send();
        }
      }
    },
  );

  fastify.get(
    '/programs/:id/external-link',
    {
      schema: {
        params: BasicIdParamSchema,
        querystring: z.object({
          forward: z.coerce.boolean().default(true),
        }),
        response: {
          200: z.object({ url: z.string() }),
          302: z.void(),
          404: z.void(),
        },
      },
    },
    async (req, res) => {
      const em = getEm();
      const program = await em.repo(Program).findOne({ uuid: req.params.id });
      if (isNil(program)) {
        return res.status(404).send();
      }

      const plexServers = await req.serverCtx.plexServerDB.getAll();

      switch (program.sourceType) {
        case ProgramSourceType.PLEX: {
          if (isNil(program.plexRatingKey)) {
            return res.status(500).send();
          }

          const server = find(plexServers, { name: program.externalSourceId });
          if (isNil(server) || isNil(server.clientIdentifier)) {
            return res.status(404).send();
          }

          const url = `${server.uri}/web/index.html#!/server/${
            server.clientIdentifier
          }/details?key=${encodeURIComponent(
            `/library/metadata/${program.plexRatingKey}`,
          )}&X-Plex-Token=${server.accessToken}`;

          if (!req.query.forward) {
            return res.send({ url });
          }

          return res.redirect(302, url).send();
        }
      }
    },
  );

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
          200: z.record(ProgramSchema.partial().required({ id: true })),
        },
      },
    },
    async (req, res) => {
      const em = getEm();
      const allIds = [...req.body.externalIds];
      const results = await flatMapAsyncSeq(
        chunk(allIds, 25),
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
            em
              .qb(Program)
              .select([
                'uuid',
                'sourceType',
                'externalSourceId',
                'externalKey',
              ]),
          );
        },
      );
      const all = groupByFunc(
        results,
        (r) => r.uniqueId(),
        (r) => r.toDTO(),
      );

      return res.send(all);
    },
  );
};
