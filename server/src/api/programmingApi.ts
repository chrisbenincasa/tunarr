import { getDatabase } from '@/db/DBAccess.js';
import { ProgramExternalIdType } from '@/db/custom_types/ProgramExternalIdType.js';
import { MediaSource } from '@/db/schema/MediaSource.js';
import { ProgramType } from '@/db/schema/Program.js';
import { ProgramGroupingType } from '@/db/schema/ProgramGrouping.js';
import { JellyfinApiClient } from '@/external/jellyfin/JellyfinApiClient.js';
import { PlexApiClient } from '@/external/plex/PlexApiClient.js';
import { TruthyQueryParam } from '@/types/schemas.js';
import { RouterPluginAsyncCallback } from '@/types/serverType.js';
import { ifDefined, isNonEmptyString } from '@/util/index.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { BasicIdParamSchema } from '@tunarr/types/api';
import { ContentProgramSchema } from '@tunarr/types/schemas';
import axios, { AxiosHeaders, isAxiosError } from 'axios';
import { HttpHeader } from 'fastify/types/utils.js';
import { jsonArrayFrom } from 'kysely/helpers/sqlite';
import {
  every,
  find,
  first,
  isNil,
  isNull,
  isUndefined,
  map,
  omitBy,
  values,
} from 'lodash-es';
import stream from 'stream';
import z from 'zod';
import {
  ProgramSourceType,
  programSourceTypeFromString,
} from '../db/custom_types/ProgramSourceType.ts';
import {
  AllProgramFields,
  AllProgramGroupingFields,
  selectProgramsBuilder,
} from '../db/programQueryHelpers.ts';

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
  const logger = LoggerFactory.child({
    caller: import.meta,
    className: 'ProgrammingApi',
  });

  fastify.get(
    '/programs/:id',
    {
      schema: {
        params: BasicIdParamSchema,
      },
    },
    async (req, res) => {
      return res.send(
        req.serverCtx.programConverter.programDaoToContentProgram(
          await selectProgramsBuilder({
            joins: {
              tvSeason: true,
              tvShow: true,
              trackAlbum: true,
              trackArtist: true,
            },
          })
            .where('uuid', '=', req.params.id)
            .executeTakeFirstOrThrow(),
          [],
        ),
      );
    },
  );

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
          proxy: TruthyQueryParam.default(false),
          useShowPoster: TruthyQueryParam.default(false),
        }),
      },
    },
    async (req, res) => {
      const xmltvSettings = req.serverCtx.settings.xmlTvSettings();
      // Unfortunately these don't have unique ID spaces, since we have separate tables
      // so we'll just prefer program matches over group matches and hope all works out
      // Alternatively, we could introduce a query param to narrow this down...

      const [program, grouping] = await Promise.all([
        // em
        //   .repo(Program)
        //   .findOne(
        //     { uuid: req.params.id },
        //     { populate: ['album.externalRefs', 'tvShow.externalRefs'] },
        //   ),
        req.serverCtx.programDB.getProgramById(req.params.id),
        req.serverCtx.programDB.getProgramGrouping(req.params.id),
        // em
        //   .repo(ProgramGrouping)
        //   .findOne({ uuid: req.params.id }, { populate: ['externalRefs'] }),
      ]);
      // const program = await em.repo(Program).findOne({ uuid: req.params.id });
      if (isNil(program) && isNil(grouping)) {
        return res.status(404).send();
      }

      const handleResult = async (mediaSource: MediaSource, result: string) => {
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
                'Error retrieving thumb from %s at url: %s. Status: 404',
                mediaSource.type,
                result.replaceAll(mediaSource.accessToken, 'REDACTED_TOKEN'),
              );
              return res.status(404).send();
            }
            throw e;
          }
        }

        return res.redirect(result, 302).send();
      };

      if (!isNil(program)) {
        const mediaSource = await req.serverCtx.mediaSourceDB.getByExternalId(
          program.sourceType,
          program.externalSourceId,
        );

        if (isNil(mediaSource)) {
          return res.status(404).send();
        }

        let keyToUse = program.externalKey;
        if (program.type === ProgramType.Track && !isNil(program.albumUuid)) {
          const albumExternalIds = await req.serverCtx.programDB
            .getProgramGrouping(program.albumUuid)
            .then((album) => album?.externalIds);
          ifDefined(
            find(
              albumExternalIds,
              (ref) =>
                ref.sourceType === program.sourceType &&
                ref.externalSourceId === program.externalSourceId,
            ),
            (ref) => {
              keyToUse = ref.externalKey;
            },
          );
        } else if (
          (req.query.useShowPoster || xmltvSettings.useShowPoster) &&
          program.type === ProgramType.Episode &&
          !isNil(program.tvShowUuid)
        ) {
          const showExternalIds = await req.serverCtx.programDB
            .getProgramGrouping(program.tvShowUuid)
            .then((show) => show?.externalIds);
          ifDefined(
            find(
              showExternalIds,
              (ref) =>
                ref.sourceType === program.sourceType &&
                ref.externalSourceId === program.externalSourceId,
            ),
            (ref) => {
              keyToUse = ref.externalKey;
            },
          );
        }

        if (isNil(keyToUse)) {
          return res.status(500).send();
        }

        switch (program.sourceType) {
          case ProgramSourceType.PLEX: {
            return handleResult(
              mediaSource,
              PlexApiClient.getThumbUrl({
                uri: mediaSource.uri,
                itemKey: keyToUse,
                accessToken: mediaSource.accessToken,
                height: req.query.height,
                width: req.query.width,
                upscale: req.query.upscale.toString(),
              }),
            );
          }
          case ProgramSourceType.JELLYFIN:
            return handleResult(
              mediaSource,
              JellyfinApiClient.getThumbUrl({
                uri: mediaSource.uri,
                itemKey: keyToUse,
                accessToken: mediaSource.accessToken,
                height: req.query.height,
                width: req.query.width,
                upscale: req.query.upscale.toString(),
              }),
            );
          default:
            return res.status(405).send();
        }
      } else {
        // We can assume that we have a grouping here...
        // We only support Plex now
        const source = find(
          grouping!.externalIds,
          (ref) =>
            ref.sourceType === ProgramExternalIdType.PLEX ||
            ref.sourceType === ProgramExternalIdType.JELLYFIN,
        );

        if (isNil(source)) {
          return res.status(500).send();
        } else if (!isNonEmptyString(source.externalSourceId)) {
          return res.status(500).send();
        }

        const mediaSource = await req.serverCtx.mediaSourceDB.getByExternalId(
          // This was asserted above
          source.sourceType as 'plex' | 'jellyfin',
          source.externalSourceId,
        );

        if (isNil(mediaSource)) {
          return res.status(404).send();
        }

        switch (source.sourceType) {
          case ProgramExternalIdType.PLEX:
            return handleResult(
              mediaSource,
              PlexApiClient.getThumbUrl({
                uri: mediaSource.uri,
                itemKey: source.externalSourceId,
                accessToken: mediaSource.accessToken,
                height: req.query.height,
                width: req.query.width,
                upscale: req.query.upscale.toString(),
              }),
            );
          case ProgramExternalIdType.JELLYFIN:
            return handleResult(
              mediaSource,
              JellyfinApiClient.getThumbUrl({
                uri: mediaSource.uri,
                itemKey: source.externalSourceId,
                accessToken: mediaSource.accessToken,
                height: req.query.height,
                width: req.query.width,
                upscale: req.query.upscale.toString(),
              }),
            );
          default:
            // Impossible
            return res.status(500).send();
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
      const program = await req.serverCtx.programDB.getProgramById(
        req.params.id,
      );
      if (isNil(program)) {
        return res.status(404).send();
      }

      const mediaSources = await req.serverCtx.mediaSourceDB.getAll();

      const externalId = program.externalIds.find(
        (eid) =>
          eid.sourceType === ProgramExternalIdType.JELLYFIN ||
          eid.sourceType === ProgramExternalIdType.PLEX,
      );

      if (!externalId) {
        return res.status(404).send();
      }

      const server = find(
        mediaSources,
        (source) =>
          source.uuid === externalId.externalSourceId ||
          source.name === externalId.externalSourceId,
      );

      if (isNil(server)) {
        return res.status(404).send();
      }

      switch (externalId.sourceType) {
        case ProgramExternalIdType.PLEX: {
          if (isNil(server.clientIdentifier)) {
            return res.status(404).send();
          }

          const url = `${server.uri}/web/index.html#!/server/${
            server.clientIdentifier
          }/details?key=${encodeURIComponent(
            `/library/metadata/${program.externalKey}`,
          )}&X-Plex-Token=${server.accessToken}`;

          if (!req.query.forward) {
            return res.send({ url });
          }

          return res.redirect(url, 302).send();
        }
        case ProgramExternalIdType.JELLYFIN: {
          const url = `${server.uri}/web/#/details?id=${externalId.externalKey}`;
          if (!req.query.forward) {
            return res.send({ url });
          }

          return res.redirect(url, 302).send();
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

  fastify.get(
    '/programming/shows/:id',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        querystring: z.object({
          includeEpisodes: TruthyQueryParam.default(false),
        }),
      },
    },
    async (req, res) => {
      const result = await getDatabase()
        .selectFrom('programGrouping')
        .selectAll()
        .where('programGrouping.uuid', '=', req.params.id)
        .where('programGrouping.type', '=', ProgramGroupingType.Show)
        .select((eb) => {
          return jsonArrayFrom(
            eb
              .selectFrom('programGrouping as seasons')
              .select(AllProgramGroupingFields)
              .select((eb2) =>
                jsonArrayFrom(
                  eb2
                    .selectFrom('program')
                    .select(AllProgramFields)
                    .whereRef('program.seasonUuid', '=', 'seasons.uuid'),
                ).as('episodes'),
              )
              // .select(eb => eb.fn('concat', ['/programming/seasons/:id/', '']))
              .whereRef('seasons.showUuid', '=', 'programGrouping.uuid')
              .where('seasons.type', '=', ProgramGroupingType.Season)
              .orderBy('seasons.index asc'),
          ).as('seasons');
        })
        .$if(req.query.includeEpisodes, (qb) =>
          qb.select((eb) =>
            jsonArrayFrom(
              eb
                .selectFrom('program')
                .select(AllProgramFields)
                .whereRef('program.tvShowUuid', '=', 'programGrouping.uuid'),
            ).as('episodes'),
          ),
        )
        .orderBy('programGrouping.index asc')
        .executeTakeFirstOrThrow();
      return res.send({
        ...result,
        seasons: map(result.seasons, (season) => ({
          ...season,
          link: `/api/programming/seasons/${season.uuid}`,
        })),
      });
    },
  );

  fastify.get(
    '/programming/seasons/:id',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
      },
    },
    async (req, res) => {
      const result = await getDatabase()
        .selectFrom('programGrouping')
        .selectAll()
        .where('programGrouping.uuid', '=', req.params.id)
        .where('programGrouping.type', '=', ProgramGroupingType.Season)
        .select((eb) => {
          return jsonArrayFrom(
            eb
              .selectFrom('programGrouping as seasons')
              .select(AllProgramGroupingFields)
              // .select(eb => eb.fn('concat', ['/programming/seasons/:id/', '']))
              .whereRef('seasons.showUuid', '=', 'programGrouping.uuid')
              .where('seasons.type', '=', ProgramGroupingType.Season)
              .orderBy('seasons.index asc'),
          ).as('seasons');
        })
        .orderBy('programGrouping.index asc')
        .executeTakeFirstOrThrow();
      return res.send(result);
    },
  );

  fastify.get(
    '/programming/shows/:id/seasons',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
      },
    },
    async (req, res) => {
      const result = await getDatabase()
        .selectFrom('programGrouping')
        .selectAll()
        .where('programGrouping.showUuid', '=', req.params.id)
        .where('programGrouping.type', '=', ProgramGroupingType.Season)
        .orderBy('programGrouping.index asc')
        .execute();
      return res.send(result);
    },
  );
};
