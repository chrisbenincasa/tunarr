import axios, { AxiosHeaders } from 'axios';
import { HttpHeader } from 'fastify/types/utils';
import { isNil, isNull, isString, isUndefined, omitBy } from 'lodash-es';
import stream from 'stream';
import { z } from 'zod';
import { withDb } from '../dao/dataSource';
import { PlexServerSettings } from '../dao/entities/PlexServerSettings';
import {
  ProgramSourceType,
  programSourceTypeFromString,
} from '../dao/entities/Program';
import { Plex } from '../plex';
import { RouterPluginAsyncCallback } from '../types/serverType';

type ExternalId = {
  externalSourceType: ProgramSourceType;
  externalSourceId: string;
  externalItemId: string;
};

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

// eslint-disable-next-line @typescript-eslint/require-await
export const metadataApiRouter: RouterPluginAsyncCallback = async (fastify) => {
  fastify.get(
    '/metadata/external',
    {
      schema: {
        querystring: z.object({
          id: externalIdSchema,
          asset: z.union([z.literal('thumb'), z.literal('external-link')]),
          mode: z.union([
            z.literal('json'),
            z.literal('redirect'),
            z.literal('proxy'),
          ]),
        }),
      },
    },
    async (req, res) => {
      let result: string | null = null;
      switch (req.query.id.externalSourceType) {
        case ProgramSourceType.PLEX: {
          result = await handlePlexItem(req.query.id, req.query.asset);
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
          return res.redirect(302, result).send();
        case 'proxy': {
          if (!result) {
            return res.status(404).send();
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

          return res
            .status(proxyRes.status)
            .headers(headers)
            .send(proxyRes.data);
        }
      }
    },
  );

  async function handlePlexItem(
    id: ExternalId,
    asset: 'thumb' | 'external-link',
  ) {
    const plexServer = await withDb((em) => {
      return em.findOne(PlexServerSettings, { name: id.externalSourceId });
    });

    if (isNil(plexServer)) {
      return null;
    }

    if (asset === 'thumb') {
      return Plex.getThumbUrl({
        uri: plexServer.uri,
        accessToken: plexServer.accessToken,
        itemKey: id.externalItemId,
      });
    }

    return null;
  }
};
