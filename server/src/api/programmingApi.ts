import type { MediaSourceOrm } from '@/db/schema/MediaSource.js';
import { ProgramType } from '@/db/schema/Program.js';
import { ProgramGroupingType } from '@/db/schema/ProgramGrouping.js';
import { JellyfinApiClient } from '@/external/jellyfin/JellyfinApiClient.js';
import { PlexApiClient } from '@/external/plex/PlexApiClient.js';
import { PagingParams, TruthyQueryParam } from '@/types/schemas.js';
import type { RouterPluginAsyncCallback } from '@/types/serverType.js';
import {
  groupByUniq,
  groupByUniqAndMap,
  ifDefined,
  inConstArr,
  isHttpUrl,
  isNonEmptyString,
} from '@/util/index.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { seq } from '@tunarr/shared/util';
import type { Episode, MusicAlbum, MusicTrack, Season } from '@tunarr/types';
import { tag } from '@tunarr/types';
import {
  BasicIdParamSchema,
  ProgramChildrenResult,
  ProgramSearchRequest,
  ProgramSearchResponse,
  SearchFilterQuerySchema,
} from '@tunarr/types/api';
import {
  ContentProgramSchema,
  ProgramGroupingSchema,
  TerminalProgramSchema,
} from '@tunarr/types/schemas';
import axios, { AxiosHeaders, isAxiosError } from 'axios';
import type { HttpHeader } from 'fastify/types/utils.js';
import { jsonArrayFrom } from 'kysely/helpers/sqlite';
import {
  compact,
  every,
  find,
  first,
  head,
  isNil,
  isNull,
  isUndefined,
  map,
  omitBy,
  trimStart,
  values,
} from 'lodash-es';
import type stream from 'node:stream';
import z from 'zod/v4';
import { container } from '../container.ts';
import { programSourceTypeFromString } from '../db/custom_types/ProgramSourceType.ts';
import {
  AllProgramFields,
  AllProgramGroupingFields,
} from '../db/programQueryHelpers.ts';
import type { Artwork } from '../db/schema/Artwork.ts';
import { ArtworkTypes } from '../db/schema/Artwork.ts';
import type { RemoteSourceType } from '../db/schema/base.js';
import { RemoteSourceTypes, type MediaSourceId } from '../db/schema/base.js';

import { match } from 'ts-pattern';
import { GetProgramGroupingById } from '../commands/GetProgramGroupingById.ts';
import { MaterializeProgramGroupings } from '../commands/MaterializeProgramGroupings.ts';
import { MaterializeProgramsCommand } from '../commands/MaterializeProgramsCommand.ts';
import type { DrizzleDBAccess } from '../db/schema/index.ts';
import { globalOptions } from '../globals.ts';
import { FfprobeStreamDetails } from '../stream/FfprobeStreamDetails.ts';
import { ExternalStreamDetailsFetcherFactory } from '../stream/StreamDetailsFetcher.ts';
import { KEYS } from '../types/inject.ts';
import type { Maybe } from '../types/util.ts';

