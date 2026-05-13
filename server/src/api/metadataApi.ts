import { TruthyQueryParam } from '@/types/schemas.js';
import type { RouterPluginAsyncCallback } from '@/types/serverType.js';
import { isNonEmptyString } from '@/util/index.js';
import { tag } from '@tunarr/types';
import axios from 'axios';
import dayjs from 'dayjs';
import type { FastifyReply } from 'fastify';
import { head, isArray, isNil, isNull, isString, isUndefined } from 'lodash-es';
import NodeCache from 'node-cache';
import { createHash } from 'node:crypto';
import type stream from 'node:stream';
import { z } from 'zod/v4';
import { BackfillPlexClientIdentifierCommand } from '../commands/media_source/BackfillPlexClientIdentifier.ts';
import { container } from '../container.ts';
import {
  ProgramSourceType,
  programSourceTypeFromString,
} from '../db/custom_types/ProgramSourceType.ts';
import type { MediaSourceId } from '../db/schema/base.js';
import { getServerContext } from '../ServerContext.ts';
import { extractAxiosHeaders } from '../util/axios.ts';
import { LoggerFactory } from '../util/logging/LoggerFactory.ts';

const externalIdSchema = z
  .string()
  .refine((val) => {
    if (isString(val)) {
      const parts = val.split('|', 3);
      if (parts.length !== 3) {
        return 'Invalid number of parts after splitting on delimiter';
      }

      if (isUndefined(programSourceTypeFromString(parts[0]!))) {
        return `Invalid program source type: ${parts[0]}`;
      }

      return true;
    }

    return 'Input was not a string';
  })
  .transform((val) => {
    const [sourceType, sourceId, itemId] = val.split('|', 3);
    return {
      externalSourceType: programSourceTypeFromString(sourceType!)!,
      externalSourceId: tag<MediaSourceId>(sourceId!),
      externalItemId: itemId!,
    };
  });

const thumbOptsSchema = z.object({
  width: z.number().optional(),
  height: z.number().optional(),
});

const ExternalMetadataQuerySchema = z.object({
  id: externalIdSchema,
  asset: z.enum(['image', 'external-link', 'thumb']),
  imageType: z.enum(['poster', 'background']).default('poster'),

  mode: z.enum(['json', 'redirect', 'proxy']),
  cache: TruthyQueryParam.optional().default(true),
  thumbOptions: z
    .string()
    .transform((s) => JSON.parse(s) as unknown)
    .pipe(thumbOptsSchema)
    .optional(),
});

type ExternalMetadataQuery = z.infer<typeof ExternalMetadataQuerySchema>;

const ExternalUrlCache = new NodeCache({
  maxKeys: 10_000,
  stdTTL: 1000 * 60 * 60,
});

