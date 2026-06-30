import { isNonEmptyString } from '@tunarr/shared/util';
import type { Person } from '@tunarr/types';
import { Person as PersonSchema } from '@tunarr/types/schemas';
import { inject, injectable } from 'inversify';
import { match } from 'ts-pattern';
import z from 'zod';
import { ArtworkTypes } from '../db/schema/Artwork.ts';
import { CreditTypes } from '../db/schema/Credit.ts';
import type { DrizzleDBAccess } from '../db/schema/index.ts';
import { KEYS } from '../types/inject.ts';
import type { RouterPluginAsyncCallback } from '../types/serverType.js';
import { ArtworkService } from '../services/ArtworkService.ts';

@injectable()
export class CreditsApiController {
  constructor(
    @inject(KEYS.DrizzleDB) private db: DrizzleDBAccess,
    @inject(ArtworkService) private artworkService: ArtworkService,
  ) {}

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
        config: {
          authRequired: false,
        },
      },
      async (req, res) => {
        const result = await this.artworkService.resolveArtwork(
          req.params.id,
          'credit',
          req.params.artworkType,
        );
        return this.artworkService.serveArtwork(result, res);
      },
    );
  };
}
