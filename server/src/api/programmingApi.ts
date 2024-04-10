import { BasicIdParamSchema } from '@tunarr/types/api';
import { ContentProgramSchema } from '@tunarr/types/schemas';
import axios, { AxiosHeaders, isAxiosError } from 'axios';
import { HttpHeader } from 'fastify/types/utils.js';
import {
  every,
  find,
  first,
  isNil,
  isNull,
  isUndefined,
  omitBy,
  values,
} from 'lodash-es';
import stream from 'stream';
import z from 'zod';
import {
  ProgramSourceType,
  programSourceTypeFromString,
} from '../dao/custom_types/ProgramSourceType.js';
import { getEm } from '../dao/dataSource.js';
import { Program } from '../dao/entities/Program.js';
import { Plex } from '../plex.js';
import { TruthyQueryParam } from '../types/schemas.js';
import { RouterPluginAsyncCallback } from '../types/serverType.js';
import createLogger from '../logger.js';

const logger = createLogger(import.meta);

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
  // Image proxy for a program based on its source. Only works for persisted programs
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
          proxy: TruthyQueryParam.default('0'),
        }),
      },
    },
    async (req, res) => {
      const em = getEm();
      const program = await em.repo(Program).findOne({ uuid: req.params.id });
      if (isNil(program)) {
        return res.status(404).send();
      }

      switch (program.sourceType) {
        case ProgramSourceType.PLEX: {
          if (isNil(program.plexRatingKey)) {
            return res.status(500).send();
          }

          const server = await req.serverCtx.plexServerDB.getByExternalid(
            program.externalSourceId,
          );

          if (isNil(server)) {
            return res.status(404).send();
          }

          const result = Plex.getThumbUrl({
            uri: server.uri,
            itemKey: program.plexRatingKey,
            accessToken: server.accessToken,
            height: req.query.height,
            width: req.query.width,
            upscale: req.query.upscale.toString(),
          });

          if (req.query.proxy) {
            try {
              const proxyRes = await axios.request<stream.Readable>({
                url: result,
                responseType: 'stream',
              });

              let headers: Partial<Record<HttpHeader, string | string[]>>;
              if (proxyRes.headers instanceof AxiosHeaders) {
                headers = {
                  ...proxyRes.headers,
                };
              } else {
                headers = { ...omitBy(proxyRes.headers, isNull) };
              }

              return res
                .status(proxyRes.status)
                .headers(headers)
                .send(proxyRes.data);
            } catch (e) {
              if (isAxiosError(e) && e.response?.status === 404) {
                logger.error(
                  'Error retrieving thumb from Plex at url: %s. Status: 404',
                  result,
                );
                return res.status(404).send();
              }
              throw e;
            }
          }

          return res.redirect(302, result).send();
        }
        default:
          return res.status(405).send();
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
          200: ContentProgramSchema,
          400: z.object({ message: z.string() }),
          404: z.void(),
        },
      },
    },
    async (req, res) => {
      const [sourceType, ,] = req.params.externalId;
      const sourceTypeParsed = programSourceTypeFromString(sourceType);
      if (isUndefined(sourceTypeParsed)) {
        return res
          .status(400)
          .send({ message: 'Invalid sourceType ' + sourceType });
      }

      const result = await req.serverCtx.programDB.lookupByExternalIds(
        new Set([req.params.externalId]),
      );
      const program = first(values(result));

      if (isNil(program)) {
        return res.status(404).send();
      }

      return res.send(program);
    },
  );

  fastify.post(
    '/programming/batch/lookup',
    {
      schema: {
        operationId: 'batchGetProgramsByExternalIds',
        body: BatchLookupExternalProgrammingSchema,
        response: {
          200: z.record(ContentProgramSchema),
        },
      },
    },
    async (req, res) => {
      return res.send(
        await req.serverCtx.programDB.lookupByExternalIds(req.body.externalIds),
      );
    },
  );
};