// eslint-disable-next-line @typescript-eslint/require-await
export const metadataApiRouter: RouterPluginAsyncCallback = async (fastify) => {
  const logger = LoggerFactory.child({ className: 'MetadataApi' });
  fastify.get(
    '/metadata/external',
    {
      schema: {
        hide: true,
        querystring: ExternalMetadataQuerySchema,
      },
      config: {
        logAtLevel: 'debug',
      },
    },
    async (req, res) => {
      let result: string | null = null;
      switch (req.query.id.externalSourceType) {
        case ProgramSourceType.PLEX: {
          result = await handlePlexItem(req.query, res);
          break;
        }
        case ProgramSourceType.JELLYFIN: {
          result = await handleJellyfinItem(req.query);
          break;
        }
        case ProgramSourceType.EMBY: {
          result = await handleEmbyItem(req.query);
          break;
        }
      }

      if (isNull(result)) {
        return res.status(405).send();
      }

      switch (req.query.mode) {
        case 'json':
          return res.send({ data: result });
        case 'redirect':
          if (!result) {
            return res.status(404).send();
          }
          return res.redirect(result, 302).send();
        case 'proxy': {
          if (!result) {
            return res.status(404).send();
          }

          const key = createHash('md5').update(result).digest('base64');
          const incomingCacheKey = req.headers['if-none-match'];
          if (
            req.query.cache &&
            isNonEmptyString(incomingCacheKey) &&
            ExternalUrlCache.has(incomingCacheKey)
          ) {
            return res
              .status(304)
              .headers({
                'cache-control': `max-age=${dayjs
                  .duration({ hours: 1 })
                  .asSeconds()}, must-revalidate`,
                etag: incomingCacheKey,
              })
              .send();
          }

          const proxyRes = await axios.request<stream.Readable>({
            url: result,
            responseType: 'stream',
          });

          const headers = extractAxiosHeaders(proxyRes.headers);

          // Attempt to not return 0 byte streams, nor cache them.
          if (headers['content-length']) {
            const header = isArray(headers['content-length'])
              ? head(headers['content-length'])
              : headers['content-length'];
            if (isNonEmptyString(header)) {
              const len = parseInt(header);
              if (!isNaN(len) && len <= 0) {
                return res.status(400).send();
              }
            }
          }

          if (req.query.cache) {
            const genTime = +dayjs();
            const cacheKey = `${key}_${genTime}`;
            ExternalUrlCache.set(cacheKey, result);
            headers['cache-control'] = `max-age=${dayjs
              .duration({ hours: 1 })
              .asSeconds()}, must-revalidate`;
            headers['etag'] = cacheKey;
          }

          return res
            .status(proxyRes.status)
            .headers(headers)
            .send(proxyRes.data);
        }
      }
    },
  );

  async function handlePlexItem(
    query: ExternalMetadataQuery,
    res: FastifyReply,
  ) {
    const plexApi =
      await getServerContext().mediaSourceApiFactory.getPlexApiClientById(
        query.id.externalSourceId,
      );

    if (isNil(plexApi)) {
      return null;
    }

    if (query.asset === 'thumb' || query.asset === 'image') {
      return plexApi.getThumbUrl({
        itemKey: query.id.externalItemId,
        width: query.thumbOptions?.width,
        height: query.thumbOptions?.height,
        upscale: '1',
        imageType: query.imageType,
      });
    } else if (query.asset === 'external-link') {
      const server = await getServerContext().mediaSourceDB.getById(
        query.id.externalSourceId,
      );

      if (!server) {
        return res
          .status(404)
          .send(`Plex server with ID ${query.id.externalSourceId} not found`);
      }

      let clientIdentifier = server.clientIdentifier;
      if (!isNonEmptyString(server.clientIdentifier)) {
        const backfillResult = await container
          .get(BackfillPlexClientIdentifierCommand)
          .run({ mediaSourceId: query.id.externalSourceId });
        if (backfillResult.isFailure()) {
          logger.warn(
            backfillResult.error,
            'Error while trying to backfill client identifier for Plex server',
          );
        } else {
          clientIdentifier = backfillResult.get() ?? null;
        }

        if (!isNonEmptyString(clientIdentifier)) {
          return res
            .status(404)
            .send(
              `No client identifier string found for Plex server ${query.id.externalSourceId}`,
            );
        }
      }

      return `${server.uri}/web/index.html#!/server/${
        clientIdentifier ?? ''
      }/details?key=${encodeURIComponent(
        `/library/metadata/${query.id.externalItemId}`,
      )}&X-Plex-Token=${server.accessToken}`;
    }

    return null;
  }

  async function handleJellyfinItem(query: ExternalMetadataQuery) {
    const jellyfinClient =
      await getServerContext().mediaSourceApiFactory.getJellyfinApiClientById(
        query.id.externalSourceId,
      );

    if (isNil(jellyfinClient)) {
      return null;
    }

    if (query.asset === 'thumb' || query.asset === 'image') {
      return jellyfinClient.getThumbUrl(
        query.id.externalItemId,
        query.imageType === 'poster' ? 'Primary' : 'Thumb',
      );
    } else if (query.asset === 'external-link') {
      return jellyfinClient.getExternalUrl(query.id.externalItemId);
    }

    return null;
  }

  async function handleEmbyItem(query: ExternalMetadataQuery) {
    const embyClient =
      await getServerContext().mediaSourceApiFactory.getEmbyApiClientById(
        query.id.externalSourceId,
      );

    if (isNil(embyClient)) {
      return null;
    }

    if (query.asset === 'thumb' || query.asset === 'image') {
      return embyClient.getThumbUrl(
        query.id.externalItemId,
        query.imageType === 'poster' ? 'Primary' : 'Thumb',
      );
    } else if (query.asset === 'external-link') {
      return embyClient.getExternalUrl(query.id.externalItemId);
    }

    return null;
  }
};
