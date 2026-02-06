import { isNonEmptyString } from '@tunarr/shared/util';
import { Person } from '@tunarr/types';
import { Person as PersonSchema } from '@tunarr/types/schemas';
import axios, { AxiosHeaders, isAxiosError } from 'axios';
import type { HttpHeader } from 'fastify/types/utils.js';
import { inject, injectable } from 'inversify';
import { isNull, omitBy, trimStart } from 'lodash-es';
import type stream from 'node:stream';
import { match } from 'ts-pattern';
import z from 'zod';
import { ArtworkTypes } from '../db/schema/Artwork.ts';
import { CreditTypes } from '../db/schema/Credit.ts';
import { DrizzleDBAccess } from '../db/schema/index.ts';
import { globalOptions } from '../globals.ts';
import { KEYS } from '../types/inject.ts';
import { RouterPluginAsyncCallback } from '../types/serverType.js';
import { getBooleanEnvVar, TUNARR_ENV_VARS } from '../util/env.ts';

@injectable()
export class CreditsApiController {
  constructor(@inject(KEYS.DrizzleDB) private db: DrizzleDBAccess) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  mount: RouterPluginAsyncCallback = async (fastify) => {
    fastify.get(
      `/credits/:id`,
      {
        schema: {
          params: z.object({
            id: z.uuid(),
          }),
          querystring: z.object({
            type: z.enum(CreditTypes).optional(),
          }),
          response: {
            200: PersonSchema,
            400: z.void(),
            404: z.void(),
          },
        },
      },
      async (req, res) => {
        // TODO: move to repository class
        const maybeCredit = await this.db.query.credit.findFirst({
          where: (credit, { and, eq }) =>
            and(
              eq(credit.uuid, req.params.id),
              req.query.type ? eq(credit.type, req.query.type) : undefined,
            ),
          with: {
            artwork: true,
          },
        });

        if (!maybeCredit) {
          return res.status(404).send();
        }

        const matchingArt = maybeCredit.artwork.find(
          (art) => art.artworkType === 'thumbnail',
        )?.sourcePath;

        const thumb =
          isNonEmptyString(matchingArt) && URL.canParse(matchingArt)
            ? matchingArt
            : undefined;

        const person = match(maybeCredit)
          .returnType<Person | null>()
          .with({ type: 'cast' }, (cast) => ({
            name: cast.name,
            type: 'actor',
            order: cast.index,
            role: cast.role,
            thumb,
          }))
          .with({ type: 'director' }, () => ({
            name: maybeCredit.name,
            type: 'director',
            order: maybeCredit.index,
            thumb,
          }))
          .with({ type: 'writer' }, () => ({
            name: maybeCredit.name,
            type: 'writer',
            order: maybeCredit.index,
            thumb,
          }))
          .otherwise(() => null);

        if (!person) {
          return res.status(400).send();
        }

        return res.send(person);
      },
    );

    fastify.get(
      '/credits/:id/artwork/:artworkType',
      {
        schema: {
          produces: ['image/jpeg', 'image/png'],
          params: z.object({
            id: z.uuid(),

            // TODO: use API schema
            artworkType: z.enum(ArtworkTypes),
          }),
          querystring: z.object({
            type: z.enum(CreditTypes).optional(),
          }),
          response: {
            200: z.any(),
            404: z.void(),
          },
        },
      },
      async (req, res) => {
        const maybeCredit = await this.db.query.credit.findFirst({
          where: (credit, { and, eq }) =>
            and(
              eq(credit.uuid, req.params.id),
              req.query.type ? eq(credit.type, req.query.type) : undefined,
            ),
          with: {
            artwork: true,
          },
        });

        if (!maybeCredit) {
          return res.status(404).send();
        }

        const art = maybeCredit.artwork.find(
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
        } else if (URL.canParse(art.sourcePath)) {
          // TODO: persist media source details with either
          // artwork or credit to ensure we can add this functionality
          // if (!program.mediaSourceId) {
          //   return res.status(404).send();
          // }
          // const mediaSource = await req.serverCtx.mediaSourceDB.getById(
          //   program.mediaSourceId,
          // );
          // if (!mediaSource) {
          //   return res.status(404).send();
          // }

          const url = URL.parse(art.sourcePath)!;
          // switch (mediaSource.type) {
          //   case 'plex':
          //     url?.searchParams.append('X-Plex-Token', mediaSource.accessToken);
          //     break;
          //   case 'jellyfin':
          //   case 'emby':
          //     url?.searchParams.append('X-Emby-Token', mediaSource.accessToken);
          //     break;
          //   case 'local':
          //     break;
          // }

          const fullUrl = url.toString();

          if (getBooleanEnvVar(TUNARR_ENV_VARS.PROXY_ARTWORK_ENV_VAR, false)) {
            try {
              const proxyRes = await axios.request<stream.Readable>({
                url: fullUrl,
                responseType: 'stream',
              });

              let headers: Partial<Record<HttpHeader, string | string[]>>;
              if (proxyRes.headers instanceof AxiosHeaders) {
                headers = {
                  ...proxyRes.headers
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
                return res.status(404).send();
              }
              throw e;
            }
          }

          return res.redirect(fullUrl);
        } else {
          return res.sendFile(art.sourcePath);
        }
      },
    );
  };
}
