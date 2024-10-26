import axios, { AxiosHeaders } from 'axios';
import { createHash } from 'crypto';
import dayjs from 'dayjs';
import type { HttpHeader } from 'fastify/types/utils.d.ts';
import { isNil, isNull, isString, isUndefined, omitBy } from 'lodash-es';
import NodeCache from 'node-cache';
import stream from 'stream';
import { z } from 'zod';
import {
  ProgramSourceType,
  programSourceTypeFromString,
} from '../dao/custom_types/ProgramSourceType.ts';
import { MediaSourceApiFactory } from '../external/MediaSourceApiFactory.ts';
import { TruthyQueryParam } from '../types/schemas.ts';
import { RouterPluginAsyncCallback } from '../types/serverType.ts';

const externalIdSchema = z
  .string()
  .refine((val) => {
    if (isString(val)) {
      const parts = val.split('|', 3);
      if (parts.length !== 3) {
        return 'Invalid number of parts after splitting on delimiter';
      }

      if (isUndefined(programSourceTypeFromString(parts[0]))) {
        return `Invalid program source type: ${parts[0]}`;
      }

      return true;
    }

    return 'Input was not a string';
  })
  .transform((val) => {
    const [sourceType, sourceId, itemId] = val.split('|', 3);
    return {
      externalSourceType: programSourceTypeFromString(sourceType)!,
      externalSourceId: sourceId,
      externalItemId: itemId,
    };
  });

const thumbOptsSchema = z.object({
  width: z.number().optional(),
  height: z.number().optional(),
});

const ExternalMetadataQuerySchema = z.object({
  id: externalIdSchema,
  asset: z.union([z.literal('thumb'), z.literal('external-link')]),
  mode: z.union([z.literal('json'), z.literal('redirect'), z.literal('proxy')]),
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
  fastify.get(
    '/metadata/external',
    {
      schema: {
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
          result = await handlePlexItem(req.query);
          break;
        }
        case ProgramSourceType.JELLYFIN: {
          result = await handleJellyfishItem(req.query);
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
          if (req.query.cache && ExternalUrlCache.has(key)) {
            return res.status(304).send();
          }

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

          if (req.query.cache) {
            ExternalUrlCache.set(key, result);
            headers['cache-control'] = `max-age=${dayjs
              .duration({ hours: 1 })
              .asSeconds()}`;
          }

          return res
            .status(proxyRes.status)
            .headers(headers)
            .send(proxyRes.data);
        }
      }
    },
  );

  async function handlePlexItem(query: ExternalMetadataQuery) {
    const plexApi = await MediaSourceApiFactory().getOrSet(
      query.id.externalSourceId,
    );

    if (isNil(plexApi)) {
      return null;
    }

    if (query.asset === 'thumb') {
      return plexApi.getThumbUrl({
        itemKey: query.id.externalItemId,
        width: query.thumbOptions?.width,
        height: query.thumbOptions?.height,
        upscale: '1',
      });
    }

    return null;
  }

  async function handleJellyfishItem(query: ExternalMetadataQuery) {
    const jellyfinClient = await MediaSourceApiFactory().getJellyfinByName(
      query.id.externalSourceId,
    );

    if (isNil(jellyfinClient)) {
      return null;
    }

    if (query.asset === 'thumb') {
      return jellyfinClient.getThumbUrl(query.id.externalItemId);
      // return jellyfinClient.getThumbUrl({
      //   itemKey: query.id.externalItemId,
      //   width: query.thumbOptions?.width,
      //   height: query.thumbOptions?.height,
      //   upscale: '1',
      // });
    }

    return null;
  }
};