import { SearchProgramsCommand } from '../commands/SearchProgramsCommand.ts';
import { EmbyApiClient } from '../external/emby/EmbyApiClient.ts';

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

  fastify.post(
    '/programs/search',
    {
      schema: {
        body: ProgramSearchRequest,
        response: {
          200: ProgramSearchResponse,
        },
      },
    },
    async (req, res) => {
      const result = await container
        .get<SearchProgramsCommand>(SearchProgramsCommand)
        .execute(req.body);
      return res.send(result);
    },
  );

  fastify.get(
    '/programs/:id/descendants',
    {
      schema: {
        params: z.object({
          id: z.uuid(),
        }),
        response: {
          200: z.array(ContentProgramSchema),
          404: z.void(),
        },
      },
    },
    async (req, res) => {
      const grouping = await req.serverCtx.programDB.getProgramGrouping(
        req.params.id,
      );
      if (isNil(grouping)) {
        const program = await req.serverCtx.programDB.getProgramById(
          req.params.id,
        );
        if (program) {
          return res.send(
            compact([
              req.serverCtx.programConverter.programOrmToContentProgram(
                program,
              ),
            ]),
          );
        }

        return res.status(404).send();
      }

      const programs =
        await req.serverCtx.programDB.getProgramGroupingDescendants(
          req.params.id,
          grouping.type,
        );

      const apiPrograms = seq.collect(programs, (program) =>
        req.serverCtx.programConverter.programOrmToContentProgram(program),
      );

      return res.send(apiPrograms);
    },
  );

  fastify.get(
    '/programs/facets/:facetName',
    {
      schema: {
        params: z.object({
          facetName: z.string(),
        }),
        querystring: z.object({
          facetQuery: z.string().optional(),
          mediaSourceId: z.uuid().optional(),
          libraryId: z.uuid().optional(),
        }),
        response: {
          200: z.object({
            facetValues: z.record(z.string(), z.number()),
          }),
        },
      },
    },
    async (req, res) => {
      const facetResult = await req.serverCtx.searchService.facetSearch(
        'programs',
        {
          facetQuery: req.query.facetQuery,
          facetName: req.params.facetName,
          mediaSourceId: req.query.mediaSourceId,
          libraryId: req.query.libraryId,
        },
      );

      return res.send({
        facetValues: groupByUniqAndMap(
          facetResult.facetHits,
          'value',
          (hit) => hit.count,
        ),
      });
    },
  );

  fastify.post(
    '/programs/facets/:facetName',
    {
      schema: {
        params: z.object({
          facetName: z.string(),
        }),
        querystring: z.object({
          facetQuery: z.string().optional(),
          libraryId: z.string().uuid().optional(),
        }),
        body: z.object({
          filter: SearchFilterQuerySchema.optional(),
        }),
        response: {
          200: z.object({
            facetValues: z.record(z.string(), z.number()),
          }),
        },
      },
    },
    async (req, res) => {
      const facetResult = await req.serverCtx.searchService.facetSearch(
        'programs',
        {
          facetQuery: req.query.facetQuery,
          facetName: req.params.facetName,
          libraryId: req.query.libraryId,
          filter: req.body.filter,
        },
      );

      return res.send({
        facetValues: groupByUniqAndMap(
          facetResult.facetHits,
          'value',
          (hit) => hit.count,
        ),
      });
    },
  );

  fastify.get(
    '/programs/:id',
    {
      schema: {
        tags: ['Programs'],
        params: BasicIdParamSchema,
        response: {
          200: TerminalProgramSchema,
          404: z.void(),
          500: z.void(),
        },
      },
    },
    async (req, res) => {
      const db = container.get<DrizzleDBAccess>(KEYS.DrizzleDB);

      const dbRes = await db.query.program.findFirst({
        where: (program, { eq }) => eq(program.uuid, req.params.id),
        with: {
          externalIds: true,
          mediaLibrary: true,
          credits: {
            with: {
              artwork: true,
            },
          },
          artwork: true,
          versions: {
            with: {
              mediaStreams: true,
              chapters: true,
              mediaFiles: true,
            },
          },
          genres: {
            with: {
              genre: true,
            },
          },
          studios: {
            with: {
              studio: true,
            },
          },
        },
      });

      if (!dbRes) {
        return res.status(404).send();
      }

      if (dbRes.mediaSourceId && dbRes.libraryId && dbRes.canonicalId) {
        const converted = head(
          await container
            .get<MaterializeProgramsCommand>(MaterializeProgramsCommand)
            .execute([dbRes]),
        );

        if (!converted) {
          return res.status(404).send();
        }

        const getGroupingDetails = container.get<GetProgramGroupingById>(
          GetProgramGroupingById,
        );

        if (converted.type === 'episode') {
          if (dbRes.seasonUuid) {
            const apiSeason = await getGroupingDetails.execute(
              dbRes.seasonUuid,
            );
            if (apiSeason?.type === 'season') {
              converted.season = apiSeason;
            }
          }
          if (dbRes.tvShowUuid) {
            const apiShow = await getGroupingDetails.execute(dbRes.tvShowUuid);
            if (apiShow?.type === 'show') {
              converted.show = apiShow;
            }
          }
        } else if (converted.type === 'track') {
          if (dbRes.albumUuid) {
            const apiAlbum = await getGroupingDetails.execute(dbRes.albumUuid);
            if (apiAlbum?.type === 'album') {
              converted.album = apiAlbum;
            }
          }
          if (dbRes.artistUuid) {
            const apiArtist = await getGroupingDetails.execute(
              dbRes.artistUuid,
            );
            if (apiArtist?.type === 'artist') {
              converted.artist = apiArtist;
            }
          }
        }

        return res.send(converted);
      }
    },
  );

  fastify.get(
    '/program_groupings/:id',
    {
      schema: {
        tags: ['Programs'],
        params: BasicIdParamSchema,
        response: {
          200: ProgramGroupingSchema,
          404: z.void(),
          500: z.void(),
        },
      },
    },
    async (req, res) => {
      const result = await container
        .get<GetProgramGroupingById>(GetProgramGroupingById)
        .execute(req.params.id, /* recursive= */ true);
      if (!result) {
        return res.status(404).send();
      }

      return res.send(result);
    },
  );

  fastify.get(
    '/programs/:id/artwork/:artworkType',
    {
      schema: {
        produces: ['image/jpeg', 'image/png'],
        params: z.object({
          id: z.uuid(),
          // TODO: use API schema
          artworkType: z.enum(ArtworkTypes),
        }),
        response: {
          200: z.any(),
          404: z.void(),
        },
      },
    },
    async (req, res) => {
      let program: Maybe<{
        artwork?: Artwork[];
        mediaSourceId: MediaSourceId | null;
      }> = await req.serverCtx.programDB.getProgramById(req.params.id);

      if (!program) {
        program = await req.serverCtx.programDB.getProgramGrouping(
          req.params.id,
        );
        if (!program) {
          return res.status(404).send();
        }
      }

      const art = program.artwork?.find(
        (art) => art.artworkType === req.params.artworkType,
      );

      if (!art) {
        return res.status(404).send();
      }

      if (art.cachePath) {
        const path = req.serverCtx.imageCache.getImagePath(
          art.cachePath,
          art.artworkType,
        );

        return res.sendFile(
          trimStart(path.replace(globalOptions().databaseDirectory, ''), '/'),
          { contentType: true },
        );
      } else if (isHttpUrl(art.sourcePath)) {
        if (!program.mediaSourceId) {
          return res.status(404).send();
        }
        const mediaSource = await req.serverCtx.mediaSourceDB.getById(
          program.mediaSourceId,
        );

        const url = URL.parse(art.sourcePath)!;
        if (mediaSource) {
          switch (mediaSource.type) {
            case 'plex':
              url?.searchParams.append('X-Plex-Token', mediaSource.accessToken);
              break;
            case 'jellyfin':
            case 'emby':
              url?.searchParams.append('X-Emby-Token', mediaSource.accessToken);
              break;
            case 'local':
              break;
          }
        }

        return res.redirect(url.toString());
      } else {
        return res.sendFile(art.sourcePath);
      }
    },
  );

  fastify.get(
    '/programs/:id/stream_details',
    {
      schema: {
        tags: ['Programs'],
        params: BasicIdParamSchema,
      },
    },
    async (req, res) => {
      const program = await req.serverCtx.programDB.getProgramById(
        req.params.id,
      );

      if (!program) {
        return res.status(404).send('Program not found');
      } else if (!program.mediaSourceId) {
        return res
          .status(404)
          .send('Program has no associated media source ID');
      }
      const mediaSourceId = program.mediaSourceId;

      const server = await req.serverCtx.mediaSourceDB.findByType(
        program.sourceType,
        program.mediaSourceId,
      );

      if (!server) {
        return res
          .status(404)
          .send(
            `Media source (ID = ${program.mediaSourceId ?? program.externalSourceId}) not found`,
          );
      }

      const ffprobe = container.get<FfprobeStreamDetails>(FfprobeStreamDetails);

      const result = await container
        .get<ExternalStreamDetailsFetcherFactory>(
          ExternalStreamDetailsFetcherFactory,
        )
        .getStream({
          lineupItem: { ...program, mediaSourceId },
          server,
        });

      if (result.isFailure()) {
        logger.error(result.error);
        return res.status(500).send(result.error.message);
      }

      const { streamDetails, streamSource } = result.get();

      const ffprobeDetails = (
        await ffprobe.getStream({
          path: streamSource.path,
        })
      ).orUndefined();

      if (streamDetails.placeholderImage?.type === 'http') {
        streamDetails.placeholderImage.redact();
      }

      if (streamSource.type === 'http') {
        streamSource.redact();
      }
      if (ffprobeDetails?.streamSource.type === 'http') {
        ffprobeDetails.streamSource.redact();
      }

      return res.send({
        details: result.get(),
        ffprobeDetails,
      });
    },
  );

  fastify.get(
    '/programs/:id/children',
    {
      schema: {
        tags: ['Programs'],
        params: BasicIdParamSchema,
        querystring: z.object({
          ...PagingParams.shape,
          channelId: z.string().optional(),
        }),
        response: {
          200: ProgramChildrenResult,
          400: z.void(),
          404: z.void(),
        },
      },
    },
    async (req, res) => {
      const grouping = await req.serverCtx.programDB.getProgramGrouping(
        req.params.id,
      );
      if (!grouping) {
        return res.status(404).send();
      }

      if (grouping.type === 'album' || grouping.type === 'season') {
        const { total, results } = await req.serverCtx.programDB.getChildren(
          req.params.id,
          grouping.type,
          req.query,
        );
        // Dealing with terminal programs.
        const materialized = await container
          .get<MaterializeProgramsCommand>(MaterializeProgramsCommand)
          .execute(results);
        const result = match(grouping.type)
          .returnType<ProgramChildrenResult>()
          .with('album', () => ({
            total,
            result: {
              type: 'track',
              programs: materialized.filter(
                (p): p is MusicTrack => p.type === 'track',
              ),
            },
            size: materialized.length,
          }))
          .with('season', () => ({
            total,
            result: {
              type: 'episode',
              programs: materialized.filter(
                (p): p is Episode => p.type === 'episode',
              ),
            },
            size: materialized.length,
          }))
          .exhaustive();
        return res.send(result);
      } else {
        const { total, results } = await req.serverCtx.programDB.getChildren(
          req.params.id,
          grouping.type,
          req.query,
        );
        // Dealing with terminal programs.
        const materialized = await container
          .get<MaterializeProgramGroupings>(MaterializeProgramGroupings)
          .execute(results);
        const result = match(grouping.type)
          .returnType<ProgramChildrenResult>()
          .with('artist', () => ({
            total,
            result: {
              type: 'album',
              programs: materialized.filter(
                (p): p is MusicAlbum => p.type === 'album',
              ),
            },
            size: materialized.length,
          }))
          .with('show', () => ({
            total,
            result: {
              type: 'season',
              programs: materialized.filter(
                (p): p is Season => p.type === 'season',
              ),
            },
            size: materialized.length,
          }))
          .exhaustive();
        return res.send(result);
      }
    },
  );

  // Image proxy for a program based on its source. Only works for persisted programs
  fastify.get(
    '/programs/:id/thumb',
    {
      schema: {
        tags: ['Programs'],
        params: BasicIdParamSchema,
        querystring: z.object({
          width: z.number().optional(),
          height: z.number().optional(),
          upscale: z
            .boolean()
            .optional()
            .default(true)
            .transform((p) => (p ? 1 : 0)),
          method: z.enum(['proxy', 'redirect']).catch('proxy'),
          useShowPoster: TruthyQueryParam.default(false),
          type: z.enum(['program', 'grouping']).catch('program'),
        }),
      },
    },
    async (req, res) => {
      const xmltvSettings = req.serverCtx.settings.xmlTvSettings();
      // Unfortunately these don't have unique ID spaces, since we have separate tables
      // so we'll just prefer program matches over group matches and hope all works out
      // Alternatively, we could introduce a query param to narrow this down...

      const [program, grouping] = await Promise.all([
        req.serverCtx.programDB.getProgramById(req.params.id),
        req.serverCtx.programDB.getProgramGrouping(req.params.id),
      ]);

      if (isNil(program) && isNil(grouping)) {
        return res.status(404).send('ID not found');
      }

      const handleResult = async (
        mediaSource: MediaSourceOrm,
        result: string,
      ) => {
        if (req.query.method === 'proxy') {
          try {
            logger.debug('Proxying response to %s', result);
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

      if (!isNil(program?.mediaSourceId)) {
        const mediaSource = await req.serverCtx.mediaSourceDB.findByType(
          program.sourceType,
          program.mediaSourceId,
        );

        if (isNil(mediaSource)) {
          logger.error('No media source: %O', program);
          return res
            .status(404)
            .send(`No media source for id/name ${program.externalSourceId}`);
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
                (ref.mediaSourceId === program.mediaSourceId ||
                  ref.externalSourceId === program.externalSourceId),
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
                (ref.mediaSourceId === program.mediaSourceId ||
                  ref.externalSourceId === program.externalSourceId),
            ),
            (ref) => {
              keyToUse = ref.externalKey;
            },
          );
        }

        if (isNil(keyToUse)) {
          return res.status(500).send();
        }

        switch (mediaSource.type) {
          case 'plex': {
            return handleResult(
              mediaSource,
              PlexApiClient.getImageUrl({
                uri: mediaSource.uri,
                itemKey: keyToUse,
                accessToken: mediaSource.accessToken,
                height: req.query.height,
                width: req.query.width,
                upscale: req.query.upscale.toString(),
                imageType: 'poster',
              }),
            );
          }
          case 'jellyfin':
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
          case 'emby':
            return handleResult(
              mediaSource,
              EmbyApiClient.getThumbUrl({
                uri: mediaSource.uri,
                itemKey: keyToUse,
                accessToken: mediaSource.accessToken,
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
          (ref) => ref.sourceType === 'plex' || ref.sourceType === 'jellyfin',
        );

        if (isNil(source)) {
          return res.status(500).send();
        } else if (!isNonEmptyString(source.externalSourceId)) {
          return res.status(500).send();
        }

        const mediaSource = await (isNonEmptyString(source.mediaSourceId)
          ? req.serverCtx.mediaSourceDB.getById(source.mediaSourceId)
          : null);

        if (isNil(mediaSource)) {
          return res
            .status(404)
            .send(
              `Could not find media source with id ${source.externalSourceId}`,
            );
        }

        switch (mediaSource.type) {
          case 'plex':
            return handleResult(
              mediaSource,
              PlexApiClient.getImageUrl({
                uri: mediaSource.uri,
                itemKey: source.externalKey,
                accessToken: mediaSource.accessToken,
                height: req.query.height,
                width: req.query.width,
                upscale: req.query.upscale.toString(),
                imageType: 'poster',
              }),
            );
          case 'jellyfin':
            return handleResult(
              mediaSource,
              JellyfinApiClient.getThumbUrl({
                uri: mediaSource.uri,
                itemKey: source.externalKey,
                accessToken: mediaSource.accessToken,
                height: req.query.height,
                width: req.query.width,
                upscale: req.query.upscale.toString(),
              }),
            );
          case 'emby':
            return handleResult(
              mediaSource,
              EmbyApiClient.getThumbUrl({
                uri: mediaSource.uri,
                itemKey: source.externalKey,
                accessToken: mediaSource.accessToken,
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
        tags: ['Programs'],
        params: BasicIdParamSchema,
        querystring: z.object({
          forward: z.coerce.boolean().default(true),
        }),
        response: {
          200: z.object({ url: z.string() }),
          302: z.void(),
          404: z.void(),
          405: z.void(),
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
        (eid) => eid.sourceType === 'jellyfin' || eid.sourceType === 'plex',
      );

      if (!externalId) {
        return res.status(404).send();
      }

      const server = find(
        mediaSources,
        (source) =>
          source.uuid === externalId.mediaSourceId ||
          source.name === externalId.externalSourceId,
      );

      if (isNil(server)) {
        return res.status(404).send();
      }

      switch (externalId.sourceType) {
        case 'plex': {
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
        case 'jellyfin': {
          const url = `${server.uri}/web/#/details?id=${externalId.externalKey}`;
          if (!req.query.forward) {
            return res.send({ url });
          }

          return res.redirect(url, 302).send();
        }
        default:
          return res.status(405).send();
      }
    },
  );

  fastify.get(
    '/programming/:externalId',
    {
      schema: {
        tags: ['Programs'],
        operationId: 'getProgramByExternalId',
        params: LookupExternalProgrammingSchema,
        response: {
          200: ContentProgramSchema,
          400: z.object({ message: z.string() }),
          404: z.void(),
          500: z.string(),
        },
      },
    },
    async (req, res) => {
      const [sourceType, rawServerId, id] = req.params.externalId;
      if (!inConstArr(RemoteSourceTypes, sourceType)) {
        return res
          .status(400)
          .send({ message: 'Invalid sourceType ' + sourceType });
      }

      const result = await req.serverCtx.programDB.lookupByExternalIds(
        new Set([[sourceType as RemoteSourceType, tag(rawServerId), id]]),
      );
      const program = first(values(result));

      if (isNil(program)) {
        return res.status(404).send();
      }

      const converted =
        req.serverCtx.programConverter.programOrmToContentProgram(program);

      if (!converted) {
        return res
          .status(500)
          .send(
            'Could not convert program. It might be missing a mediaSourceId',
          );
      }

      return res.send(converted);
    },
  );

  fastify.post(
    '/programming/batch/lookup',
    {
      schema: {
        tags: ['Programs'],
        operationId: 'batchGetProgramsByExternalIds',
        body: BatchLookupExternalProgrammingSchema,
        response: {
          200: z.record(z.string(), ContentProgramSchema),
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
      const results = await req.serverCtx.programDB.lookupByExternalIds(
        new Set(ids),
      );

      return res.send(
        groupByUniq(
          seq.collect(results, (p) =>
            req.serverCtx.programConverter.programOrmToContentProgram(p),
          ),
          (p) => p.id,
        ),
      );
    },
  );

  fastify.get(
    '/programming/shows/:id',
    {
      schema: {
        tags: ['Programs'],
        params: z.object({
          id: z.uuid(),
        }),
        querystring: z.object({
          includeEpisodes: TruthyQueryParam.default(false),
        }),
      },
    },
    async (req, res) => {
      const result = await req.serverCtx
        .databaseFactory()
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
        tags: ['Programs'],
        params: z.object({
          id: z.string().uuid(),
        }),
      },
    },
    async (req, res) => {
      const result = await req.serverCtx
        .databaseFactory()
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
        tags: ['Programs'],
        params: z.object({
          id: z.string().uuid(),
        }),
      },
    },
    async (req, res) => {
      const result = await req.serverCtx
        .databaseFactory()
        .selectFrom('programGrouping')
        .selectAll()
        .where('programGrouping.showUuid', '=', req.params.id)
        .where('programGrouping.type', '=', ProgramGroupingType.Season)
        .orderBy('programGrouping.index asc')
        .execute();
      return res.send(result);
    },
  );

  fastify.post(
    '/movies/:id/scan',
    {
      schema: {
        params: z.object({
          id: z.uuid(),
        }),
        response: {
          202: z.void(),
          400: z.void().or(z.string()),
          404: z.void(),
          500: z.void(),
        },
      },
    },
    async (req, res) => {
      const program = await req.serverCtx.programDB.getProgramById(
        req.params.id,
      );
      if (!program) {
        return res.status(404).send();
      }

      if (
        program.type !== 'movie' ||
        !program.libraryId ||
        !program.externalKey
      ) {
        return res.status(400).send();
      }

      if (program.sourceType === 'local' && !program.mediaSourceId) {
        return res
          .status(400)
          .send(`Progarm ID = ${program.uuid} did not have a media source id!`);
      }

      const queued =
        program.sourceType === 'local'
          ? await req.serverCtx.mediaSourceScanCoordinator.addLocal({
              forceScan: true,
              mediaSourceId: program.mediaSourceId!,
              pathFilter: program.externalKey,
            })
          : await req.serverCtx.mediaSourceScanCoordinator.add({
              forceScan: true,
              libraryId: program.libraryId,
              pathFilter: program.externalKey,
            });

      if (!queued) {
        return res.status(500).send();
      }

      return res.status(202).send();
    },
  );

  fastify.post(
    '/shows/:id/scan',
    {
      schema: {
        params: z.object({
          id: z.uuid(),
        }),
        response: {
          202: z.void(),
          400: z.void().or(z.string()),
          404: z.void(),
          500: z.void(),
        },
      },
    },
    async (req, res) => {
      const program = await req.serverCtx.programDB.getProgramGrouping(
        req.params.id,
      );
      if (!program) {
        return res.status(404).send();
      }

      if (
        program.type !== 'show' ||
        !program.libraryId ||
        !program.externalKey
      ) {
        return res.status(400).send();
      }

      if (program.sourceType === 'local' && !program.mediaSourceId) {
        return res
          .status(400)
          .send(
            `Grouping ID = ${program.uuid} did not have a media source id!`,
          );
      }

      const queued =
        program.sourceType === 'local'
          ? await req.serverCtx.mediaSourceScanCoordinator.addLocal({
              forceScan: true,
              mediaSourceId: program.mediaSourceId!,
              pathFilter: program.externalKey,
            })
          : await req.serverCtx.mediaSourceScanCoordinator.add({
              forceScan: true,
              libraryId: program.libraryId,
              pathFilter: program.externalKey,
            });

      if (!queued) {
        return res.status(500).send();
      }

      return res.status(202).send();
    },
  );
};
