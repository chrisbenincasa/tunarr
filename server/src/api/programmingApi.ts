import { ProgramExternalIdType } from '@/db/custom_types/ProgramExternalIdType.js';
import type {
  MediaSource,
  MediaSourceLibrary,
} from '@/db/schema/MediaSource.js';
import { ProgramType } from '@/db/schema/Program.js';
import type { ProgramGrouping as ProgramGroupingDao } from '@/db/schema/ProgramGrouping.js';
import {
  AllProgramGroupingFields,
  ProgramGroupingType,
} from '@/db/schema/ProgramGrouping.js';
import { JellyfinApiClient } from '@/external/jellyfin/JellyfinApiClient.js';
import { PlexApiClient } from '@/external/plex/PlexApiClient.js';
import { PagingParams, TruthyQueryParam } from '@/types/schemas.js';
import type { RouterPluginAsyncCallback } from '@/types/serverType.js';
import {
  groupByUniq,
  groupByUniqAndMap,
  ifDefined,
  isNonEmptyString,
} from '@/util/index.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { seq } from '@tunarr/shared/util';
import type { ProgramGrouping } from '@tunarr/types';
import {
  tag,
  type Episode,
  type Movie,
  type MusicAlbum,
  type MusicArtist,
  type MusicTrack,
  type Season,
  type Show,
  type TerminalProgram,
} from '@tunarr/types';
import {
  BasicIdParamSchema,
  ProgramChildrenResult,
  ProgramSearchRequest,
  ProgramSearchResponse,
  SearchFilterQuerySchema,
} from '@tunarr/types/api';
import {
  ContentProgramSchema,
  TerminalProgramSchema,
} from '@tunarr/types/schemas';
import axios, { AxiosHeaders, isAxiosError } from 'axios';
import dayjs from 'dayjs';
import type { HttpHeader } from 'fastify/types/utils.js';
import { jsonArrayFrom } from 'kysely/helpers/sqlite';
import {
  compact,
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
import type stream from 'node:stream';
import { match } from 'ts-pattern';
import z from 'zod/v4';
import { container } from '../container.ts';
import {
  ProgramSourceType,
  programSourceTypeFromString,
} from '../db/custom_types/ProgramSourceType.ts';
import type { ProgramGroupingChildCounts } from '../db/interfaces/IProgramDB.ts';
import { AllProgramFields } from '../db/programQueryHelpers.ts';
import type { MediaSourceId } from '../db/schema/base.ts';
import type {
  MediaSourceWithLibraries,
  ProgramWithRelations,
} from '../db/schema/derivedTypes.js';
import type { DrizzleDBAccess } from '../db/schema/index.ts';
import type {
  ProgramGroupingSearchDocument,
  ProgramSearchDocument,
  TerminalProgramSearchDocument,
} from '../services/MeilisearchService.ts';
import { decodeCaseSensitiveId } from '../services/MeilisearchService.ts';
import { FfprobeStreamDetails } from '../stream/FfprobeStreamDetails.ts';
import { ExternalStreamDetailsFetcherFactory } from '../stream/StreamDetailsFetcher.ts';
import { KEYS } from '../types/inject.ts';
import type { Path } from '../types/path.ts';
import type { Maybe } from '../types/util.ts';

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

function isProgramGroupingDocument(
  doc: ProgramSearchDocument,
): doc is ProgramGroupingSearchDocument {
  switch (doc.type) {
    case 'show':
    case 'season':
    case 'artist':
    case 'album':
      return true;
    default:
      return false;
  }
}

function convertProgramSearchResult(
  doc: TerminalProgramSearchDocument,
  program: ProgramWithRelations,
  mediaSource: MediaSourceWithLibraries,
  mediaLibrary: MediaSourceLibrary,
): TerminalProgram {
  if (!program.canonicalId) {
    throw new Error('');
  }

  const externalId = doc.externalIds.find(
    (eid) => eid.source === mediaSource.type,
  )?.id;
  if (!externalId) {
    throw new Error('');
  }

  const base = {
    mediaSourceId: mediaSource.uuid,
    libraryId: mediaLibrary.uuid,
    externalLibraryId: mediaLibrary.externalKey,
    releaseDate: doc.originalReleaseDate,
    releaseDateString: doc.originalReleaseDate
      ? dayjs(doc.originalReleaseDate).format('YYYY-MM-DD')
      : null,
    externalId,
    sourceType: mediaSource.type,
  };

  const identifiers = doc.externalIds.map((eid) => ({
    id: eid.id,
    sourceId: isNonEmptyString(eid.sourceId)
      ? decodeCaseSensitiveId(eid.sourceId)
      : undefined,
    type: eid.source,
  }));

  const uuid = doc.id;
  const year =
    doc.originalReleaseYear ??
    (doc.originalReleaseDate && doc.originalReleaseDate > 0
      ? dayjs(doc.originalReleaseDate).year()
      : null);
  const releaseDate =
    doc.originalReleaseDate && doc.originalReleaseDate > 0
      ? doc.originalReleaseDate
      : null;

  const result = match(doc)
    .returnType<TerminalProgram | null>()
    .with(
      { type: 'episode' },
      (ep) =>
        ({
          ...ep,
          ...base,
          uuid,
          originalTitle: null,
          year,
          releaseDate,
          identifiers,
          episodeNumber: ep.index ?? 0,
          canonicalId: program.canonicalId!,
          // mediaItem: {
          //   displayAspectRatio: '',
          //   duration: doc.duration,
          //   resolution: {
          //     widthPx: doc.videoWidth ?? 0,
          //     heightPx: doc.videoHeight ?? 0,
          //   },
          //   sampleAspectRatio: '',

          // },
        }) satisfies Episode,
    )
    .with(
      { type: 'movie' },
      (movie) =>
        ({
          ...movie,
          ...base,
          identifiers,
          uuid,
          originalTitle: null,
          year,
          releaseDate,
          canonicalId: program.canonicalId!,
        }) satisfies Movie,
    )
    .with(
      { type: 'track' },
      (track) =>
        ({
          ...track,
          ...base,
          identifiers,
          uuid,
          originalTitle: null,
          year,
          releaseDate,
          canonicalId: program.canonicalId!,
          trackNumber: doc.index ?? 0,
        }) satisfies MusicTrack,
    )
    .otherwise(() => null);

  if (!result) {
    throw new Error('');
  }

  return result;
}

function convertProgramGroupingSearchResult(
  doc: ProgramGroupingSearchDocument,
  grouping: ProgramGroupingDao,
  childCounts: Maybe<ProgramGroupingChildCounts>,
  mediaSource: MediaSourceWithLibraries,
  mediaLibrary: MediaSourceLibrary,
) {
  if (!grouping.canonicalId) {
    throw new Error('');
  }

  const childCount = childCounts?.childCount;
  const grandchildCount = childCounts?.grandchildCount;

  const identifiers = doc.externalIds.map((eid) => ({
    id: eid.id,
    sourceId: isNonEmptyString(eid.sourceId)
      ? decodeCaseSensitiveId(eid.sourceId)
      : undefined,
    type: eid.source,
  }));

  const uuid = doc.id;
  const studios = doc?.studio?.map(({ name }) => ({ name })) ?? [];

  const externalId = doc.externalIds.find(
    (eid) => eid.source === mediaSource.type,
  )?.id;
  if (!externalId) {
    throw new Error('');
  }

  const base = {
    mediaSourceId: mediaSource.uuid,
    libraryId: mediaLibrary.uuid,
    externalLibraryId: mediaLibrary.externalKey,
    releaseDate: doc.originalReleaseDate,
    releaseDateString: doc.originalReleaseDate
      ? dayjs(doc.originalReleaseDate).format('YYYY-MM-DD')
      : null,
    externalId,
    sourceType: mediaSource.type,
  };

  const result = match(doc)
    .returnType<ProgramGrouping>()
    .with(
      { type: 'season' },
      (season) =>
        ({
          ...season,
          ...base,
          type: 'season',
          identifiers,
          uuid,
          canonicalId: grouping.canonicalId!,
          studios,
          year: doc.originalReleaseYear,
          index: doc.index ?? 0,
          childCount,
          grandchildCount,
        }) satisfies Season,
    )
    .with(
      { type: 'show' },
      (show) =>
        ({
          ...show,
          ...base,
          identifiers,
          uuid,
          canonicalId: grouping.canonicalId!,
          studios,
          year: doc.originalReleaseYear,
          childCount,
          grandchildCount,
        }) satisfies Show,
    )
    .with(
      { type: 'album' },
      (album) =>
        ({
          ...album,
          ...base,
          identifiers,
          uuid,
          canonicalId: grouping.canonicalId!,
          // studios,
          year: doc.originalReleaseYear,
          childCount,
          grandchildCount,
        }) satisfies MusicAlbum,
    )
    .with(
      { type: 'artist' },
      (artist) =>
        ({
          ...artist,
          ...base,
          identifiers,
          uuid,
          canonicalId: grouping.canonicalId!,
          childCount,
          grandchildCount,
        }) satisfies MusicArtist,
    )
    .exhaustive();

  return result;
}

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
      const result = await req.serverCtx.searchService.search('programs', {
        query: req.body.query.query,
        filter: req.body.query.filter,
        paging: {
          offset: req.body.page ?? 1,
          limit: req.body.limit ?? 20,
        },
        libraryId: req.body.libraryId,
        // TODO not a great cast...
        restrictSearchTo: req.body.query
          .restrictSearchTo as Path<ProgramSearchDocument>[],
      });

      const [programIds, groupingIds] = result.hits.reduce(
        (acc, curr) => {
          const [programs, groupings] = acc;
          if (isProgramGroupingDocument(curr)) {
            groupings.push(curr.id);
          } else {
            programs.push(curr.id);
          }
          return acc;
        },
        [[], []] as [string[], string[]],
      );

      const allMediaSources = await req.serverCtx.mediaSourceDB.getAll();
      const allMediaSourcesById = groupByUniq(
        allMediaSources,
        (ms) => ms.uuid as string,
      );
      const allLibrariesById = groupByUniq(
        allMediaSources.flatMap((ms) => ms.libraries),
        (lib) => lib.uuid,
      );

      const [programs, groupings, groupingCounts] = await Promise.all([
        req.serverCtx.programDB
          .getProgramsByIds(programIds)
          .then((res) => groupByUniq(res, (p) => p.uuid)),
        req.serverCtx.programDB.getProgramGroupings(groupingIds),
        req.serverCtx.programDB.getProgramGroupingChildCounts(groupingIds),
      ]);

      const results = seq.collect(result.hits, (program) => {
        const mediaSourceId = decodeCaseSensitiveId(program.mediaSourceId);
        const mediaSource = allMediaSourcesById[mediaSourceId];
        if (!mediaSource) {
          return;
        }
        const libraryId = decodeCaseSensitiveId(program.libraryId);
        const library = allLibrariesById[libraryId];
        if (!library) {
          return;
        }

        if (isProgramGroupingDocument(program) && groupings[program.id]) {
          return convertProgramGroupingSearchResult(
            program,
            groupings[program.id],
            groupingCounts[program.id],
            mediaSource,
            library,
          );
        } else if (
          !isProgramGroupingDocument(program) &&
          programs[program.id]
        ) {
          return convertProgramSearchResult(
            program,
            programs[program.id],
            mediaSource,
            library,
          );
        }

        return;
      });

      return res.send({
        results,
        page: result.page,
        totalHits: result.totalHits,
        totalPages: result.totalPages,
      });
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
              req.serverCtx.programConverter.convertProgramWithExternalIds(
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
        req.serverCtx.programConverter.convertProgramWithExternalIds(program),
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
          libraryId: z.string().uuid().optional(),
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
          season: true,
          show: true,
          album: true,
          artist: true,
          externalIds: true,
          mediaLibrary: true,
          versions: {
            with: {
              mediaStreams: true,
              chapters: true,
            },
          },
        },
      });

      if (!dbRes) {
        return res.status(404).send();
      }

      if (dbRes.mediaSourceId && dbRes.libraryId && dbRes.canonicalId) {
        const converted =
          req.serverCtx.programConverter.programDaoToTerminalProgram(dbRes);

        if (!converted) {
          return res.status(404).send();
        }

        return res.send(converted);
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
          lineupItem: {
            externalKey: program.externalKey,
            externalSource: program.sourceType,
            externalSourceId: program.mediaSourceId ?? program.externalSourceId,
            duration: program.duration,
            externalFilePath: program.plexFilePath ?? undefined,
            programId: program.uuid,
            programType: program.type,
          },
          server,
        });

      if (!result) {
        return res.status(500).send();
      }

      const ffprobeDetails = await ffprobe.getStream({
        path: result.streamSource.path,
      });

      if (result.streamDetails.placeholderImage?.type === 'http') {
        result.streamDetails.placeholderImage.redact();
      }

      if (result.streamSource.type === 'http') {
        result.streamSource.redact();
      }

      if (ffprobeDetails?.streamSource.type === 'http') {
        ffprobeDetails.streamSource.redact();
      }

      return res.send({
        details: result,
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
        const result = seq.collect(results, (program) =>
          req.serverCtx.programConverter.programDaoToContentProgram(
            program,
            program.externalIds,
          ),
        );

        return res.send({
          total,
          result: {
            type: grouping.type === 'album' ? 'track' : 'episode',
            programs: result,
          },
          size: result.length,
        });
      } else if (grouping.type === 'artist') {
        const { total, results } = await req.serverCtx.programDB.getChildren(
          req.params.id,
          grouping.type,
          req.query,
        );
        const result = results.map((program) =>
          req.serverCtx.programConverter.programGroupingDaoToDto(program),
        );
        return res.send({
          total,
          result: { type: 'album', programs: result },
          size: result.length,
        });
      } else if (grouping.type === 'show') {
        const { total, results } = await req.serverCtx.programDB.getChildren(
          req.params.id,
          grouping.type,
          req.query,
        );
        const result = results.map((program) =>
          req.serverCtx.programConverter.programGroupingDaoToDto(program),
        );
        return res.send({
          total,
          result: { type: 'season', programs: result },
          size: result.length,
        });
      }

      return res.status(400).send();
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

      const handleResult = async (mediaSource: MediaSource, result: string) => {
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
          case ProgramSourceType.PLEX: {
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
          case ProgramExternalIdType.PLEX:
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
          case ProgramExternalIdType.JELLYFIN:
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
          source.uuid === externalId.mediaSourceId ||
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
      const sourceTypeParsed = programSourceTypeFromString(sourceType);
      if (isUndefined(sourceTypeParsed)) {
        return res
          .status(400)
          .send({ message: 'Invalid sourceType ' + sourceType });
      }

      const result = await req.serverCtx.programDB.lookupByExternalIds(
        new Set([[sourceType, tag(rawServerId), id]]),
      );
      const program = first(values(result));

      if (isNil(program)) {
        return res.status(404).send();
      }

      const converted =
        req.serverCtx.programConverter.programDaoToContentProgram(program);

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
        .map(
          ([source, sourceId, id]) =>
            [source, tag<MediaSourceId>(sourceId), id] as const,
        )
        .toArray();
      const results = await req.serverCtx.programDB.lookupByExternalIds(
        new Set(ids),
      );

      return res.send(
        groupByUniq(
          seq.collect(results, (p) =>
            req.serverCtx.programConverter.programDaoToContentProgram(p),
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
};
